import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  checkDemoRateLimit,
  extractClientIP,
  extractUserAgent,
  detectDeviceType,
  getRemainingDemoSessions,
} from '@/lib/demo-rate-limit';

const DEMO_SCENARIO_ID = '13a2c2f3-24fc-4f20-abd6-f3ab2a7abc01';

// Supabase admin client with service role
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Start a new demo training session
 * Creates a record in demo_training_sessions for tracking
 * Enforces rate limiting (5 sessions per hour per IP)
 */
export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      const text = await request.text();
      if (!text || text.trim() === '') {
        console.error('❌ Empty request body');
        return NextResponse.json(
          { error: 'Empty request body' },
          { status: 400 }
        );
      }
      body = JSON.parse(text);
    } catch (jsonError) {
      console.error('❌ Failed to parse JSON body:', jsonError);
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { sessionId, language = 'en' } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      );
    }

    // Extract client information
    const ip = extractClientIP(request.headers);
    const userAgent = extractUserAgent(request.headers);
    const deviceType = detectDeviceType(userAgent);
    const referrer = request.headers.get('referer') || null;

    console.log(`🔄 Starting demo session: ${sessionId}`);
    console.log(`   IP: ${ip}, Device: ${deviceType}`);

    // Check rate limit
    const isAllowed = await checkDemoRateLimit(ip);

    if (!isAllowed) {
      const remaining = await getRemainingDemoSessions(ip);
      console.warn(`⚠️ Rate limit exceeded for IP ${ip}`);

      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'You have reached the maximum number of demo sessions for this hour. Please try again later.',
          remaining,
          retryAfter: 3600, // seconds
        },
        { status: 429 }
      );
    }

    // Check if session already exists (handles page refreshes)
    const { data: existing } = await supabaseAdmin
      .from('demo_training_sessions')
      .select('session_id')
      .eq('session_id', sessionId)
      .single();

    let data;

    if (existing) {
      // Session already exists, just return success
      console.log(`♻️ Demo session already exists: ${sessionId}`);
      data = existing;
    } else {
      // Create new session record
      const { data: newSession, error } = await supabaseAdmin
        .from('demo_training_sessions')
        .insert({
          session_id: sessionId,
          scenario_id: DEMO_SCENARIO_ID,
          ip_address: ip,
          user_agent: userAgent,
          language,
          device_type: deviceType,
          referrer,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        // Check if it's a duplicate key error (race condition)
        if (error.code === '23505') {
          console.log(`♻️ Race condition: Session ${sessionId} was created by another request`);
          // Try to fetch the session that was just created
          const { data: raceSession } = await supabaseAdmin
            .from('demo_training_sessions')
            .select('session_id')
            .eq('session_id', sessionId)
            .single();

          if (raceSession) {
            data = raceSession;
          } else {
            console.error('❌ Failed to create demo session:', error);
            return NextResponse.json(
              {
                error: 'Failed to start session',
                details: error.message,
              },
              { status: 500 }
            );
          }
        } else {
          console.error('❌ Failed to create demo session:', error);
          return NextResponse.json(
            {
              error: 'Failed to start session',
              details: error.message,
            },
            { status: 500 }
          );
        }
      } else {
        data = newSession;
      }
    }

    console.log(`✅ Demo session started: ${sessionId}`);

    // Get remaining sessions for this IP
    const remaining = await getRemainingDemoSessions(ip);

    return NextResponse.json({
      success: true,
      sessionId: data.session_id,
      remaining,
    });
  } catch (error: any) {
    console.error('❌ Error starting demo session:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
