import { NextRequest, NextResponse } from 'next/server'

const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY!

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const conversationId = searchParams.get('conversationId')

  if (!conversationId) {
    return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 })
  }

  try {
    const convResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
      {
        headers: {
          'xi-api-key': elevenlabsApiKey
        }
      }
    )

    if (!convResponse.ok) {
      const errorText = await convResponse.text()
      return NextResponse.json({
        error: 'Failed to fetch from ElevenLabs',
        status: convResponse.status,
        details: errorText
      }, { status: convResponse.status })
    }

    const convData = await convResponse.json()

    // Extract relevant fields for inspection
    const inspection = {
      conversation_id: convData.conversation_id,
      agent_id: convData.agent_id,
      status: convData.status,
      metadata: convData.metadata,
      transcript_length: convData.transcript?.length || 0,
      transcript_preview: convData.transcript?.slice(0, 3).map((msg: any) => ({
        role: msg.role,
        message: msg.message?.substring(0, 100),
        timestamp: msg.timestamp,
        end_timestamp: msg.end_timestamp
      })),
      transcript_last: convData.transcript?.slice(-1).map((msg: any) => ({
        role: msg.role,
        message: msg.message?.substring(0, 100),
        timestamp: msg.timestamp,
        end_timestamp: msg.end_timestamp
      })),
      available_fields: Object.keys(convData)
    }

    return NextResponse.json({
      inspection,
      raw_data: convData
    })

  } catch (error: any) {
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 })
  }
}
