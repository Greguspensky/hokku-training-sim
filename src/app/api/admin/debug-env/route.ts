import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const envVars = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'present' : 'missing',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'present' : 'missing',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'missing',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'present' : 'missing',
      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY ? 'present' : 'missing'
    }

    return NextResponse.json({
      success: true,
      environment: 'production',
      environmentVariables: envVars
    })

  } catch (error) {
    console.error('Debug env error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check environment'
      },
      { status: 500 }
    )
  }
}