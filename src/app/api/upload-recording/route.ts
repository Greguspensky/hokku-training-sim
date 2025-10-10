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
    console.log(`📋 File type: ${file.type}, size: ${file.size} bytes`)

    // Detect file extension from MIME type (iOS uses mp4, others use webm)
    let fileExtension = 'webm'
    if (file.type.includes('mp4')) {
      fileExtension = 'mp4'
    } else if (file.type.includes('webm')) {
      fileExtension = 'webm'
    } else if (recordingType === 'audio') {
      fileExtension = 'webm'
    }

    const fileName = `${sessionId}-${recordingType}-${Date.now()}.${fileExtension}`
    const filePath = `recordings/${recordingType}/${fileName}`

    console.log(`📁 Upload path: ${filePath}`)

    // Convert File to ArrayBuffer then to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    console.log(`📦 Upload details:`)
    console.log(`   - File path: ${filePath}`)
    console.log(`   - Content type: ${file.type}`)
    console.log(`   - Buffer size: ${buffer.length} bytes`)

    // Upload to Supabase Storage using admin client
    const { data, error } = await supabaseAdmin.storage
      .from('training-recordings')
      .upload(filePath, buffer, {
        contentType: file.type || `${recordingType}/webm`,
        upsert: false
      })

    if (error) {
      console.error(`❌ Failed to upload ${recordingType} recording:`, error)
      console.error(`📋 Error details:`, JSON.stringify(error, null, 2))
      return NextResponse.json(
        { error: `Failed to upload recording: ${error.message}` },
        { status: 500 }
      )
    }

    if (!data || !data.path) {
      console.error(`❌ Upload succeeded but no path returned`)
      return NextResponse.json(
        { error: 'Upload succeeded but no path returned' },
        { status: 500 }
      )
    }

    console.log(`✅ ${recordingType} recording uploaded successfully:`, data.path)

    // Get the public URL
    let publicUrl: string
    try {
      const result = supabaseAdmin.storage
        .from('training-recordings')
        .getPublicUrl(data.path)
      publicUrl = result.data.publicUrl
      console.log(`✅ Public URL generated: ${publicUrl}`)
    } catch (urlError) {
      console.error(`❌ Failed to generate public URL:`, urlError)
      return NextResponse.json(
        { error: `Failed to generate public URL: ${urlError instanceof Error ? urlError.message : 'Unknown error'}` },
        { status: 500 }
      )
    }

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