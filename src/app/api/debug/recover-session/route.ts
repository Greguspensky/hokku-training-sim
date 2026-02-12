/**
 * Manually recover a session by creating a database record
 * and linking it to an orphaned ElevenLabs conversation
 *
 * POST /api/debug/recover-session
 * Body: {
 *   conversation_id: string,
 *   user_id: string,
 *   scenario_id: string,
 *   training_mode: 'theory_qa' | 'service_practice' | 'recommendation'
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY!

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversation_id, user_id, scenario_id, training_mode } = body

    console.log('🔄 Attempting to recover session:', {
      conversation_id,
      user_id,
      scenario_id,
      training_mode
    })

    // Validate required fields
    if (!conversation_id || !user_id || !scenario_id || !training_mode) {
      return NextResponse.json(
        { error: 'Missing required fields: conversation_id, user_id, scenario_id, training_mode' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Get conversation details from ElevenLabs
    console.log('1️⃣ Fetching conversation from ElevenLabs...')
    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversation_id}`,
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

    // Step 2: Get transcript from ElevenLabs
    console.log('2️⃣ Fetching transcript...')
    const transcriptResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversation_id}/transcript`,
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

    // Step 3: Calculate session details
    const startTime = new Date(conversation.start_time_unix_secs * 1000)
    const endTime = conversation.end_time_unix_secs
      ? new Date(conversation.end_time_unix_secs * 1000)
      : new Date()
    const durationSeconds = conversation.end_time_unix_secs
      ? conversation.end_time_unix_secs - conversation.start_time_unix_secs
      : Math.floor((endTime.getTime() - startTime.getTime()) / 1000)

    // Step 4: Create session record
    console.log('3️⃣ Creating session record in database...')
    const sessionData = {
      employee_id: user_id,
      scenario_id,
      training_mode,
      status: 'completed', // Mark as completed since conversation ended
      started_at: startTime.toISOString(),
      completed_at: endTime.toISOString(),
      duration_seconds: durationSeconds,
      elevenlabs_conversation_id: conversation_id,
      conversation_transcript: transcript,
      video_url: null, // No video was saved
      audio_url: null, // No audio was saved
      created_at: startTime.toISOString(),
      // Add metadata about recovery
      metadata: {
        recovered: true,
        recovered_at: new Date().toISOString(),
        recovery_reason: 'User closed page before video upload completed',
        no_video_or_audio: true
      }
    }

    const { data: session, error: sessionError } = await supabase
      .from('training_sessions')
      .insert(sessionData)
      .select()
      .single()

    if (sessionError) {
      console.error('❌ Failed to create session:', sessionError)
      throw sessionError
    }

    console.log('✅ Session created successfully:', session.id)

    // Step 5: If this is a theory session, analyze it
    let assessmentResults = null
    if ((training_mode === 'theory_qa' || training_mode === 'theory') && transcript.length > 0) {
      console.log('4️⃣ Triggering theory assessment...')
      try {
        const assessResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/assessment/assess-theory-session`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: session.id })
          }
        )

        if (assessResponse.ok) {
          const assessData = await assessResponse.json()
          assessmentResults = assessData.assessment
          console.log('✅ Theory assessment completed')
        } else {
          console.warn('⚠️ Theory assessment failed (non-critical)')
        }
      } catch (error) {
        console.warn('⚠️ Could not trigger theory assessment:', error)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Session recovered successfully',
      session: {
        id: session.id,
        user_id: session.user_id,
        scenario_id: session.scenario_id,
        training_mode: session.training_mode,
        started_at: session.started_at,
        completed_at: session.completed_at,
        duration_seconds: session.duration_seconds,
        duration_formatted: `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`,
        transcript_messages: transcript.length,
        has_video: false,
        has_audio: false,
        assessment_completed: !!assessmentResults
      },
      assessment: assessmentResults,
      warning: 'This session was recovered without video/audio recordings'
    })

  } catch (error) {
    console.error('❌ Session recovery failed:', error)
    return NextResponse.json(
      {
        error: 'Failed to recover session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
