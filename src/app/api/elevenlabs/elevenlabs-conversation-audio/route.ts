import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversationId, sessionId } = body

    if (!conversationId || !sessionId) {
      return NextResponse.json(
        { error: 'Missing conversationId or sessionId' },
        { status: 400 }
      )
    }

    const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY
    if (!elevenlabsApiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      )
    }

    console.log('🎵 Fetching conversation audio from ElevenLabs:', conversationId)

    // Retry mechanism for ElevenLabs audio processing delays
    const maxRetries = 5
    const baseDelay = 1000 // Start with 1 second
    let audioResponse: Response | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`🔄 Attempt ${attempt}/${maxRetries} to fetch conversation audio`)

      audioResponse = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio`,
        {
          method: 'GET',
          headers: {
            'xi-api-key': elevenlabsApiKey,
          }
        }
      )

      if (audioResponse.ok) {
        console.log('✅ Successfully fetched conversation audio on attempt', attempt)
        break
      }

      if (audioResponse.status === 404 && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1) // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        console.log(`⏳ Audio not ready yet (404). Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else if (audioResponse.status !== 404) {
        // Non-404 errors should not be retried
        console.error('❌ ElevenLabs API error (non-retriable):', audioResponse.status, audioResponse.statusText)
        return NextResponse.json(
          { error: `ElevenLabs API error: ${audioResponse.statusText}` },
          { status: audioResponse.status }
        )
      }
    }

    if (!audioResponse || !audioResponse.ok) {
      console.error('❌ Failed to fetch audio after', maxRetries, 'attempts')
      return NextResponse.json(
        {
          error: 'Conversation audio not available yet. Please try again in a few minutes.',
          retryable: true
        },
        { status: 503 } // Service Temporarily Unavailable
      )
    }

    // Get audio data as buffer
    const audioBuffer = await audioResponse.arrayBuffer()
    const audioSize = audioBuffer.byteLength

    console.log('✅ Retrieved conversation audio:', audioSize, 'bytes')

    // Create filename for Supabase Storage
    const timestamp = Date.now()
    const fileName = `${sessionId}-conversation-audio-${timestamp}.mp3`
    const filePath = `recordings/audio/${fileName}`

    // Upload audio to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('training-recordings')
      .upload(filePath, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: false
      })

    if (uploadError) {
      console.error('❌ Failed to upload audio to storage:', uploadError)
      return NextResponse.json(
        { error: `Failed to upload audio: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // Get public URL for the uploaded audio
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('training-recordings')
      .getPublicUrl(uploadData.path)

    console.log('✅ Conversation audio uploaded successfully:', publicUrl)

    // Update session with complete conversation audio
    const { error: updateError } = await supabaseAdmin
      .from('training_sessions')
      .update({
        audio_recording_url: publicUrl,
        audio_file_size: audioSize,
        elevenlabs_conversation_id: conversationId
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('❌ Failed to update session with audio:', updateError)
      return NextResponse.json(
        { error: `Failed to update session: ${updateError.message}` },
        { status: 500 }
      )
    }

    console.log('✅ Session updated with ElevenLabs conversation audio')

    return NextResponse.json({
      success: true,
      audioUrl: publicUrl,
      audioSize: audioSize,
      conversationId: conversationId
    })

  } catch (error) {
    console.error('❌ Error in elevenlabs-conversation-audio API:', error)
    return NextResponse.json(
      { error: 'Internal server error retrieving conversation audio' },
      { status: 500 }
    )
  }
}