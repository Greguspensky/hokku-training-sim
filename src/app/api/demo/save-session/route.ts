import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase admin client with service role
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/**
 * Save/update a demo training session
 * Updates conversation transcript, duration, and other metrics
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      conversationTranscript,
      sessionDurationSeconds,
      messageCount,
    } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      );
    }

    console.log(`🔄 Saving demo session: ${sessionId}`);
    console.log(`   Duration: ${sessionDurationSeconds}s, Messages: ${messageCount}`);

    // Validate conversation transcript format
    if (conversationTranscript && Array.isArray(conversationTranscript)) {
      const isValid = conversationTranscript.every(
        (msg: any) =>
          msg.role && msg.content && typeof msg.timestamp === 'number'
      );

      if (!isValid) {
        console.warn('⚠️ Invalid conversation transcript format');
      }
    }

    // Update the session record
    const { data, error } = await supabaseAdmin
      .from('demo_training_sessions')
      .update({
        conversation_transcript: conversationTranscript || [],
        session_duration_seconds: sessionDurationSeconds || 0,
        message_count: messageCount || 0,
        ended_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to save demo session:', error);
      return NextResponse.json(
        {
          error: 'Failed to save session',
          details: error.message,
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          error: 'Session not found',
          message: 'No demo session found with this ID',
        },
        { status: 404 }
      );
    }

    console.log(`✅ Demo session saved: ${sessionId}`);

    return NextResponse.json({
      success: true,
      sessionId: data.session_id,
      saved: {
        duration: data.session_duration_seconds,
        messages: data.message_count,
        endedAt: data.ended_at,
      },
    });
  } catch (error: any) {
    console.error('❌ Error saving demo session:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Get demo session data (for analytics/debugging)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId parameter' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('demo_training_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Return session data (sanitized for client)
    return NextResponse.json({
      sessionId: data.session_id,
      duration: data.session_duration_seconds,
      messageCount: data.message_count,
      language: data.language,
      deviceType: data.device_type,
      startedAt: data.started_at,
      endedAt: data.ended_at,
      // Don't return: ip_address, user_agent, conversation_transcript (privacy)
    });
  } catch (error: any) {
    console.error('❌ Error fetching demo session:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
