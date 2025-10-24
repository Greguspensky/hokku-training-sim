import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { sessionId, managerId } = await request.json()

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    if (!managerId) {
      return NextResponse.json(
        { error: 'Manager ID is required' },
        { status: 400 }
      )
    }

    console.log('🗑️ Starting session deletion:', sessionId, 'by manager:', managerId)

    // 1. Verify user is a manager
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role, company_id')
      .eq('id', managerId)
      .single()

    if (userError || !userData) {
      console.error('❌ Failed to fetch user data:', userError)
      return NextResponse.json(
        { error: 'Failed to verify user permissions' },
        { status: 403 }
      )
    }

    if (userData.role !== 'manager') {
      console.error('❌ User is not a manager:', managerId)
      return NextResponse.json(
        { error: 'Only managers can delete sessions' },
        { status: 403 }
      )
    }

    // 2. Fetch the session to get all related data
    console.log('📋 Fetching session data...')
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('training_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      console.error('❌ Session not found:', sessionId, sessionError)
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Verify session belongs to manager's company
    if (session.company_id !== userData.company_id) {
      console.error('❌ Session does not belong to manager\'s company')
      return NextResponse.json(
        { error: 'You do not have permission to delete this session' },
        { status: 403 }
      )
    }

    console.log('✅ Session found:', {
      id: session.id,
      employee_id: session.employee_id,
      has_elevenlabs: !!session.elevenlabs_conversation_id,
      has_video: !!session.video_recording_url,
      has_audio: !!session.audio_recording_url
    })

    const deletionResults = {
      session: false,
      elevenlabsConversation: false,
      videoRecording: false,
      audioRecording: false
    }
    const errors: string[] = []

    // 3. Delete ElevenLabs conversation (if exists)
    if (session.elevenlabs_conversation_id) {
      console.log('🎤 Deleting ElevenLabs conversation:', session.elevenlabs_conversation_id)
      try {
        const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY
        if (!elevenlabsApiKey) {
          console.warn('⚠️ ELEVENLABS_API_KEY not found, skipping conversation deletion')
          errors.push('ElevenLabs API key not configured')
        } else {
          const deleteConvResponse = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversations/${session.elevenlabs_conversation_id}`,
            {
              method: 'DELETE',
              headers: {
                'xi-api-key': elevenlabsApiKey
              }
            }
          )

          if (deleteConvResponse.ok || deleteConvResponse.status === 404) {
            console.log('✅ ElevenLabs conversation deleted (or already deleted)')
            deletionResults.elevenlabsConversation = true
          } else {
            const errorText = await deleteConvResponse.text()
            console.error('❌ Failed to delete ElevenLabs conversation:', deleteConvResponse.status, errorText)
            errors.push(`ElevenLabs deletion failed: ${deleteConvResponse.status}`)
          }
        }
      } catch (error) {
        console.error('❌ Error deleting ElevenLabs conversation:', error)
        errors.push(`ElevenLabs error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } else {
      console.log('ℹ️ No ElevenLabs conversation to delete')
    }

    // Helper function to extract storage path from public URL
    const extractStoragePath = (url: string): string | null => {
      try {
        // URL format: https://[project].supabase.co/storage/v1/object/public/training-recordings/recordings/video/file.webm
        // We need: recordings/video/file.webm
        const match = url.match(/\/training-recordings\/(.+)$/)
        return match ? match[1] : null
      } catch (error) {
        console.error('Error extracting storage path:', error)
        return null
      }
    }

    // 4. Delete video recording from Supabase Storage (if exists)
    if (session.video_recording_url) {
      console.log('🎥 Deleting video recording from storage')
      try {
        const videoPath = extractStoragePath(session.video_recording_url)
        if (videoPath) {
          console.log('📂 Video path:', videoPath)
          const { error: videoError } = await supabaseAdmin.storage
            .from('training-recordings')
            .remove([videoPath])

          if (videoError) {
            console.error('❌ Failed to delete video recording:', videoError)
            errors.push(`Video deletion failed: ${videoError.message}`)
          } else {
            console.log('✅ Video recording deleted')
            deletionResults.videoRecording = true
          }
        } else {
          console.warn('⚠️ Could not extract video path from URL')
          errors.push('Could not parse video URL')
        }
      } catch (error) {
        console.error('❌ Error deleting video recording:', error)
        errors.push(`Video error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } else {
      console.log('ℹ️ No video recording to delete')
    }

    // 5. Delete audio recording from Supabase Storage (if exists)
    if (session.audio_recording_url) {
      console.log('🔊 Deleting audio recording from storage')
      try {
        const audioPath = extractStoragePath(session.audio_recording_url)
        if (audioPath) {
          console.log('📂 Audio path:', audioPath)
          const { error: audioError } = await supabaseAdmin.storage
            .from('training-recordings')
            .remove([audioPath])

          if (audioError) {
            console.error('❌ Failed to delete audio recording:', audioError)
            errors.push(`Audio deletion failed: ${audioError.message}`)
          } else {
            console.log('✅ Audio recording deleted')
            deletionResults.audioRecording = true
          }
        } else {
          console.warn('⚠️ Could not extract audio path from URL')
          errors.push('Could not parse audio URL')
        }
      } catch (error) {
        console.error('❌ Error deleting audio recording:', error)
        errors.push(`Audio error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } else {
      console.log('ℹ️ No audio recording to delete')
    }

    // 6. Delete session from database (critical operation)
    console.log('🗄️ Deleting session from database')
    const { error: dbError } = await supabaseAdmin
      .from('training_sessions')
      .delete()
      .eq('id', sessionId)

    if (dbError) {
      console.error('❌ CRITICAL: Failed to delete session from database:', dbError)
      return NextResponse.json(
        {
          error: 'Failed to delete session from database',
          details: dbError.message,
          partialDeletion: deletionResults
        },
        { status: 500 }
      )
    }

    console.log('✅ Session deleted from database')
    deletionResults.session = true

    // 7. Return success response
    console.log('✅ Session deletion completed:', {
      sessionId,
      results: deletionResults,
      errors: errors.length > 0 ? errors : null
    })

    return NextResponse.json({
      success: true,
      deleted: deletionResults,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('❌ Unexpected error during session deletion:', error)
    return NextResponse.json(
      {
        error: 'Internal server error during session deletion',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
