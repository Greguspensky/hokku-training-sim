import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Add GET handler for testing
export async function GET() {
  console.log('🔍 API: GET /api/save-training-session called')
  return NextResponse.json({
    message: 'This endpoint only accepts POST requests',
    methods: ['POST']
  })
}

export async function POST(request: NextRequest) {
  console.log('📥 API: POST /api/save-training-session called')

  try {
    const sessionData = await request.json()
    console.log('📝 API: Received session data:', Object.keys(sessionData))

    // Insert the training session using service role (bypasses RLS)
    const { data, error } = await supabase
      .from('training_sessions')
      .insert(sessionData)
      .select()
      .single()

    if (error) {
      console.error('❌ API: Database error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    console.log('✅ API: Session saved successfully:', data.id)

    return NextResponse.json({
      success: true,
      session: data
    })

  } catch (error: any) {
    console.error('❌ API: Exception saving session:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
