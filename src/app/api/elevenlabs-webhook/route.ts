import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const webhookData = await request.json()

    console.log('📥 ElevenLabs webhook received:', JSON.stringify(webhookData, null, 2))

    // Handle post-call audio webhook
    if (webhookData.type === 'post_call_audio') {
      const { agent_id, conversation_id, full_audio } = webhookData.data

      if (!conversation_id || !full_audio) {
        console.error('❌ Missing conversation_id or full_audio in webhook')
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }

      console.log(`🎵 Processing post-call audio for conversation: ${conversation_id}`)

      // Decode base64 audio data
      const audioBuffer = Buffer.from(full_audio, 'base64')
      const audioSize = audioBuffer.byteLength

      console.log(`📊 Audio size: ${audioSize} bytes`)

      // Find the training session with this conversation ID
      const { data: sessions, error: findError } = await supabaseAdmin
        .from('training_sessions')
        .select('id, employee_id')
        .eq('elevenlabs_conversation_id', conversation_id)
        .limit(1)

      if (findError) {
        console.error('❌ Error finding training session:', findError)
        return NextResponse.json({ error: 'Database error' }, { status: 500 })
      }

      if (!sessions || sessions.length === 0) {
        console.warn(`⚠️ No training session found for conversation ID: ${conversation_id}`)
        // Still return 200 to acknowledge webhook
        return NextResponse.json({
          message: 'Webhook received but no matching session found',
          conversation_id
        })
      }

      const session = sessions[0]
      console.log(`📋 Found training session: ${session.id}`)

      // Generate filename for storage
      const timestamp = Date.now()
      const fileName = `${session.id}-elevenlabs-audio-${timestamp}.mp3`
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
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
      }

      // Get public URL for the uploaded audio
      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('training-recordings')
        .getPublicUrl(uploadData.path)

      console.log('✅ Audio uploaded to storage:', publicUrl)

      // Update training session with audio URL
      const { error: updateError } = await supabaseAdmin
        .from('training_sessions')
        .update({
          audio_recording_url: publicUrl,
          audio_file_size: audioSize,
          elevenlabs_conversation_id: conversation_id
        })
        .eq('id', session.id)

      if (updateError) {
        console.error('❌ Failed to update session with audio:', updateError)
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
      }

      console.log(`✅ Training session ${session.id} updated with ElevenLabs audio`)

      return NextResponse.json({
        success: true,
        message: 'Audio processed successfully',
        session_id: session.id,
        conversation_id,
        audio_url: publicUrl,
        audio_size: audioSize
      })
    }

    // Handle other webhook types if needed
    console.log(`📌 Unhandled webhook type: ${webhookData.type}`)

    return NextResponse.json({
      success: true,
      message: 'Webhook received',
      type: webhookData.type
    })

  } catch (error) {
    console.error('❌ ElevenLabs webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}