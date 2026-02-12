/**
 * Download audio from ElevenLabs and upload to Supabase
 * POST /api/debug/download-and-upload-audio
 * Body: { sessionId, conversationId }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY!

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, conversationId } = body

    console.log('📥 Downloading audio from ElevenLabs and uploading to session:', {
      sessionId,
      conversationId
    })

    if (!sessionId || !conversationId) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, conversationId' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Download audio from ElevenLabs
    console.log('1️⃣ Downloading audio from ElevenLabs...')
    const audioResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio`,
      {
        headers: {
          'xi-api-key': elevenLabsApiKey
        }
      }
    )

    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`)
    }

    const audioBuffer = await audioResponse.arrayBuffer()
    const audioSize = audioBuffer.byteLength
    console.log(`✅ Audio downloaded: ${Math.round(audioSize / 1024)} KB`)

    // Step 2: Upload to Supabase storage
    console.log('2️⃣ Uploading to Supabase storage...')
    const fileName = `${sessionId}_audio.mp3`
    const filePath = `training-sessions/${sessionId}/${fileName}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('training-recordings')
      .upload(filePath, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true
      })

    if (uploadError) {
      console.error('❌ Upload failed:', uploadError)
      throw uploadError
    }

    console.log('✅ Audio uploaded to storage:', filePath)

    // Step 3: Get public URL
    const { data: urlData } = supabase.storage
      .from('training-recordings')
      .getPublicUrl(filePath)

    const audioUrl = urlData.publicUrl
    console.log('📎 Public URL:', audioUrl)

    // Step 4: Update session with audio URL
    console.log('3️⃣ Updating session record...')
    const { error: updateError } = await supabase
      .from('training_sessions')
      .update({
        audio_recording_url: audioUrl,
        audio_file_size: audioSize
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('❌ Failed to update session:', updateError)
      throw updateError
    }

    console.log('✅ Session updated with audio URL')

    return NextResponse.json({
      success: true,
      message: 'Audio downloaded and uploaded successfully',
      audio: {
        url: audioUrl,
        size_bytes: audioSize,
        size_kb: Math.round(audioSize / 1024),
        storage_path: filePath
      }
    })

  } catch (error) {
    console.error('❌ Failed to download and upload audio:', error)
    return NextResponse.json(
      {
        error: 'Failed to download and upload audio',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
