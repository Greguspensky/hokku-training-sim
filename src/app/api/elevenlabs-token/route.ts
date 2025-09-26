import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'Agent ID is required' },
        { status: 400 }
      )
    }

    const elevenlabsKey = process.env.ELEVENLABS_API_KEY
    if (!elevenlabsKey) {
      return NextResponse.json(
        { success: false, error: 'ElevenLabs API key not configured' },
        { status: 500 }
      )
    }

    console.log(`🔑 Generating conversation token for agent: ${agentId}`)

    // Simple GET request for token - no custom configuration here
    // Agent behavior is configured via dynamic variables in the conversation initialization
    const tokenUrl = `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agentId}`
    const response = await fetch(tokenUrl, {
      method: 'GET',
      headers: {
        'xi-api-key': elevenlabsKey,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ ElevenLabs token request failed:', response.status, errorText)
      return NextResponse.json(
        { success: false, error: `Token generation failed: ${response.statusText}` },
        { status: response.status }
      )
    }

    const tokenData = await response.json()

    console.log('✅ ElevenLabs conversation token generated successfully')

    return NextResponse.json({
      success: true,
      token: tokenData.token,
      agentId: agentId
    })

  } catch (error) {
    console.error('❌ ElevenLabs token generation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Token generation failed'
      },
      { status: 500 }
    )
  }
}