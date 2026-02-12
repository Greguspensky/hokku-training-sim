/**
 * Fetch transcript from ElevenLabs and trigger theory assessment
 * POST /api/debug/fetch-transcript-and-analyze
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

    console.log('🔄 Fetching transcript and triggering theory analysis:', sessionId)

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Get session
    const { data: session, error: sessionError } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      throw new Error('Session not found')
    }

    const conversationId = session.elevenlabs_conversation_id
    if (!conversationId) {
      throw new Error('No ElevenLabs conversation ID')
    }

    console.log('✅ Session found, conversation ID:', conversationId)

    // Step 2: Fetch transcript from ElevenLabs
    console.log('📝 Fetching transcript from ElevenLabs...')
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

    if (transcript.length === 0) {
      throw new Error('Transcript is empty - no conversation data')
    }

    // Step 3: Fetch conversation metadata for duration
    console.log('⏱️ Fetching conversation metadata...')
    const convResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
      {
        headers: {
          'xi-api-key': elevenLabsApiKey
        }
      }
    )

    let duration = 598 // Default to 9:58 if we can't get it from API
    if (convResponse.ok) {
      const convData = await convResponse.json()
      if (convData.call_duration_secs) {
        duration = convData.call_duration_secs
      } else if (convData.end_time_unix_secs && convData.start_time_unix_secs) {
        duration = convData.end_time_unix_secs - convData.start_time_unix_secs
      }
      console.log(`✅ Duration: ${duration}s`)
    }

    // Step 4: Update session with transcript and duration
    console.log('💾 Updating session with transcript...')
    const { error: updateError } = await supabase
      .from('training_sessions')
      .update({
        conversation_transcript: transcript,
        session_duration_seconds: duration
      })
      .eq('id', sessionId)

    if (updateError) {
      throw updateError
    }
    console.log('✅ Session updated')

    // Step 5: Trigger theory assessment
    console.log('🧠 Triggering theory assessment...')
    const assessResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/assessment/assess-theory-session`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      }
    )

    if (!assessResponse.ok) {
      const errorText = await assessResponse.text()
      throw new Error(`Assessment failed: ${errorText}`)
    }

    const assessData = await assessResponse.json()
    console.log('✅ Assessment completed')

    return NextResponse.json({
      success: true,
      message: 'Transcript fetched and analysis completed',
      transcript: {
        message_count: transcript.length,
        duration_seconds: duration
      },
      assessment: assessData.assessment
    })

  } catch (error) {
    console.error('❌ Failed:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch transcript and analyze',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
