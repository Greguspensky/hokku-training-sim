import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const sessionId = searchParams.get('sessionId')

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Get session data
    const { data: session, error: sessionError } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found', details: sessionError }, { status: 404 })
    }

    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', session.employee_id)
      .single()

    // Get scenario info
    let scenario = null
    if (session.scenario_id) {
      const { data: scenarioData } = await supabase
        .from('scenarios')
        .select('id, title, scenario_type')
        .eq('id', session.scenario_id)
        .single()
      scenario = scenarioData
    }

    const inspection = {
      session: {
        id: session.id,
        session_name: session.session_name,
        training_mode: session.training_mode,
        language: session.language,
        started_at: session.started_at,
        ended_at: session.ended_at,
        session_duration_seconds: session.session_duration_seconds,
        recording_preference: session.recording_preference,
        audio_recording_url: session.audio_recording_url,
        video_recording_url: session.video_recording_url,
        elevenlabs_conversation_id: session.elevenlabs_conversation_id,
        conversation_transcript: session.conversation_transcript,
        transcript_length: session.conversation_transcript?.length || 0,
        has_audio: !!session.audio_recording_url,
        has_video: !!session.video_recording_url,
        has_elevenlabs_conv: !!session.elevenlabs_conversation_id,
        has_transcript: session.conversation_transcript && session.conversation_transcript.length > 0
      },
      user,
      scenario,
      diagnosis: {
        has_conversation_id: !!session.elevenlabs_conversation_id,
        has_local_transcript: session.conversation_transcript && session.conversation_transcript.length > 0,
        has_recording: !!(session.audio_recording_url || session.video_recording_url),
        duration_is_zero: session.session_duration_seconds === 0,
        transcript_is_placeholder: session.conversation_transcript &&
                                   session.conversation_transcript.length === 1 &&
                                   session.conversation_transcript[0]?.content?.includes('use "Get Transcript'),
        needs_elevenlabs_fetch: !!session.elevenlabs_conversation_id &&
                               (!session.conversation_transcript || session.conversation_transcript.length <= 1)
      }
    }

    return NextResponse.json(inspection)

  } catch (error: any) {
    console.error('❌ Error inspecting session:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}
