/**
 * Debug endpoint to check user sessions
 * GET /api/debug/user-sessions?email=user@example.com
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name, role, created_at, company_id')
      .eq('email', email)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found', details: userError },
        { status: 404 }
      )
    }

    // Get training sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('training_sessions')
      .select(`
        id,
        employee_id,
        training_mode,
        scenario_id,
        started_at,
        ended_at,
        session_duration_seconds,
        elevenlabs_conversation_id,
        video_recording_url,
        audio_recording_url,
        conversation_transcript,
        assessment_status,
        created_at
      `)
      .eq('employee_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError)
    }

    // Analyze sessions
    const analysis = {
      totalSessions: sessions?.length || 0,
      sessionsWithElevenLabs: sessions?.filter(s => s.elevenlabs_conversation_id).length || 0,
      sessionsWithVideo: sessions?.filter(s => s.video_recording_url).length || 0,
      sessionsWithAudio: sessions?.filter(s => s.audio_recording_url).length || 0,
      sessionsWithTranscript: sessions?.filter(s => s.conversation_transcript?.length > 0).length || 0,
      completedSessions: sessions?.filter(s => s.ended_at && s.assessment_status === 'completed').length || 0,
      inProgressSessions: sessions?.filter(s => !s.ended_at || s.assessment_status === 'pending').length || 0,
    }

    // Check for common issues
    const issues = []

    if (analysis.totalSessions > 0 && analysis.sessionsWithElevenLabs === 0) {
      issues.push('⚠️ No sessions have ElevenLabs conversation ID - ElevenLabs connection may be failing')
    }

    if (analysis.totalSessions > 0 && analysis.sessionsWithVideo === 0 && analysis.sessionsWithAudio === 0) {
      issues.push('⚠️ No sessions have video or audio recordings - Recording may be failing')
    }

    if (analysis.totalSessions > 0 && analysis.sessionsWithTranscript === 0) {
      issues.push('⚠️ No sessions have transcripts - Conversation may not be happening')
    }

    if (analysis.inProgressSessions > 0) {
      issues.push(`ℹ️ ${analysis.inProgressSessions} session(s) are still in progress`)
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company_id: user.company_id,
        created_at: user.created_at
      },
      analysis,
      issues,
      sessions: sessions?.map(s => ({
        id: s.id,
        training_mode: s.training_mode,
        assessment_status: s.assessment_status,
        started_at: s.started_at,
        ended_at: s.ended_at,
        duration_seconds: s.session_duration_seconds,
        has_elevenlabs: !!s.elevenlabs_conversation_id,
        elevenlabs_conversation_id: s.elevenlabs_conversation_id,
        has_video: !!s.video_recording_url,
        has_audio: !!s.audio_recording_url,
        transcript_length: s.conversation_transcript?.length || 0,
        created_at: s.created_at
      }))
    })

  } catch (error) {
    console.error('❌ Error in debug endpoint:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
