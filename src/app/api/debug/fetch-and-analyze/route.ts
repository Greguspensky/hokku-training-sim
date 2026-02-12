/**
 * Fetch transcript from ElevenLabs and trigger assessment
 * POST /api/debug/fetch-and-analyze
 * Body: { sessionId }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY!

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId } = body

    console.log('🔄 Fetching transcript and triggering analysis for session:', sessionId)

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing required field: sessionId' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Get session details
    console.log('1️⃣ Fetching session details...')
    const { data: session, error: sessionError } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found', details: sessionError },
        { status: 404 }
      )
    }

    const conversationId = session.elevenlabs_conversation_id

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Session has no linked ElevenLabs conversation' },
        { status: 400 }
      )
    }

    console.log('✅ Session found with conversation ID:', conversationId)

    // Step 2: Fetch conversation metadata from ElevenLabs
    console.log('2️⃣ Fetching conversation metadata...')
    const convResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
      {
        headers: {
          'xi-api-key': elevenLabsApiKey
        }
      }
    )

    if (!convResponse.ok) {
      throw new Error(`ElevenLabs API error: ${convResponse.status}`)
    }

    const conversation = await convResponse.json()
    console.log('✅ Conversation metadata fetched')

    // Step 3: Fetch transcript
    console.log('3️⃣ Fetching transcript...')
    const transcriptResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/transcript`,
      {
        headers: {
          'xi-api-key': elevenLabsApiKey
        }
      }
    )

    if (!transcriptResponse.ok) {
      throw new Error(`Failed to fetch transcript: ${transcriptResponse.status}`)
    }

    const transcriptData = await transcriptResponse.json()
    const transcript = transcriptData.transcript || []
    console.log(`✅ Transcript fetched: ${transcript.length} messages`)

    // Step 4: Calculate duration
    let durationSeconds = session.session_duration_seconds
    if (conversation.start_time_unix_secs && conversation.end_time_unix_secs) {
      durationSeconds = conversation.end_time_unix_secs - conversation.start_time_unix_secs
      console.log(`📊 Duration from ElevenLabs: ${durationSeconds}s`)
    } else if (conversation.call_duration_secs) {
      durationSeconds = conversation.call_duration_secs
      console.log(`📊 Duration from call_duration_secs: ${durationSeconds}s`)
    }

    // Step 5: Update session with transcript and duration
    console.log('4️⃣ Updating session with transcript and duration...')
    const { error: updateError } = await supabase
      .from('training_sessions')
      .update({
        conversation_transcript: transcript,
        session_duration_seconds: durationSeconds || 0
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('❌ Failed to update session:', updateError)
      throw updateError
    }

    console.log('✅ Session updated successfully')

    // Step 6: Trigger assessment based on training mode
    let assessmentResults = null

    if (session.training_mode === 'theory' || session.training_mode === 'theory_qa') {
      console.log('5️⃣ Triggering theory assessment...')
      try {
        const assessResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/assessment/assess-theory-session`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
          }
        )

        if (assessResponse.ok) {
          const assessData = await assessResponse.json()
          assessmentResults = assessData.assessment
          console.log('✅ Theory assessment completed')
        } else {
          const errorText = await assessResponse.text()
          console.warn('⚠️ Theory assessment failed:', errorText)
        }
      } catch (error) {
        console.warn('⚠️ Could not trigger theory assessment:', error)
      }
    } else if (session.training_mode === 'service_practice') {
      console.log('5️⃣ Triggering service practice assessment...')
      try {
        const assessResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/assessment/assess-service-practice-session`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
          }
        )

        if (assessResponse.ok) {
          const assessData = await assessResponse.json()
          assessmentResults = assessData.assessment
          console.log('✅ Service practice assessment completed')
        } else {
          const errorText = await assessResponse.text()
          console.warn('⚠️ Service practice assessment failed:', errorText)
        }
      } catch (error) {
        console.warn('⚠️ Could not trigger service practice assessment:', error)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Transcript fetched and analysis triggered',
      session: {
        id: sessionId,
        training_mode: session.training_mode,
        conversation_id: conversationId,
        transcript_messages: transcript.length,
        duration_seconds: durationSeconds,
        duration_formatted: durationSeconds
          ? `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`
          : 'N/A',
        assessment_completed: !!assessmentResults
      },
      assessment: assessmentResults
    })

  } catch (error) {
    console.error('❌ Failed to fetch and analyze:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch and analyze session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
