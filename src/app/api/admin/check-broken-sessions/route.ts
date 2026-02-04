import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'email parameter required' }, { status: 400 });
    }

    console.log(`🔍 Finding user: ${email}`);

    // Find user
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('email', email);

    if (userError) {
      console.error('❌ Error finding user:', userError);
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = users[0];
    console.log(`✅ Found user: ${user.name} (${user.email})`);

    // Find unanalyzed theory sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('training_sessions')
      .select(`
        id,
        training_mode,
        language,
        elevenlabs_conversation_id,
        conversation_transcript,
        theory_assessment_results,
        started_at,
        ended_at,
        created_at
      `)
      .eq('employee_id', user.id)
      .eq('training_mode', 'theory')
      .is('theory_assessment_results', null)
      .order('created_at', { ascending: false });

    if (sessionsError) {
      console.error('❌ Error finding sessions:', sessionsError);
      return NextResponse.json({ error: sessionsError.message }, { status: 500 });
    }

    console.log(`📊 Found ${sessions.length} unanalyzed theory sessions`);

    const brokenSessions = sessions.filter(session => {
      const hasConvId = !!session.elevenlabs_conversation_id;
      const hasTranscript = session.conversation_transcript &&
                            Array.isArray(session.conversation_transcript) &&
                            session.conversation_transcript.length > 0;
      return !hasConvId && !hasTranscript;
    });

    const recoverableSessions = sessions.filter(session => {
      const hasConvId = !!session.elevenlabs_conversation_id;
      const hasTranscript = session.conversation_transcript &&
                            Array.isArray(session.conversation_transcript) &&
                            session.conversation_transcript.length > 0;
      return hasConvId && !hasTranscript;
    });

    return NextResponse.json({
      success: true,
      user: {
        name: user.name,
        email: user.email,
        id: user.id
      },
      totalUnanalyzed: sessions.length,
      brokenSessions: brokenSessions.map(s => ({
        id: s.id,
        language: s.language,
        started_at: s.started_at,
        ended_at: s.ended_at,
        hasConvId: false,
        hasTranscript: false
      })),
      recoverableSessions: recoverableSessions.map(s => ({
        id: s.id,
        language: s.language,
        elevenlabs_conversation_id: s.elevenlabs_conversation_id,
        started_at: s.started_at,
        ended_at: s.ended_at,
        hasConvId: true,
        hasTranscript: false
      }))
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionIds } = body;

    if (!sessionIds || !Array.isArray(sessionIds)) {
      return NextResponse.json({ error: 'sessionIds array required' }, { status: 400 });
    }

    console.log(`🗑️  Deleting ${sessionIds.length} broken sessions...`);

    const { data, error } = await supabase
      .from('training_sessions')
      .delete()
      .in('id', sessionIds)
      .select();

    if (error) {
      console.error('❌ Error deleting sessions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`✅ Deleted ${data.length} sessions`);

    return NextResponse.json({
      success: true,
      deleted: data.length,
      sessionIds: data.map(s => s.id)
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
