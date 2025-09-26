import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { ttsService } from '@/lib/tts-service'
import { type SupportedLanguageCode } from '@/lib/avatar-types'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    const demoUser = user || {
      id: 'demo-user',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'employee'
    }

    const body = await request.json()
    const { text, language = 'en', returnUrl = false } = body

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'text is required and must be a string' },
        { status: 400 }
      )
    }

    if (text.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'text must be less than 1000 characters' },
        { status: 400 }
      )
    }

    const languageCode = language as SupportedLanguageCode

    if (!ttsService.getVoiceForLanguage(languageCode)) {
      return NextResponse.json(
        { success: false, error: `Unsupported language: ${language}` },
        { status: 400 }
      )
    }

    let result

    if (returnUrl) {
      const audioUrl = await ttsService.synthesizeSpeechFromURL(text, languageCode)
      result = {
        success: true,
        audioUrl,
        language: languageCode,
        voice: ttsService.getVoiceForLanguage(languageCode),
        estimatedDurationMs: await ttsService.estimateAudioDuration(text, languageCode)
      }
    } else {
      const audioBuffer = await ttsService.synthesizeSpeech(text, languageCode)

      const audioBytes = new Uint8Array(audioBuffer)
      const audioBase64 = Buffer.from(audioBytes).toString('base64')

      result = {
        success: true,
        audioData: audioBase64,
        mimeType: 'audio/mpeg',
        language: languageCode,
        voice: ttsService.getVoiceForLanguage(languageCode),
        estimatedDurationMs: await ttsService.estimateAudioDuration(text, languageCode)
      }
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('TTS synthesis error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to synthesize speech'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    const demoUser = user || {
      id: 'demo-user',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'employee'
    }

    const voices = await ttsService.getAvailableVoices()

    return NextResponse.json({
      success: true,
      voices,
      supportedLanguages: voices.map(v => v.language).filter((value, index, self) => self.indexOf(value) === index)
    })

  } catch (error) {
    console.error('Get TTS voices error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch TTS voices'
      },
      { status: 500 }
    )
  }
}