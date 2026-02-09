import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY!

export async function POST(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const body = await request.json()
    const { sessionIds, email } = body

    let sessionsToFix: string[] = sessionIds || []

    // If email provided, find all sessions needing fix for that user
    if (email && !sessionIds) {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single()

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      // Get sessions with 0 duration but have transcript/conversation
      const { data: sessions } = await supabase
        .from('training_sessions')
        .select('id, started_at, ended_at, session_duration_seconds, elevenlabs_conversation_id, conversation_transcript')
        .eq('employee_id', user.id)

      sessionsToFix = (sessions || [])
        .filter(s => {
          const startedAt = new Date(s.started_at)
          const endedAt = new Date(s.ended_at)
          const hasIdenticalTimestamps = startedAt.getTime() === endedAt.getTime()
          const hasConversation = s.elevenlabs_conversation_id || (s.conversation_transcript && s.conversation_transcript.length > 1)
          return s.session_duration_seconds === 0 && hasIdenticalTimestamps && hasConversation
        })
        .map(s => s.id)
    }

    if (sessionsToFix.length === 0) {
      return NextResponse.json({ message: 'No sessions need fixing', fixed: 0 })
    }

    const results = []

    for (const sessionId of sessionsToFix) {
      try {
        // Get session data
        const { data: session, error: sessionError } = await supabase
          .from('training_sessions')
          .select('*')
          .eq('id', sessionId)
          .single()

        if (sessionError || !session) {
          results.push({ id: sessionId, status: 'error', error: 'Session not found' })
          continue
        }

        let actualDuration = 0
        let fixMethod = 'none'

        // Method 1: Try to get duration from ElevenLabs conversation
        if (session.elevenlabs_conversation_id) {
          try {
            const convResponse = await fetch(
              `https://api.elevenlabs.io/v1/convai/conversations/${session.elevenlabs_conversation_id}`,
              {
                headers: {
                  'xi-api-key': elevenlabsApiKey
                }
              }
            )

            if (convResponse.ok) {
              const convData = await convResponse.json()

              // Calculate duration from transcript timestamps
              if (convData.transcript && convData.transcript.length > 0) {
                const transcriptMessages = convData.transcript
                const firstMessage = transcriptMessages[0]
                const lastMessage = transcriptMessages[transcriptMessages.length - 1]

                if (firstMessage.timestamp && lastMessage.timestamp) {
                  actualDuration = Math.round((lastMessage.timestamp - firstMessage.timestamp) / 1000)
                  fixMethod = 'elevenlabs_transcript_timestamps'
                }
              }
            }
          } catch (elevenlabsError) {
            console.error('Failed to fetch from ElevenLabs:', elevenlabsError)
          }
        }

        // Method 2: Estimate from transcript length (rough estimate: ~10 seconds per message exchange)
        if (actualDuration === 0 && session.conversation_transcript && session.conversation_transcript.length > 1) {
          actualDuration = Math.max(60, session.conversation_transcript.length * 10)
          fixMethod = 'transcript_length_estimate'
        }

        if (actualDuration > 0) {
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
            results.push({
              id: sessionId,
              status: 'error',
              error: updateError.message
            })
          } else {
            results.push({
              id: sessionId,
              status: 'fixed',
              fixMethod,
              oldDuration: session.session_duration_seconds,
              newDuration: actualDuration,
              oldStartedAt: session.started_at,
              newStartedAt: startedAt.toISOString()
            })
          }
        } else {
          results.push({
            id: sessionId,
            status: 'skipped',
            reason: 'Could not determine actual duration'
          })
        }
      } catch (error: any) {
        results.push({
          id: sessionId,
          status: 'error',
          error: error.message
        })
      }
    }

    const fixed = results.filter(r => r.status === 'fixed').length
    const errors = results.filter(r => r.status === 'error').length
    const skipped = results.filter(r => r.status === 'skipped').length

    return NextResponse.json({
      message: `Fixed ${fixed} sessions, ${errors} errors, ${skipped} skipped`,
      fixed,
      errors,
      skipped,
      results
    })
  } catch (error: any) {
    console.error('❌ Error fixing session durations:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}
