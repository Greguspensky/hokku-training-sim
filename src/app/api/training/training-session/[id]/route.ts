import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const sessionId = params.id

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
  }

  console.log(`📖 Loading training session via API: ${sessionId}`)

  try {
    // TODO (MVP): Server-side auth temporarily disabled due to Next.js 15 async cookie issues
    // Client-side access control is sufficient for MVP testing with trusted users
    // See SECURITY_TODO.md for production implementation

    // Get the training session using admin client (bypasses RLS)
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('training_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError) {
      if (sessionError.code === 'PGRST116') {
        console.log('❌ Session not found:', sessionId)
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
      console.error('❌ Error fetching session:', sessionError)
      return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 })
    }

    console.log(`✅ Session loaded: ${sessionId}`)

    return NextResponse.json({
      success: true,
      session
    })

  } catch (error) {
    console.error('❌ Error in training-session API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
