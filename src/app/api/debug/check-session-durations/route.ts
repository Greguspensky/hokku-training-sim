import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const email = searchParams.get('email') || 'irina@4elem.elem'

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Find the user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', email)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found', details: userError }, { status: 404 })
    }

    // Get sessions for this user
    const { data: sessions, error: sessionsError } = await supabase
      .from('training_sessions')
      .select('id, session_name, started_at, ended_at, session_duration_seconds, training_mode, elevenlabs_conversation_id, conversation_transcript')
      .eq('employee_id', user.id)
      .order('started_at', { ascending: false })
      .limit(20)

    if (sessionsError || !sessions) {
      return NextResponse.json({ error: 'Error fetching sessions', details: sessionsError }, { status: 500 })
    }

    const results = sessions.map(session => {
      const startedAt = new Date(session.started_at)
      const endedAt = new Date(session.ended_at)
      const calculatedDuration = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)
      const storedDuration = session.session_duration_seconds
      const transcriptLength = session.conversation_transcript?.length || 0

      return {
        id: session.id,
        session_name: session.session_name,
        training_mode: session.training_mode,
        elevenlabs_conversation_id: session.elevenlabs_conversation_id,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        stored_duration_seconds: storedDuration,
        calculated_duration_seconds: calculatedDuration,
        transcript_messages: transcriptLength,
        has_mismatch: storedDuration !== calculatedDuration,
        is_zero_duration: storedDuration === 0,
        should_be_fixed: storedDuration === 0 && calculatedDuration > 0
      }
    })

    const needsFix = results.filter(r => r.should_be_fixed)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      total_sessions: sessions.length,
      sessions_with_zero_duration: results.filter(r => r.is_zero_duration).length,
      sessions_needing_fix: needsFix.length,
      sessions: results,
      fix_ids: needsFix.map(r => r.id)
    })
  } catch (error: any) {
    console.error('❌ Error checking session durations:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}
