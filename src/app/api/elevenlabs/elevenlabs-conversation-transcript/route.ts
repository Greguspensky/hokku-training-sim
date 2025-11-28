import { NextRequest, NextResponse } from 'next/server'
import { apiErrorHandler, createSuccessResponse, createErrorResponse, parseRequestBody } from '@/lib/utils/api';

// ElevenLabs-recommended retry function with exponential backoff
async function fetchWithRetry(url: string, options: RequestInit, maxRetries: number = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    console.log(`🔄 ElevenLabs API attempt ${attempt + 1}/${maxRetries}`)

    try {
      const response = await fetch(url, options)

      if (response.ok) {
        console.log(`✅ ElevenLabs API success on attempt ${attempt + 1}`)
        return response
      }

      // Enhanced logging for 401 errors as recommended by ElevenLabs
      if (response.status === 401) {
        console.error('🔑 Authentication failed:', {
          attempt: attempt + 1,
          conversationId: url.split('/').pop(),
          timestamp: new Date().toISOString(),
          responseHeaders: Object.fromEntries(response.headers.entries()),
          vercelRegion: process.env.VERCEL_REGION,
          nodeEnv: process.env.NODE_ENV
        })

        // Retry 401 errors as recommended (they can be intermittent)
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
          console.log(`⏳ Retrying 401 auth error in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
      }

      // Log 404 errors (transcript not ready)
      if (response.status === 404 && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000
        console.log(`⏳ Transcript not ready (404), retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      // Final attempt or non-retryable error
      if (attempt === maxRetries - 1 || (response.status !== 401 && response.status !== 404)) {
        const errorText = await response.text()
        console.error(`❌ ElevenLabs API final error:`, {
          status: response.status,
          statusText: response.statusText,
          details: errorText,
          attempt: attempt + 1,
          maxRetries
        })
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`)
      }
    } catch (fetchError) {
      console.error(`❌ Network error on attempt ${attempt + 1}:`, fetchError.message)

      if (attempt === maxRetries - 1) {
        throw new Error(`Network error after ${maxRetries} attempts: ${fetchError.message}`)
      }

      const delay = Math.pow(2, attempt) * 1000
      console.log(`⏳ Network error, retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw new Error(`Failed after ${maxRetries} attempts`)
}

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

    // Enhanced environment variable verification
    const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY
    if (!elevenlabsApiKey) {
      console.error('❌ ElevenLabs API key not configured in environment variables')
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      )
    }

    // Verify API key format and log configuration status (without exposing key)
    const isValidKeyFormat = elevenlabsApiKey.length === 51 && elevenlabsApiKey.startsWith('sk-')
    console.log('🔑 ElevenLabs API Key Status:', {
      configured: true,
      length: elevenlabsApiKey.length,
      validFormat: isValidKeyFormat,
      environment: process.env.NODE_ENV,
      vercelRegion: process.env.VERCEL_REGION
    })

    console.log('📝 Starting ElevenLabs conversation transcript fetch:', conversationId)

    // Use ElevenLabs-recommended fetch approach with proper headers
    const url = `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`
    const requestOptions: RequestInit = {
      method: 'GET',
      headers: {
        'xi-api-key': elevenlabsApiKey,
        'Content-Type': 'application/json',  // ElevenLabs recommended
        'Accept': 'application/json'         // ElevenLabs recommended
      }
    }

    let transcriptResponse: Response
    try {
      transcriptResponse = await fetchWithRetry(url, requestOptions, 5)
    } catch (error) {
      console.error('❌ All ElevenLabs API retry attempts failed:', error.message)
      return NextResponse.json(
        {
          error: 'Failed to fetch conversation transcript from ElevenLabs',
          details: error.message,
          retryable: true
        },
        { status: 503 }
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