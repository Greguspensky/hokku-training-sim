import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY

    console.log('🧪 Testing ElevenLabs API authentication')
    console.log('🔑 API key present:', !!elevenlabsApiKey)
    console.log('🔑 API key length:', elevenlabsApiKey?.length || 0)
    console.log('🔑 API key first 10 chars:', elevenlabsApiKey?.substring(0, 10) + '...' || 'undefined')

    if (!elevenlabsApiKey) {
      return NextResponse.json({
        success: false,
        error: 'ElevenLabs API key not configured',
        env: process.env.NODE_ENV
      }, { status: 500 })
    }

    // Test with the specific conversation ID from the failing session
    const conversationId = 'conv_2201k6fhebsgfnbrhemcxfrbg9v8'
    console.log('🧪 Testing conversation access:', conversationId)

    const testResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': elevenlabsApiKey,
        }
      }
    )

    console.log('📡 ElevenLabs response status:', testResponse.status)
    console.log('📡 ElevenLabs response headers:', Object.fromEntries(testResponse.headers.entries()))

    if (!testResponse.ok) {
      const errorText = await testResponse.text()
      console.error('❌ ElevenLabs API test failed:', testResponse.status, testResponse.statusText)
      console.error('❌ Error body:', errorText)

      return NextResponse.json({
        success: false,
        error: `ElevenLabs API test failed: ${testResponse.status} ${testResponse.statusText}`,
        details: errorText,
        conversationId,
        apiKeyConfigured: true,
        apiKeyLength: elevenlabsApiKey.length
      }, { status: testResponse.status })
    }

    const conversationData = await testResponse.json()
    console.log('✅ ElevenLabs API test successful')
    console.log('✅ Conversation data keys:', Object.keys(conversationData))

    return NextResponse.json({
      success: true,
      message: 'ElevenLabs API authentication test successful',
      conversationId,
      conversationExists: true,
      apiKeyConfigured: true,
      apiKeyLength: elevenlabsApiKey.length,
      conversationKeys: Object.keys(conversationData),
      env: process.env.NODE_ENV
    })

  } catch (error) {
    console.error('❌ Error in ElevenLabs auth test:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error during auth test',
      details: error.message
    }, { status: 500 })
  }
}