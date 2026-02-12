import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId

    const { data: session, error } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (error || !session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        training_mode: session.training_mode,
        language: session.language,
        video_recording_url: session.video_recording_url,
        has_transcript: !!session.transcript,
        transcript_length: session.transcript?.length || 0,
        session_duration_seconds: session.session_duration_seconds,
        created_at: session.created_at
      },
      debug: {
        video_url_type: typeof session.video_recording_url,
        video_url_length: session.video_recording_url?.length || 0,
        video_url_includes_training_videos: session.video_recording_url?.includes('training-videos') || false,
        video_url_full: session.video_recording_url
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
