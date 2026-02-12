/**
 * Fetch audio recording from ElevenLabs for a conversation
 * POST /api/debug/fetch-elevenlabs-audio
 * Body: { conversationId }
 */

import { NextRequest, NextResponse } from 'next/server'

const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY!

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversationId } = body

    console.log('🎵 Fetching audio from ElevenLabs:', conversationId)

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Missing required field: conversationId' },
        { status: 400 }
      )
    }

    // Try to get conversation metadata
    console.log('1️⃣ Checking conversation metadata...')
    const convResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
      {
        headers: {
          'xi-api-key': elevenLabsApiKey
        }
      }
    )

    if (!convResponse.ok) {
      return NextResponse.json({
        success: false,
        error: `Conversation not found (${convResponse.status})`,
        message: 'The ElevenLabs conversation does not exist or has expired',
        conversationId
      })
    }

    const conversation = await convResponse.json()
    console.log('✅ Conversation found:', conversation)

    // Try to get transcript
    console.log('2️⃣ Fetching transcript...')
    const transcriptResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/transcript`,
      {
        headers: {
          'xi-api-key': elevenLabsApiKey
        }
      }
    )

    let transcript = null
    if (transcriptResponse.ok) {
      const transcriptData = await transcriptResponse.json()
      transcript = transcriptData.transcript || []
      console.log(`✅ Transcript: ${transcript.length} messages`)
    } else {
      console.warn('⚠️ No transcript available')
    }

    // Try to get audio recording
    console.log('3️⃣ Checking for audio recording...')
    const audioResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio`,
      {
        headers: {
          'xi-api-key': elevenLabsApiKey
        }
      }
    )

    let audioAvailable = false
    let audioUrl = null

    if (audioResponse.ok) {
      // Audio exists - we could download and upload it
      audioAvailable = true
      audioUrl = `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio`
      console.log('✅ Audio recording available')
    } else {
      console.warn('⚠️ No audio recording available')
    }

    return NextResponse.json({
      success: true,
      conversation: {
        id: conversationId,
        agent_id: conversation.agent_id,
        status: conversation.status,
        start_time: conversation.start_time_unix_secs
          ? new Date(conversation.start_time_unix_secs * 1000).toISOString()
          : null,
        end_time: conversation.end_time_unix_secs
          ? new Date(conversation.end_time_unix_secs * 1000).toISOString()
          : null,
        duration_seconds: conversation.call_duration_secs ||
          (conversation.end_time_unix_secs && conversation.start_time_unix_secs
            ? conversation.end_time_unix_secs - conversation.start_time_unix_secs
            : 0)
      },
      transcript: {
        available: !!transcript,
        message_count: transcript?.length || 0,
        messages: transcript || []
      },
      audio: {
        available: audioAvailable,
        url: audioUrl
      }
    })

  } catch (error) {
    console.error('❌ Failed to fetch ElevenLabs data:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch ElevenLabs data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
