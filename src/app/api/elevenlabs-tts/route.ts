import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { text, language = 'en' } = await request.json()

    if (!text) {
      return NextResponse.json(
        { success: false, error: 'Text is required' },
        { status: 400 }
      )
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'ElevenLabs API key not configured' },
        { status: 500 }
      )
    }

    console.log(`🔊 Generating TTS for text: "${text.slice(0, 50)}..." in language: ${language}`)

    // Use ElevenLabs v3 model for audio tags support ([excited], [happy], [pause], etc.)
    // IMPORTANT: Only v3 models support audio tags - v2.5 models will pronounce them as text
    // Voice: TX3LPaxmHKxFdv7VOQHJ - Selected for better audio tags support and emotional range
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/TX3LPaxmHKxFdv7VOQHJ', {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_v3', // v3 model required for audio tags support
        optimize_streaming_latency: 3, // 0-4: higher = faster generation (3 = good balance of speed/quality)
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          style: 0.0,
          use_speaker_boost: true
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ ElevenLabs API error:', response.status, errorText)
      return NextResponse.json(
        { success: false, error: 'Failed to generate speech' },
        { status: 500 }
      )
    }

    // Get the audio data as a buffer
    const audioBuffer = await response.arrayBuffer()

    console.log(`✅ Generated TTS audio: ${audioBuffer.byteLength} bytes`)

    // Return the audio data as a response
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    })

  } catch (error) {
    console.error('❌ Error in TTS API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}