/**
 * Link an existing session to an ElevenLabs conversation (CORRECT SCHEMA)
 * POST /api/debug/link-conversation-v2
 * Body: { sessionId, conversationId, agentId }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY!

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, conversationId, agentId } = body

    console.log('🔗 Linking conversation to session (v2 - correct schema):', {
      sessionId,
      conversationId,
      agentId
    })

    if (!sessionId || !conversationId) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, conversationId' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Verify session exists
    console.log('1️⃣ Checking if session exists...')
    const { data: session, error: sessionError } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found', details: sessionError },
        { status: 404 }
      )
    }
    console.log('✅ Session found:', sessionId)

    // Step 2: Fetch conversation from ElevenLabs
    console.log('2️⃣ Fetching conversation from ElevenLabs...')
    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
      {
        headers: {
          'xi-api-key': elevenLabsApiKey
        }
      }
    )

    if (!elevenLabsResponse.ok) {
      throw new Error(`ElevenLabs API error: ${elevenLabsResponse.status}`)
    }

    const conversation = await elevenLabsResponse.json()
    console.log('✅ Conversation found in ElevenLabs')

    // Step 3: Fetch transcript
    console.log('3️⃣ Fetching transcript...')
    const transcriptResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/transcript`,
      {
        headers: {
          'xi-api-key': elevenLabsApiKey
        }
      }
    )

    let transcript = []
    if (transcriptResponse.ok) {
      const transcriptData = await transcriptResponse.json()
      transcript = transcriptData.transcript || []
      console.log(`✅ Transcript fetched: ${transcript.length} messages`)
    } else {
      console.warn('⚠️ Could not fetch transcript')
    }

    // Step 4: Calculate duration from ElevenLabs data
    let durationSeconds = session.recording_duration_seconds
    if (conversation.start_time_unix_secs && conversation.end_time_unix_secs) {
      durationSeconds = conversation.end_time_unix_secs - conversation.start_time_unix_secs
      console.log(`📊 Calculated duration from ElevenLabs: ${durationSeconds}s`)
    } else if (conversation.call_duration_secs) {
      durationSeconds = conversation.call_duration_secs
      console.log(`📊 Using call_duration_secs: ${durationSeconds}s`)
    }

    // Step 5: Check if conversation already linked
    const { data: existingLink } = await supabase
      .from('elevenlabs_conversations')
      .select('*')
      .eq('training_session_id', sessionId)
      .single()

    if (existingLink) {
      console.log('⚠️  Conversation already linked to this session, updating...')
      const { error: updateError } = await supabase
        .from('elevenlabs_conversations')
        .update({
          conversation_id: conversationId,
          agent_id: agentId || conversation.agent_id || 'unknown',
          status: conversation.status || 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('training_session_id', sessionId)

      if (updateError) {
        console.error('❌ Failed to update conversation link:', updateError)
        throw updateError
      }
    } else {
      console.log('4️⃣ Creating conversation link...')
      const { error: insertError } = await supabase
        .from('elevenlabs_conversations')
        .insert({
          training_session_id: sessionId,
          conversation_id: conversationId,
          agent_id: agentId || conversation.agent_id || 'unknown',
          status: conversation.status || 'completed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (insertError) {
        console.error('❌ Failed to create conversation link:', insertError)
        throw insertError
      }
    }

    console.log('✅ Conversation linked successfully')

    // Step 6: Update session data with transcript and duration
    console.log('5️⃣ Updating session data...')
    const currentSessionData = session.session_data || {}
    const updatedSessionData = {
      ...currentSessionData,
      conversation_transcript: transcript,
      elevenlabs_conversation_id: conversationId,
      transcript_fetched_at: new Date().toISOString()
    }

    const sessionUpdate: any = {
      session_data: updatedSessionData
    }

    // Update duration if we have it
    if (durationSeconds && durationSeconds > 0) {
      sessionUpdate.recording_duration_seconds = durationSeconds
    }

    // Update completed_at if conversation has ended
    if (!session.completed_at && conversation.end_time_unix_secs) {
      sessionUpdate.completed_at = new Date(conversation.end_time_unix_secs * 1000).toISOString()
      console.log('📝 Setting completed_at from ElevenLabs data')
    }

    const { error: updateError } = await supabase
      .from('training_sessions')
      .update(sessionUpdate)
      .eq('id', sessionId)

    if (updateError) {
      console.error('❌ Failed to update session:', updateError)
      throw updateError
    }

    console.log('✅ Session updated successfully')

    return NextResponse.json({
      success: true,
      message: 'Conversation linked successfully',
      session: {
        id: sessionId,
        conversation_id: conversationId,
        transcript_messages: transcript.length,
        duration_seconds: durationSeconds,
        duration_formatted: durationSeconds
          ? `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`
          : 'N/A',
        completed_at: sessionUpdate.completed_at || session.completed_at
      }
    })

  } catch (error) {
    console.error('❌ Failed to link conversation:', error)
    return NextResponse.json(
      {
        error: 'Failed to link conversation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
