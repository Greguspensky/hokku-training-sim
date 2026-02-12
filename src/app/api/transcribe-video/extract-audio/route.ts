import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink } from 'fs/promises'
import path from 'path'
import os from 'os'

const execAsync = promisify(exec)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

export const maxDuration = 300 // 5 minutes for large videos
export const dynamic = 'force-dynamic'

async function checkFfmpegAvailable(): Promise<boolean> {
  try {
    await execAsync('ffmpeg -version')
    return true
  } catch {
    return false
  }
}

async function extractAudioWithFfmpeg(videoPath: string, audioPath: string): Promise<void> {
  // Extract audio and compress to MP3 with lower bitrate
  await execAsync(`ffmpeg -i "${videoPath}" -vn -acodec libmp3lame -b:a 64k -ar 16000 -ac 1 "${audioPath}"`)
}

export async function POST(request: NextRequest) {
  let videoPath: string | null = null
  let audioPath: string | null = null

  try {
    const { sessionId, forceReTranscribe } = await request.json()

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 }
      )
    }

    console.log('🔍 Transcribing large video for session:', sessionId)

    // Check if ffmpeg is available
    const hasFfmpeg = await checkFfmpegAvailable()
    console.log('FFmpeg available:', hasFfmpeg)

    if (!hasFfmpeg) {
      return NextResponse.json(
        {
          success: false,
          error: 'FFmpeg is required to process large videos. Please install FFmpeg: brew install ffmpeg (macOS) or apt-get install ffmpeg (Linux)',
          requiresFfmpeg: true
        },
        { status: 400 }
      )
    }

    // 1. Get session data
    const { data: session, error: sessionError } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      )
    }

    // Check if already has transcript
    if (session.transcript && session.transcript.trim().length > 0 && !forceReTranscribe) {
      return NextResponse.json({
        success: true,
        message: 'Session already has transcript',
        transcript: session.transcript,
        alreadyExists: true
      })
    }

    if (!session.video_recording_url) {
      return NextResponse.json(
        { success: false, error: 'No video recording found' },
        { status: 400 }
      )
    }

    console.log('📋 Session:', session.training_mode, session.language)

    // 2. Download video from Supabase
    console.log('📥 Downloading video...')

    let bucket: string
    let storagePath: string

    if (session.video_recording_url.includes('/storage/v1/object/public/')) {
      const afterPublic = session.video_recording_url.split('/storage/v1/object/public/')[1]
      const parts = afterPublic.split('/')
      bucket = parts[0]
      storagePath = parts.slice(1).join('/')
    } else {
      bucket = 'training-videos'
      storagePath = session.video_recording_url
    }

    const { data: videoData, error: downloadError } = await supabase
      .storage
      .from(bucket)
      .download(storagePath)

    if (downloadError || !videoData) {
      return NextResponse.json(
        { success: false, error: 'Failed to download video' },
        { status: 500 }
      )
    }

    const arrayBuffer = await videoData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const videoSizeMB = (buffer.length / (1024 * 1024)).toFixed(2)

    console.log(`✅ Video downloaded: ${videoSizeMB} MB`)

    // 3. Save video to temp file
    videoPath = path.join(os.tmpdir(), `video_${sessionId}.mp4`)
    audioPath = path.join(os.tmpdir(), `audio_${sessionId}.mp3`)

    await writeFile(videoPath, buffer)
    console.log('💾 Saved to:', videoPath)

    // 4. Extract audio using ffmpeg
    console.log('🎵 Extracting audio with ffmpeg (64kbps, mono, 16kHz)...')
    await extractAudioWithFfmpeg(videoPath, audioPath)

    // Check audio file size
    const audioBuffer = await require('fs/promises').readFile(audioPath)
    const audioSizeMB = (audioBuffer.length / (1024 * 1024)).toFixed(2)
    console.log(`✅ Audio extracted: ${audioSizeMB} MB`)

    if (audioBuffer.length > 25 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: `Audio file still too large (${audioSizeMB} MB) after compression. The session is very long and may need manual processing.`
        },
        { status: 400 }
      )
    }

    // 5. Transcribe with Whisper
    console.log('🎯 Transcribing audio with Whisper...')

    const audioFile = new File([audioBuffer], `audio_${sessionId}.mp3`, { type: 'audio/mpeg' })

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: session.language || undefined,
      response_format: 'verbose_json',
      timestamp_granularities: ['segment']
    })

    console.log('✅ Transcription completed!')
    console.log('- Text length:', transcription.text.length, 'characters')
    console.log('- Duration:', transcription.duration, 'seconds')

    // 6. Update session
    console.log('💾 Updating session...')

    const { error: updateError } = await supabase
      .from('training_sessions')
      .update({
        transcript: transcription.text,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (updateError) {
      return NextResponse.json(
        { success: false, error: 'Failed to update session' },
        { status: 500 }
      )
    }

    // Cleanup
    if (videoPath) await unlink(videoPath).catch(() => {})
    if (audioPath) await unlink(audioPath).catch(() => {})

    console.log('✅ Success!')

    return NextResponse.json({
      success: true,
      transcript: transcription.text,
      duration: transcription.duration,
      language: transcription.language,
      segments: transcription.segments?.length || 0,
      videoSize: videoSizeMB + ' MB',
      audioSize: audioSizeMB + ' MB',
      message: 'Video transcribed successfully (with audio extraction)'
    })

  } catch (error: any) {
    console.error('❌ Transcription error:', error)

    // Cleanup on error
    if (videoPath) await unlink(videoPath).catch(() => {})
    if (audioPath) await unlink(audioPath).catch(() => {})

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to transcribe video'
      },
      { status: 500 }
    )
  }
}
