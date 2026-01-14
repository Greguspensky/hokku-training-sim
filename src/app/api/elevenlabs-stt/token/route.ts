import { NextRequest, NextResponse } from 'next/server'

/**
 * ElevenLabs Single-Use Token Generation API
 *
 * Generates a time-limited (15 minutes) single-use token for client-side
 * WebSocket authentication with ElevenLabs Scribe V2 Realtime.
 *
 * This prevents exposing the API key in client-side code.
 *
 * Endpoint: POST /api/elevenlabs-stt/token
 * Response: { token: "single-use-token" }
 *
 * Documentation: https://elevenlabs.io/docs/api-reference/tokens/create
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY

    if (!apiKey) {
      console.error('❌ ELEVENLABS_API_KEY not configured')
      return NextResponse.json(
        { success: false, error: 'ElevenLabs API key not configured' },
        { status: 500 }
      )
    }

    console.log('🔑 Generating ElevenLabs single-use token for Scribe V2 Realtime...')

    // Call ElevenLabs token generation endpoint
    const response = await fetch('https://api.elevenlabs.io/v1/single-use-token/realtime_scribe', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ ElevenLabs token generation failed:', response.status, errorText)

      return NextResponse.json(
        {
          success: false,
          error: `Token generation failed: ${response.status} ${response.statusText}`
        },
        { status: response.status }
      )
    }

    const data = await response.json()

    if (!data.token) {
      console.error('❌ No token in response:', data)
      return NextResponse.json(
        { success: false, error: 'Token not returned from ElevenLabs API' },
        { status: 500 }
      )
    }

    console.log('✅ Single-use token generated successfully (expires in 15 minutes)')

    return NextResponse.json({
      success: true,
      token: data.token
    })

  } catch (error) {
    console.error('❌ Token generation error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Token generation failed'
      },
      { status: 500 }
    )
  }
}
