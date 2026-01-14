import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { apiErrorHandler, createSuccessResponse, parseRequestBody } from '@/lib/utils/api'

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
    const sessionData = await parseRequestBody<any>(request)
    console.log('📝 API: Received session data:', Object.keys(sessionData))

    // Upsert the training session using service role (bypasses RLS)
    // This allows for both insert (new session) and update (duplicate call) without errors
    const { data, error } = await supabase
      .from('training_sessions')
      .upsert(sessionData, {
        onConflict: 'id', // Update if ID already exists
        ignoreDuplicates: false // Always return the record
      })
      .select()
      .single()

    if (error) {
      console.error('❌ API: Database error:', error)
      throw error
    }

    console.log('✅ API: Session saved/updated successfully:', data.id)

    // Return session directly (not wrapped in data object) to match client expectations
    return NextResponse.json({
      success: true,
      session: data
    })

  } catch (error: any) {
    return apiErrorHandler(error, 'Save training session')
  }
}
