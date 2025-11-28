import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { sttService } from '@/lib/stt-service'
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

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const language = (formData.get('language') as string) || 'en'

    if (!audioFile) {
      return NextResponse.json(
        { success: false, error: 'audio file is required' },
        { status: 400 }
      )
    }

    if (audioFile.size === 0) {
      return NextResponse.json(
        { success: false, error: 'audio file is empty' },
        { status: 400 }
      )
    }

    if (audioFile.size > 25 * 1024 * 1024) { // 25MB limit
      return NextResponse.json(
        { success: false, error: 'audio file must be less than 25MB' },
        { status: 400 }
      )
    }

    const allowedTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/webm', 'audio/ogg']
    if (!allowedTypes.some(type => audioFile.type.startsWith(type))) {
      return NextResponse.json(
        { success: false, error: `Unsupported audio format: ${audioFile.type}` },
        { status: 400 }
      )
    }

    const languageCode = language as SupportedLanguageCode

    console.log(`🎯 Transcribing ${audioFile.size} bytes of ${audioFile.type} audio in ${languageCode}`)

    const audioBlob = new Blob([await audioFile.arrayBuffer()], { type: audioFile.type })
    const transcription = await sttService.transcribeAudio(audioBlob, languageCode)

    return NextResponse.json({
      success: true,
      transcription,
      audioInfo: {
        size: audioFile.size,
        type: audioFile.type,
        name: audioFile.name
      }
    })

  } catch (error) {
    console.error('STT transcription error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to transcribe audio'
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

    const mediaConstraints = await sttService.getUserMediaConstraints()

    return NextResponse.json({
      success: true,
      mediaConstraints,
      supportedFormats: ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/webm', 'audio/ogg'],
      maxFileSize: 25 * 1024 * 1024,
      isRecording: sttService.isCurrentlyRecording(),
      info: {
        service: 'OpenAI Whisper',
        model: 'whisper-1',
        features: ['transcription', 'language_detection', 'continuous_recording']
      }
    })

  } catch (error) {
    console.error('Get STT info error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch STT info'
      },
      { status: 500 }
    )
  }
}