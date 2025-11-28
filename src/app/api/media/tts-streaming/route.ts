import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, language = 'en', streaming = false } = body

    if (!text) {
      return NextResponse.json(
        { success: false, error: 'Text is required' },
        { status: 400 }
      )
    }

    console.log(`🗣️ ${streaming ? 'Streaming' : 'Standard'} TTS request: "${text.substring(0, 50)}..." in ${language}`)

    // Try ElevenLabs first
    const elevenlabsKey = process.env.ELEVENLABS_API_KEY
    if (elevenlabsKey && streaming) {
      try {
        const streamingResponse = await generateElevenlabsStreamingAudio(text, language, elevenlabsKey)
        if (streamingResponse.ok) {
          console.log('✅ Using ElevenLabs streaming TTS')
          return streamingResponse
        }
      } catch (error) {
        console.warn('⚠️ ElevenLabs streaming failed, falling back to standard TTS:', error)
      }
    }

    // Standard TTS fallback (existing logic)
    if (elevenlabsKey) {
      try {
        const voiceId = getVoiceIdForLanguage(language)
        const modelId = getModelForLanguage(language, false)

        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': elevenlabsKey
          },
          body: JSON.stringify({
            text,
            model_id: modelId,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.0,
              use_speaker_boost: true
            }
          })
        })

        if (response.ok) {
          const audioBuffer = await response.arrayBuffer()
          const base64Audio = Buffer.from(audioBuffer).toString('base64')

          console.log(`✅ ElevenLabs TTS generated ${audioBuffer.byteLength} bytes`)
          return NextResponse.json({
            success: true,
            audioData: base64Audio,
            duration: estimateAudioDuration(text),
            provider: 'elevenlabs'
          })
        }
      } catch (error) {
        console.warn('⚠️ ElevenLabs failed, using browser TTS fallback:', error)
      }
    }

    // Browser TTS fallback
    console.log('🔄 Using browser TTS fallback')
    return NextResponse.json({
      success: true,
      audioData: null, // No audio data - will trigger browser TTS on client
      text: text,
      language: language,
      duration: estimateAudioDuration(text),
      provider: 'browser'
    })

  } catch (error) {
    console.error('❌ TTS error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'TTS failed'
      },
      { status: 500 }
    )
  }
}

/**
 * Generate streaming audio with ElevenLabs
 */
async function generateElevenlabsStreamingAudio(
  text: string,
  language: string,
  apiKey: string
): Promise<Response> {
  // ElevenLabs streaming endpoint
  const voiceId = getVoiceIdForLanguage(language)
  const modelId = getModelForLanguage(language, true) // Use streaming-optimized model
  const streamingUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`

  console.log(`🎙️ Using ElevenLabs model: ${modelId} for language: ${language}`)

  const response = await fetch(streamingUrl, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true
      },
      output_format: 'mp3_44100_128' // Optimized for streaming
    })
  })

  if (response.ok) {
    // Return streaming response directly
    return new Response(response.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache'
      }
    })
  }

  throw new Error(`ElevenLabs streaming failed: ${response.statusText}`)
}

/**
 * Get optimal model for language and use case
 */
function getModelForLanguage(language: string, streaming: boolean = false): string {
  // For real-time conversation, prioritize ultra-low latency
  if (streaming) {
    // Eleven Flash v2.5: Ultra-low latency (~75ms), 32 languages
    const flashSupportedLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi']
    if (flashSupportedLanguages.includes(language)) {
      return 'eleven_flash_v2_5'
    }
  }

  // For multilingual support (29 languages including Georgian)
  const multilingualLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'ka', 'ja', 'ko', 'zh']
  if (multilingualLanguages.includes(language)) {
    return 'eleven_multilingual_v2'
  }

  // Default to latest turbo model
  return 'eleven_turbo_v2_5'
}

/**
 * Get voice ID based on language
 */
function getVoiceIdForLanguage(language: string): string {
  const voiceMap: Record<string, string> = {
    en: 'pNInz6obpgDQGcFmaJgB', // Adam
    es: 'VR6AewLTigWG4xSOukaG', // Antoni
    fr: 'ThT5KcBeYPX3keUQqHPh', // Thomas
    de: 'pFZP5JQG7iQjIQuC4Bku', // Lily
    it: 'XB0fDUnXU5powFXDhCwa', // Charlotte
    pt: 'yoZ06aMxZJJ28mfd3POQ', // Sam
    nl: 'bVMeCyTHy58xNoL34h3p', // Jeremy
    pl: 'GBv7mTt0atIp3Br8iCZE', // Matilda
    ru: 'pNInz6obpgDQGcFmaJgB', // Adam-Multilingual
    ka: 'pNInz6obpgDQGcFmaJgB', // Adam-Multilingual
    ja: 'AZnzlk1XvdvUeBnXmlld', // Domi
    ko: 'EXAVITQu4vr4xnSDxMaL', // Bella
    zh: 'ErXwobaYiN019PkySvjV'  // Antoni
  }

  return voiceMap[language] || voiceMap.en
}

/**
 * Estimate audio duration based on text length
 */
function estimateAudioDuration(text: string): number {
  const wordsPerMinute = 150
  const wordCount = text.split(' ').length
  const durationMinutes = wordCount / wordsPerMinute
  return Math.max(1000, durationMinutes * 60 * 1000) // At least 1 second
}