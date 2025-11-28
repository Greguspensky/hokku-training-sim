import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('📦 Received update-recording request:', JSON.stringify(body, null, 2))
    const { sessionId, recordingData } = body

    if (!sessionId) {
      console.error('❌ Missing sessionId in request')
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      )
    }

    if (!recordingData) {
      console.error('❌ Missing recordingData in request')
      return NextResponse.json(
        { error: 'Missing recordingData' },
        { status: 400 }
      )
    }

    console.log('🔄 Updating session recording metadata:', sessionId)

    // Update the session with recording data using admin client
    const { error } = await supabaseAdmin
      .from('training_sessions')
      .update(recordingData)
      .eq('id', sessionId)

    if (error) {
      console.error('❌ Failed to update session recording:', error)
      return NextResponse.json(
        { error: `Failed to update recording metadata: ${error.message}` },
        { status: 500 }
      )
    }

    console.log('✅ Session recording metadata updated successfully')

    return NextResponse.json({
      success: true,
      message: 'Recording metadata updated successfully'
    })

  } catch (error) {
    console.error('❌ Error in update-recording API:', error)
    return NextResponse.json(
      { error: 'Internal server error during recording update' },
      { status: 500 }
    )
  }
}