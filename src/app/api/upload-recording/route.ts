import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('recording') as File
    const sessionId = formData.get('sessionId') as string
    const recordingType = formData.get('recordingType') as string

    if (!file || !sessionId || !recordingType) {
      return NextResponse.json(
        { error: 'Missing required fields: recording, sessionId, recordingType' },
        { status: 400 }
      )
    }

    console.log(`📤 Uploading ${recordingType} recording for session:`, sessionId)

    // Create file path
    const fileExtension = recordingType === 'audio' ? 'webm' : 'webm'
    const fileName = `${sessionId}-${recordingType}-${Date.now()}.${fileExtension}`
    const filePath = `recordings/${recordingType}/${fileName}`

    // Convert File to ArrayBuffer then to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage using admin client
    const { data, error } = await supabaseAdmin.storage
      .from('training-recordings')
      .upload(filePath, buffer, {
        contentType: file.type || `${recordingType}/webm`,
        upsert: false
      })

    if (error) {
      console.error(`❌ Failed to upload ${recordingType} recording:`, error)
      return NextResponse.json(
        { error: `Failed to upload recording: ${error.message}` },
        { status: 500 }
      )
    }

    console.log(`✅ ${recordingType} recording uploaded successfully:`, data.path)

    // Get the public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('training-recordings')
      .getPublicUrl(data.path)

    // Return success with file info
    return NextResponse.json({
      success: true,
      url: publicUrl,
      path: data.path,
      size: buffer.length
    })

  } catch (error) {
    console.error('❌ Error in upload-recording API:', error)
    return NextResponse.json(
      { error: 'Internal server error during recording upload' },
      { status: 500 }
    )
  }
}