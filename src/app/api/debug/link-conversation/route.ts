/**
 * Link an existing session to an ElevenLabs conversation
 * POST /api/debug/link-conversation
 * Body: { sessionId, conversationId }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY!

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, conversationId } = body

    console.log('🔗 Linking conversation to session:', {
      sessionId,
      conversationId
    })

    if (!sessionId || !conversationId) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, conversationId' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Verify session exists
    console.log('1️⃣ Checking if session exists...')
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
    console.log('✅ Session found:', sessionId)

    // Step 2: Fetch conversation from ElevenLabs
    console.log('2️⃣ Fetching conversation from ElevenLabs...')
    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
      {
        headers: {
          'xi-api-key': elevenLabsApiKey
        }
      }
    )

    if (!elevenLabsResponse.ok) {
      throw new Error(`ElevenLabs API error: ${elevenLabsResponse.status}`)
    }

    const conversation = await elevenLabsResponse.json()
    console.log('✅ Conversation found in ElevenLabs')

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

    let transcript = []
    if (transcriptResponse.ok) {
      const transcriptData = await transcriptResponse.json()
      transcript = transcriptData.transcript || []
      console.log(`✅ Transcript fetched: ${transcript.length} messages`)
    } else {
      console.warn('⚠️ Could not fetch transcript')
    }

    // Step 4: Calculate duration from ElevenLabs data
    let durationSeconds = session.duration_seconds
    if (conversation.start_time_unix_secs && conversation.end_time_unix_secs) {
      durationSeconds = conversation.end_time_unix_secs - conversation.start_time_unix_secs
      console.log(`📊 Calculated duration from ElevenLabs: ${durationSeconds}s`)
    } else if (conversation.call_duration_secs) {
      durationSeconds = conversation.call_duration_secs
      console.log(`📊 Using call_duration_secs: ${durationSeconds}s`)
    }

    // Step 5: Update session with conversation details
    console.log('4️⃣ Updating session with conversation details...')
    const updateData: any = {
      elevenlabs_conversation_id: conversationId,
      conversation_transcript: transcript.length > 0 ? transcript : session.conversation_transcript,
      duration_seconds: durationSeconds
    }

    // Update completed_at if session is still in_progress and conversation has ended
    if (session.status === 'in_progress' && conversation.end_time_unix_secs) {
      updateData.completed_at = new Date(conversation.end_time_unix_secs * 1000).toISOString()
      updateData.status = 'completed'
      console.log('📝 Marking session as completed')
    }

    const { error: updateError } = await supabase
      .from('training_sessions')
      .update(updateData)
      .eq('id', sessionId)

    if (updateError) {
      console.error('❌ Failed to update session:', updateError)
      throw updateError
    }

    console.log('✅ Session updated successfully')

    // Step 6: If this is a theory session and has transcript, trigger assessment
    let assessmentTriggered = false
    if ((session.training_mode === 'theory_qa' || session.training_mode === 'theory') && transcript.length > 0) {
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
          assessmentTriggered = true
          console.log('✅ Theory assessment triggered')
        } else {
          console.warn('⚠️ Theory assessment failed (non-critical)')
        }
      } catch (error) {
        console.warn('⚠️ Could not trigger theory assessment:', error)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Conversation linked successfully',
      session: {
        id: sessionId,
        elevenlabs_conversation_id: conversationId,
        transcript_messages: transcript.length,
        duration_seconds: durationSeconds,
        duration_formatted: `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`,
        status: updateData.status || session.status,
        assessment_triggered: assessmentTriggered
      }
    })

  } catch (error) {
    console.error('❌ Failed to link conversation:', error)
    return NextResponse.json(
      {
        error: 'Failed to link conversation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
