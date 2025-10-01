import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversationId } = body

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Missing conversationId' },
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

    console.log('📝 Fetching conversation transcript from ElevenLabs:', conversationId)
    console.log('🔑 API key configured:', !!elevenlabsApiKey, 'length:', elevenlabsApiKey?.length || 0)

    // Retry mechanism for ElevenLabs processing delays
    const maxRetries = 5
    const baseDelay = 1000 // Start with 1 second
    let transcriptResponse: Response | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`🔄 Attempt ${attempt}/${maxRetries} to fetch conversation transcript`)

      transcriptResponse = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
        {
          method: 'GET',
          headers: {
            'xi-api-key': elevenlabsApiKey,
          }
        }
      )

      if (transcriptResponse.ok) {
        console.log('✅ Successfully fetched conversation transcript on attempt', attempt)
        break
      }

      if (transcriptResponse.status === 404 && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1) // Exponential backoff
        console.log(`⏳ Transcript not ready yet (404). Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else if (transcriptResponse.status !== 404) {
        // Non-404 errors should not be retried
        console.error('❌ ElevenLabs API error (non-retriable):', transcriptResponse.status, transcriptResponse.statusText)
        const errorText = await transcriptResponse.text()
        console.error('❌ ElevenLabs error details:', errorText)
        console.error('❌ Request details: conversationId =', conversationId, 'API key present =', !!elevenlabsApiKey)
        return NextResponse.json(
          {
            error: `ElevenLabs API error: ${transcriptResponse.statusText}`,
            details: errorText,
            conversationId: conversationId
          },
          { status: transcriptResponse.status }
        )
      }
    }

    if (!transcriptResponse || !transcriptResponse.ok) {
      console.error('❌ Failed to fetch transcript after', maxRetries, 'attempts')
      return NextResponse.json(
        {
          error: 'Conversation transcript not available yet. Please try again in a few minutes.',
          retryable: true
        },
        { status: 503 } // Service Temporarily Unavailable
      )
    }

    // Get transcript data
    const conversationData = await transcriptResponse.json()
    console.log('✅ Retrieved conversation data:', {
      id: conversationData.conversation_id,
      messages: conversationData.messages?.length || 0
    })

    // Debug: Log the full conversation structure to understand ElevenLabs format
    console.log('🔍 DEBUG: Full conversation data structure:')
    console.log('Keys:', Object.keys(conversationData))
    console.log('Full data:', JSON.stringify(conversationData, null, 2))

    // Transform ElevenLabs transcript format to match assessment system format
    const formattedTranscript = []

    const transcriptMessages = conversationData.transcript?.transcript || conversationData.transcript || []

    if (Array.isArray(transcriptMessages)) {
      for (const msg of transcriptMessages) {
        // Transform ElevenLabs format to our assessment system format
        const role = msg.role === 'agent' ? 'assistant' : msg.role // Convert 'agent' to 'assistant'
        const content = msg.message || ''
        const timestamp = msg.time_in_call_secs * 1000 // Convert seconds to milliseconds

        if (content.trim().length > 0) { // Only include non-empty messages
          formattedTranscript.push({
            role,
            content,
            timestamp
          })
        }
      }
    }

    console.log(`✅ Formatted transcript with ${formattedTranscript.length} messages`)

    // Log sample for debugging
    if (formattedTranscript.length > 0) {
      console.log('📝 Sample messages:')
      formattedTranscript.slice(0, 3).forEach((msg, i) => {
        console.log(`  ${i + 1}. [${msg.role}]: ${msg.content.substring(0, 100)}...`)
      })
    }

    // Extract call duration from metadata
    const callDurationSeconds = conversationData.metadata?.call_duration_secs || 0
    console.log(`⏱️ Call duration extracted: ${callDurationSeconds} seconds`)

    return NextResponse.json({
      success: true,
      conversationId: conversationId,
      transcript: {
        ...conversationData,
        messages: formattedTranscript // Add formatted messages for assessment compatibility
      },
      messageCount: formattedTranscript.length,
      durationSeconds: callDurationSeconds, // Add extracted duration
      fetchedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error in elevenlabs-conversation-transcript API:', error)
    return NextResponse.json(
      { error: 'Internal server error retrieving conversation transcript' },
      { status: 500 }
    )
  }
}