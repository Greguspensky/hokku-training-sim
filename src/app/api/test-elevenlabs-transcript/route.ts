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

    // Retry mechanism for ElevenLabs transcript processing delays
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
        const delay = baseDelay * Math.pow(2, attempt - 1) // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        console.log(`⏳ Transcript not ready yet (404). Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else if (transcriptResponse.status !== 404) {
        // Non-404 errors should not be retried
        console.error('❌ ElevenLabs API error (non-retriable):', transcriptResponse.status, transcriptResponse.statusText)
        return NextResponse.json(
          { error: `ElevenLabs API error: ${transcriptResponse.statusText}` },
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

    // Get transcript data as JSON
    const transcriptData = await transcriptResponse.json()

    console.log('✅ Retrieved conversation transcript:', transcriptData)

    // Transform ElevenLabs transcript format to match our assessment system format
    const formattedMessages = transcriptData.transcript?.map((msg: any) => ({
      role: msg.role === 'agent' ? 'assistant' : msg.role, // Convert 'agent' to 'assistant'
      content: msg.message || '',
      timestamp: msg.time_in_call_secs * 1000 // Convert seconds to milliseconds
    })).filter((msg: any) => msg.content.trim().length > 0) || []

    return NextResponse.json({
      success: true,
      conversationId: conversationId,
      transcript: {
        ...transcriptData,
        messages: formattedMessages // Add formatted messages for assessment compatibility
      },
      messageCount: formattedMessages.length,
      fetchedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error in test-elevenlabs-transcript API:', error)
    return NextResponse.json(
      { error: 'Internal server error retrieving conversation transcript' },
      { status: 500 }
    )
  }
}