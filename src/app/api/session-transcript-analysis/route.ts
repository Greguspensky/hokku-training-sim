import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { sessionId, forceReAnalysis = false } = await request.json()

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Session ID is required'
      }, { status: 400 })
    }

    // Get the session from database
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('training_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({
        success: false,
        error: 'Session not found'
      }, { status: 404 })
    }

    // Check if analysis is already completed and cached (unless forced re-analysis)
    if (!forceReAnalysis && session.assessment_status === 'completed' && session.theory_assessment_results) {
      console.log(`✅ Using cached assessment results for session ${sessionId}`)

      return NextResponse.json({
        success: true,
        sessionId,
        transcriptAnalysis: {
          totalMessages: session.conversation_transcript?.length || 0,
          userMessages: session.conversation_transcript?.filter(m => m.role === 'user').length || 0,
          assistantMessages: session.conversation_transcript?.filter(m => m.role === 'assistant').length || 0,
          qaPairsFound: session.theory_assessment_results?.processedExchanges || 0,
          transcript: session.conversation_transcript || []
        },
        assessment: session.theory_assessment_results,
        fromCache: true,
        cachedAt: session.assessment_completed_at
      })
    }

    if (!session.elevenlabs_conversation_id) {
      return NextResponse.json({
        success: false,
        error: 'No ElevenLabs conversation ID found for this session'
      }, { status: 400 })
    }

    console.log(`🔄 Fetching transcript for session ${sessionId} with conversation ID: ${session.elevenlabs_conversation_id}`)

    // Fetch transcript from ElevenLabs API
    const baseUrl = process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : `https://${process.env.VERCEL_URL || 'localhost:3000'}`

    const transcriptResponse = await fetch(`${baseUrl}/api/elevenlabs-conversation-transcript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: session.elevenlabs_conversation_id
      })
    })

    if (!transcriptResponse.ok) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch transcript from ElevenLabs'
      }, { status: 500 })
    }

    const transcriptData = await transcriptResponse.json()

    // Handle multiple possible transcript formats
    const messages = transcriptData.transcript?.messages ||
                    transcriptData.messages ||
                    transcriptData.transcript ||
                    []

    // Extract duration from transcript data
    const durationSeconds = transcriptData.durationSeconds || 0

    if (!messages || messages.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No transcript messages found'
      }, { status: 404 })
    }

    console.log(`✅ Retrieved transcript with ${messages.length} messages`)
    console.log(`⏱️ Session duration: ${durationSeconds} seconds`)

    // Update the session with the fresh transcript and duration
    const { error: updateError } = await supabaseAdmin
      .from('training_sessions')
      .update({
        conversation_transcript: messages,
        session_duration_seconds: durationSeconds
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('⚠️ Failed to update session with new transcript:', updateError)
    }

    // Run assessment on the transcript with timeout
    console.log('🧪 Running assessment...')
    let assessmentResult = null

    try {
      const assessmentController = new AbortController()
      const assessmentTimeout = setTimeout(() => assessmentController.abort(), 45000) // 45 second timeout

      const assessmentResponse = await fetch(`${baseUrl}/api/assess-theory-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
          userId: session.employee_id,
          transcript: messages
        }),
        signal: assessmentController.signal
      })

      clearTimeout(assessmentTimeout)

      if (assessmentResponse.ok) {
        assessmentResult = await assessmentResponse.json()
        console.log('✅ Assessment completed successfully')
      } else {
        console.error('❌ Assessment failed with status:', assessmentResponse.status)
      }
    } catch (assessmentError) {
      if (assessmentError.name === 'AbortError') {
        console.error('⏰ Assessment timed out after 45 seconds')
      } else {
        console.error('❌ Assessment error:', assessmentError.message)
      }
    }

    // Analyze Q&A pairs
    let qaPairs = 0
    let userMessages = 0
    let assistantMessages = 0

    for (let i = 0; i < messages.length - 1; i++) {
      const current = messages[i]
      const next = messages[i + 1]

      if (current.role === 'user') userMessages++
      if (current.role === 'assistant') assistantMessages++

      if (current.role === 'assistant' && next.role === 'user' && next.content.trim().length > 10) {
        qaPairs++
      }
    }

    // Prepare assessment results for caching
    const assessmentResultsForCache = {
      ...assessmentResult,
      processedExchanges: qaPairs,
      analyzedAt: new Date().toISOString()
    }

    // Cache assessment results in database (with graceful failure)
    try {
      const assessmentStatus = assessmentResult?.success ? 'completed' : 'failed'

      const { error: cacheError } = await supabaseAdmin
        .from('training_sessions')
        .update({
          theory_assessment_results: assessmentResultsForCache,
          assessment_completed_at: new Date().toISOString(),
          assessment_status: assessmentStatus
        })
        .eq('id', sessionId)

      if (cacheError) {
        console.error('⚠️ Failed to cache assessment results (columns may not exist yet):', cacheError)
        // Continue execution - caching is optional until migration is run
      } else {
        console.log(`✅ Assessment results cached successfully for session ${sessionId}`)
      }
    } catch (cacheError) {
      console.error('⚠️ Failed to cache assessment results:', cacheError)
      // Continue execution - caching is optional
    }

    return NextResponse.json({
      success: true,
      sessionId,
      transcriptAnalysis: {
        totalMessages: messages.length,
        userMessages,
        assistantMessages,
        qaPairsFound: qaPairs,
        transcript: messages
      },
      assessment: assessmentResultsForCache,
      fromCache: false,
      analyzedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error in session transcript analysis:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}