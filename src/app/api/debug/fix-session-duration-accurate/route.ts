import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY!

export async function POST(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const body = await request.json()
    const { sessionId } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Get session data
    const { data: session, error: sessionError } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (!session.elevenlabs_conversation_id) {
      return NextResponse.json({ error: 'No ElevenLabs conversation ID found' }, { status: 400 })
    }

    // Fetch actual conversation data from ElevenLabs
    console.log('📞 Fetching conversation from ElevenLabs:', session.elevenlabs_conversation_id)

    const convResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${session.elevenlabs_conversation_id}`,
      {
        headers: {
          'xi-api-key': elevenlabsApiKey
        }
      }
    )

    if (!convResponse.ok) {
      const errorText = await convResponse.text()
      return NextResponse.json({
        error: 'Failed to fetch from ElevenLabs',
        details: errorText
      }, { status: 500 })
    }

    const convData = await convResponse.json()
    console.log('✅ ElevenLabs conversation data:', {
      id: convData.conversation_id,
      transcriptLength: convData.transcript?.length || 0,
      hasAudioUrl: !!convData.audio_url
    })

    let actualDuration = 0
    let fixMethod = 'unknown'

    // Method 1: Use conversation metadata if available (ElevenLabs field is call_duration_secs)
    if (convData.metadata?.call_duration_secs) {
      actualDuration = Math.round(convData.metadata.call_duration_secs)
      fixMethod = 'elevenlabs_metadata'
    }
    // Method 2: Calculate from transcript timestamps
    else if (convData.transcript && convData.transcript.length > 0) {
      const transcriptMessages = convData.transcript
      const firstMessage = transcriptMessages[0]
      const lastMessage = transcriptMessages[transcriptMessages.length - 1]

      if (firstMessage.timestamp && lastMessage.timestamp) {
        actualDuration = Math.round((lastMessage.timestamp - firstMessage.timestamp) / 1000)
        fixMethod = 'elevenlabs_transcript_timestamps'
      }
    }
    // Method 3: Fetch audio file and get duration from headers/metadata
    else if (convData.audio_url) {
      try {
        const audioResponse = await fetch(convData.audio_url, { method: 'HEAD' })
        const contentLength = audioResponse.headers.get('content-length')

        // Rough estimate: MP3 at 128kbps = 16KB/sec
        if (contentLength) {
          const sizeInKB = parseInt(contentLength) / 1024
          actualDuration = Math.round(sizeInKB / 16)
          fixMethod = 'audio_file_size_estimate'
        }
      } catch (audioError) {
        console.error('Failed to fetch audio metadata:', audioError)
      }
    }

    if (actualDuration === 0) {
      return NextResponse.json({
        error: 'Could not determine actual duration from ElevenLabs data',
        convData: {
          hasMetadata: !!convData.metadata,
          hasTranscript: !!convData.transcript,
          hasAudioUrl: !!convData.audio_url
        }
      }, { status: 400 })
    }

    // Calculate correct timestamps
    const endedAt = new Date(session.ended_at)
    const startedAt = new Date(endedAt.getTime() - (actualDuration * 1000))

    // Update session in database
    const { error: updateError } = await supabase
      .from('training_sessions')
      .update({
        started_at: startedAt.toISOString(),
        session_duration_seconds: actualDuration
      })
      .eq('id', sessionId)

    if (updateError) {
      return NextResponse.json({
        error: 'Failed to update session',
        details: updateError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      sessionId,
      fixMethod,
      oldDuration: session.session_duration_seconds,
      newDuration: actualDuration,
      oldStartedAt: session.started_at,
      newStartedAt: startedAt.toISOString(),
      transcriptLength: convData.transcript?.length || 0
    })

  } catch (error: any) {
    console.error('❌ Error fixing session duration:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 })
  }
}
