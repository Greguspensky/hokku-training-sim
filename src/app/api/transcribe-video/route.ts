import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { Readable } from 'stream'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

export const maxDuration = 300 // 5 minutes for large videos
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { sessionId, forceReTranscribe } = await request.json()

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 }
      )
    }

    console.log('🔍 Transcribing video for session:', sessionId)

    // 1. Get session data
    const { data: session, error: sessionError } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      console.error('❌ Session not found:', sessionError)
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      )
    }

    // Check if already has transcript
    if (session.transcript && session.transcript.trim().length > 0 && !forceReTranscribe) {
      console.log('⚠️ Session already has transcript. Use forceReTranscribe: true to override')
      return NextResponse.json({
        success: true,
        message: 'Session already has transcript',
        transcript: session.transcript,
        alreadyExists: true
      })
    }

    // Check if video exists
    if (!session.video_recording_url) {
      console.error('❌ No video URL found for session')
      return NextResponse.json(
        { success: false, error: 'No video recording found for this session' },
        { status: 400 }
      )
    }

    console.log('📋 Session Info:')
    console.log('- Training Mode:', session.training_mode)
    console.log('- Language:', session.language)
    console.log('- Video URL:', session.video_recording_url)
    console.log('- Video URL type:', typeof session.video_recording_url)
    console.log('- Video URL length:', session.video_recording_url.length)

    // 2. Download video from Supabase storage
    console.log('📥 Downloading video...')

    // Extract storage bucket and path from URL
    // Format: https://tscjbpdorbxmbxcqyiri.supabase.co/storage/v1/object/public/{bucket}/{path}
    let bucket: string
    let storagePath: string

    if (session.video_recording_url.includes('/storage/v1/object/public/')) {
      // Extract bucket and path from full URL
      const afterPublic = session.video_recording_url.split('/storage/v1/object/public/')[1]
      const parts = afterPublic.split('/')
      bucket = parts[0]
      storagePath = parts.slice(1).join('/')
    } else {
      // Fallback: assume training-videos bucket
      bucket = 'training-videos'
      storagePath = session.video_recording_url
    }

    console.log('Storage bucket:', bucket)
    console.log('Storage path:', storagePath)

    const { data: videoData, error: downloadError } = await supabase
      .storage
      .from(bucket)
      .download(storagePath)

    if (downloadError || !videoData) {
      console.error('❌ Error downloading video:', downloadError)
      return NextResponse.json(
        { success: false, error: 'Failed to download video from storage' },
        { status: 500 }
      )
    }

    const arrayBuffer = await videoData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2)

    console.log(`✅ Video downloaded: ${fileSizeMB} MB`)

    // Check file size limit (Whisper max is 25MB)
    if (buffer.length > 25 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: `Video file too large (${fileSizeMB} MB). Whisper API supports up to 25 MB. Consider extracting audio first or using a compression tool.` },
        { status: 400 }
      )
    }

    // 3. Transcribe using OpenAI Whisper
    console.log('🎯 Transcribing video with Whisper...')
    console.log('- Language:', session.language)
    console.log('- File size:', fileSizeMB, 'MB')

    // Create a File object from buffer
    const file = new File([buffer], `video_${sessionId}.mp4`, { type: 'video/mp4' })

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: session.language || undefined,
      response_format: 'verbose_json',
      timestamp_granularities: ['segment']
    })

    console.log('✅ Transcription completed!')
    console.log('- Text length:', transcription.text.length, 'characters')
    console.log('- Duration:', transcription.duration, 'seconds')
    console.log('- Detected language:', transcription.language)

    // 4. Update session in database
    console.log('💾 Updating session in database...')

    const { error: updateError } = await supabase
      .from('training_sessions')
      .update({
        transcript: transcription.text,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('❌ Error updating session:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update session with transcript' },
        { status: 500 }
      )
    }

    console.log('✅ Session updated successfully!')

    return NextResponse.json({
      success: true,
      transcript: transcription.text,
      duration: transcription.duration,
      language: transcription.language,
      segments: transcription.segments?.length || 0,
      message: 'Video transcribed successfully'
    })

  } catch (error: any) {
    console.error('❌ Video transcription error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to transcribe video'
      },
      { status: 500 }
    )
  }
}
