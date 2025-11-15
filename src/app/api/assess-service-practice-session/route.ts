import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface ServicePracticeAssessment {
  overall_score: number
  metrics: {
    empathy: number
    professionalism: number
    problem_resolution: number
    clarity: number
    deescalation?: number
    product_knowledge_accuracy: number
    milestone_completion_rate: number
  }
  milestones_achieved: Array<{
    milestone: string
    achieved: boolean
    evidence?: string
  }>
  strengths: Array<{
    point: string
    evidence: string
  }>
  improvements: Array<{
    point: string
    current?: string
    better?: string
  }>
  behavioral_metrics: {
    avg_response_time_seconds: number
    session_duration_seconds: number
    turn_balance: { employee: number; customer: number }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, forceReAnalysis } = body

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing required field: sessionId' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    console.log(`🎯 Assessing Service Practice session ${sessionId}`)
    console.log(`🔍 Force re-analysis: ${Boolean(forceReAnalysis)}`)

    // Fetch session data from database
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('training_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      console.error('❌ Error fetching session:', sessionError)
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Check if already assessed (use cache unless forced re-analysis)
    console.log(`🔍 Checking cache status:`)
    console.log(`  - forceReAnalysis: ${Boolean(forceReAnalysis)}`)
    console.log(`  - service_assessment_status: "${session.service_assessment_status}"`)
    console.log(`  - service_practice_assessment_results exists: ${!!session.service_practice_assessment_results}`)

    if (!forceReAnalysis && session.service_practice_assessment_results && session.service_assessment_status === 'completed') {
      console.log('✅ Returning cached assessment results')
      return NextResponse.json({
        success: true,
        sessionId,
        assessment: session.service_practice_assessment_results,
        fromCache: true,
        cachedAt: session.service_assessment_completed_at
      })
    }

    if (forceReAnalysis) {
      console.log('🔄 Forcing re-analysis, bypassing cache')
    }

    // Verify this is a Service Practice session
    if (session.training_mode !== 'service_practice') {
      return NextResponse.json(
        { error: `Invalid training mode: ${session.training_mode}. This endpoint is only for service_practice sessions.` },
        { status: 400 }
      )
    }

    let transcript = session.conversation_transcript as ConversationMessage[]

    // Check if transcript needs to be fetched from ElevenLabs
    const needsTranscriptFetch =
      !transcript ||
      transcript.length === 0 ||
      (transcript.length === 1 && transcript[0].content.includes('Get Transcript'))

    if (needsTranscriptFetch) {
      console.log('📥 Transcript missing or placeholder detected, fetching from ElevenLabs...')

      if (!session.elevenlabs_conversation_id) {
        return NextResponse.json(
          { error: 'No ElevenLabs conversation ID found for this session' },
          { status: 400 }
        )
      }

      console.log(`🔑 Using ElevenLabs conversation ID: ${session.elevenlabs_conversation_id}`)
      console.log(`📍 Fetching from: https://api.elevenlabs.io/v1/convai/conversations/${session.elevenlabs_conversation_id}`)

      const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY
      if (!elevenlabsApiKey) {
        console.error('❌ ElevenLabs API key not configured')
        return NextResponse.json(
          { error: 'ElevenLabs API key not configured' },
          { status: 500 }
        )
      }

      // Fetch transcript from ElevenLabs with retry logic
      let transcriptResponse: Response | null = null
      const maxRetries = 3

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          transcriptResponse = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversations/${session.elevenlabs_conversation_id}`,
            {
              method: 'GET',
              headers: {
                'xi-api-key': elevenlabsApiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              }
            }
          )

          if (transcriptResponse.ok) {
            console.log(`✅ Fetched transcript from ElevenLabs on attempt ${attempt + 1}`)
            break
          }

          if (attempt < maxRetries - 1) {
            const delay = Math.pow(2, attempt) * 1000
            await new Promise(resolve => setTimeout(resolve, delay))
          }
        } catch (error) {
          console.error(`❌ Error fetching transcript attempt ${attempt + 1}:`, error)
          if (attempt === maxRetries - 1) {
            return NextResponse.json(
              { error: 'Failed to fetch transcript from ElevenLabs' },
              { status: 500 }
            )
          }
        }
      }

      if (!transcriptResponse || !transcriptResponse.ok) {
        return NextResponse.json(
          { error: 'Failed to fetch transcript from ElevenLabs after retries' },
          { status: 500 }
        )
      }

      const conversationData = await transcriptResponse.json()

      // Log the full response structure for debugging
      console.log('📦 ElevenLabs conversation data structure:', JSON.stringify(conversationData, null, 2))
      console.log('🔍 Available keys:', Object.keys(conversationData))
      console.log('🔍 Transcript exists?', !!conversationData.transcript)
      console.log('🔍 Analysis exists?', !!conversationData.analysis)

      // Extract transcript messages - try multiple possible structures
      const fetchedTranscript: ConversationMessage[] = []

      // Try structure 1: transcript (direct array) - MOST COMMON
      if (Array.isArray(conversationData.transcript) && conversationData.transcript.length > 0) {
        console.log(`📝 Found ${conversationData.transcript.length} messages in transcript array`)
        for (const msg of conversationData.transcript) {
          fetchedTranscript.push({
            role: msg.role === 'agent' ? 'assistant' : 'user',
            content: msg.message || '',
            timestamp: msg.time_in_call_secs ? msg.time_in_call_secs * 1000 : Date.now()
          })
        }
      }
      // Try structure 2: transcript.messages
      else if (conversationData.transcript?.messages) {
        console.log(`📝 Found ${conversationData.transcript.messages.length} messages in transcript.messages`)
        for (const msg of conversationData.transcript.messages) {
          fetchedTranscript.push({
            role: msg.role === 'agent' ? 'assistant' : 'user',
            content: msg.message || '',
            timestamp: Date.now()
          })
        }
      }
      // Try structure 3: analysis.transcript_with_timestamps
      else if (conversationData.analysis?.transcript_with_timestamps) {
        console.log(`📝 Found ${conversationData.analysis.transcript_with_timestamps.length} messages in analysis.transcript_with_timestamps`)
        for (const msg of conversationData.analysis.transcript_with_timestamps) {
          fetchedTranscript.push({
            role: msg.role === 'agent' ? 'assistant' : 'user',
            content: msg.text || msg.message || '',
            timestamp: msg.timestamp || Date.now()
          })
        }
      }
      // Try structure 4: messages directly
      else if (conversationData.messages) {
        console.log(`📝 Found ${conversationData.messages.length} messages in top-level messages`)
        for (const msg of conversationData.messages) {
          fetchedTranscript.push({
            role: msg.role === 'agent' ? 'assistant' : 'user',
            content: msg.message || msg.text || '',
            timestamp: Date.now()
          })
        }
      }

      if (fetchedTranscript.length === 0) {
        console.error('❌ No messages found in any known structure')
        console.error('📦 Full data:', JSON.stringify(conversationData, null, 2))
        return NextResponse.json(
          {
            error: 'No messages found in ElevenLabs transcript',
            debug: {
              hasTranscript: !!conversationData.transcript,
              hasAnalysis: !!conversationData.analysis,
              hasMessages: !!conversationData.messages,
              keys: Object.keys(conversationData)
            }
          },
          { status: 400 }
        )
      }

      console.log(`✅ Successfully parsed ${fetchedTranscript.length} messages from ElevenLabs`)

      // Update database with fetched transcript
      const { error: updateError } = await supabaseAdmin
        .from('training_sessions')
        .update({ conversation_transcript: fetchedTranscript })
        .eq('id', sessionId)

      if (updateError) {
        console.error('⚠️ Failed to save transcript to database:', updateError)
      } else {
        console.log('✅ Saved transcript to database')
      }

      transcript = fetchedTranscript
    }

    if (!transcript || transcript.length === 0) {
      return NextResponse.json(
        { error: 'No transcript found for this session' },
        { status: 400 }
      )
    }

    console.log(`📝 Transcript contains ${transcript.length} messages`)

    // Fetch scenario context
    const { data: scenario, error: scenarioError } = await supabaseAdmin
      .from('scenarios')
      .select('*')
      .eq('id', session.scenario_id)
      .single()

    if (scenarioError || !scenario) {
      console.error('❌ Error fetching scenario:', scenarioError)
      return NextResponse.json(
        { error: 'Scenario not found' },
        { status: 404 }
      )
    }

    console.log(`🎭 Scenario: ${scenario.title} | Emotion: ${scenario.customer_emotion_level}`)

    // Calculate behavioral metrics
    const behavioralMetrics = calculateBehavioralMetrics(transcript, session)

    // Prepare knowledge context
    const knowledgeContext = session.knowledge_context || {}
    const knowledgeDocuments = knowledgeContext.documents || []

    // Build comprehensive GPT-4 analysis prompt
    const assessment = await analyzeServicePracticeSession(
      transcript,
      scenario,
      knowledgeDocuments,
      behavioralMetrics,
      session.language
    )

    // Cache the results in database
    const { error: updateError } = await supabaseAdmin
      .from('training_sessions')
      .update({
        service_practice_assessment_results: assessment,
        service_assessment_status: 'completed',
        service_assessment_completed_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('⚠️ Failed to cache assessment results:', updateError)
      // Continue anyway - we still return the results
    } else {
      console.log('✅ Assessment results cached successfully')
    }

    console.log(`📊 Assessment complete | Overall: ${assessment.overall_score}/100`)

    return NextResponse.json({
      success: true,
      sessionId,
      assessment,
      fromCache: false
    })

  } catch (error) {
    console.error('❌ Error in assess-service-practice-session API:', error)
    return NextResponse.json(
      { error: 'Internal server error during session assessment' },
      { status: 500 }
    )
  }
}

/**
 * Calculate behavioral metrics from transcript and session data
 */
function calculateBehavioralMetrics(
  transcript: ConversationMessage[],
  session: any
): { avg_response_time_seconds: number; session_duration_seconds: number; turn_balance: { employee: number; customer: number } } {
  // Calculate average response time (time between customer message and employee response)
  const responseTimes: number[] = []
  for (let i = 0; i < transcript.length - 1; i++) {
    const current = transcript[i]
    const next = transcript[i + 1]

    if (current.role === 'assistant' && next.role === 'user' && current.timestamp && next.timestamp) {
      const responseTime = (next.timestamp - current.timestamp) / 1000 // Convert to seconds
      if (responseTime > 0 && responseTime < 300) { // Ignore unrealistic times (>5 min)
        responseTimes.push(responseTime)
      }
    }
  }

  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
    : 0

  // Calculate session duration
  const startedAt = new Date(session.started_at).getTime()
  const endedAt = session.ended_at ? new Date(session.ended_at).getTime() : Date.now()
  const sessionDuration = Math.round((endedAt - startedAt) / 1000) // seconds

  // Calculate turn balance (word count ratio)
  let employeeWords = 0
  let customerWords = 0

  transcript.forEach(message => {
    const wordCount = message.content.trim().split(/\s+/).length
    if (message.role === 'user') {
      employeeWords += wordCount
    } else if (message.role === 'assistant') {
      customerWords += wordCount
    }
  })

  const totalWords = employeeWords + customerWords
  const employeePercent = totalWords > 0 ? Math.round((employeeWords / totalWords) * 100) : 50
  const customerPercent = 100 - employeePercent

  return {
    avg_response_time_seconds: Math.round(avgResponseTime * 10) / 10, // Round to 1 decimal
    session_duration_seconds: sessionDuration,
    turn_balance: {
      employee: employeePercent,
      customer: customerPercent
    }
  }
}

/**
 * Analyze Service Practice session using GPT-4
 */
async function analyzeServicePracticeSession(
  transcript: ConversationMessage[],
  scenario: any,
  knowledgeDocuments: any[],
  behavioralMetrics: any,
  language: string
): Promise<ServicePracticeAssessment> {
  try {
    // Format transcript for GPT-4
    const formattedTranscript = transcript.map((msg, idx) => {
      const role = msg.role === 'assistant' ? 'AI Customer' : 'Employee'
      return `${idx + 1}. [${role}]: ${msg.content}`
    }).join('\n')

    // Format knowledge documents
    const formattedKnowledge = knowledgeDocuments.map((doc, idx) => {
      return `${idx + 1}. ${doc.title}: ${doc.content}`
    }).join('\n\n')

    // Build context-aware prompt
    const milestonesList = Array.isArray(scenario.milestones)
      ? scenario.milestones.map((m: string, idx: number) => `${idx + 1}. ${m}`).join('\n')
      : 'No specific milestones defined'

    // Determine if de-escalation is relevant
    const needsDeescalation = ['angry', 'extremely_angry'].includes(scenario.customer_emotion_level)

    const prompt = `You are an expert customer service trainer evaluating a role-play training session.

SCENARIO CONTEXT:
- Training Mode: Service Practice
- Customer Emotion Level: ${scenario.customer_emotion_level}
- Situation: ${scenario.client_behavior || 'General customer service interaction'}
- Expected Employee Approach: ${scenario.expected_response}
- Language: ${language}

KEY MILESTONES TO ACHIEVE:
${milestonesList}

AVAILABLE KNOWLEDGE BASE (what employee should know):
${formattedKnowledge || 'No knowledge documents provided'}

CONVERSATION TRANSCRIPT:
${formattedTranscript}

CRITICAL INSTRUCTIONS:
⚠️ In the transcript above:
- Messages marked "[Employee]" are what the EMPLOYEE said (the person being trained)
- Messages marked "[AI Customer]" are what the AI CUSTOMER said (the role-play scenario)
- You must ONLY evaluate the "[Employee]" messages
- NEVER include "[AI Customer]" messages when providing examples of what the employee said
- When providing evidence or quotes, ONLY use text from "[Employee]" lines

EVALUATE THE EMPLOYEE'S PERFORMANCE on these metrics (score each 0-100):

1. **Empathy Score** - Use of empathetic language, acknowledgment of emotions, validation before offering solutions
2. **Professionalism Score** - Polite addressing, proper greetings/closings, appropriate formality, no slang
3. **Problem Resolution Quality** - Was a specific solution offered? Was it relevant? Did they confirm satisfaction?
4. **Communication Clarity** - Clear, easy-to-understand responses, avoiding jargon, proper structure
${needsDeescalation ? '5. **De-escalation Effectiveness** - Did the employee calm the customer? Avoided defensive language? Maintained calm tone?' : ''}
${needsDeescalation ? '6' : '5'}. **Product Knowledge Accuracy** - Correctly referenced menu items/products from knowledge base, no false information
${needsDeescalation ? '7' : '6'}. **Milestone Completion Rate** - Calculate percentage of milestones achieved (0-100)

For each milestone, determine if it was achieved (true/false) and provide brief evidence.

Also identify:
- **3 Key Strengths** with specific quotes from the transcript as evidence (ONLY from [Employee] lines)
- **3 Areas for Improvement** with examples of what the employee said vs. what would be better (ONLY from [Employee] lines - do NOT quote [AI Customer] lines)

Calculate an **Overall Performance Score** (0-100) as weighted average:
- Empathy: 20%
- Professionalism: 15%
- Problem Resolution: 25%
- Clarity: 15%
- De-escalation: ${needsDeescalation ? '15%' : '0% (N/A)'}
- Product Knowledge: 10%
- Milestones: ${needsDeescalation ? '0%' : '15%'}

IMPORTANT:
- Be fair but honest in your assessment
- Provide specific evidence with quotes (ONLY from [Employee] lines, NEVER from [AI Customer] lines)
- When you see a quote that starts with "[AI Customer]", that is NOT the employee speaking
- Consider cultural and language context
- Focus on actionable feedback

Respond in this exact JSON format:
{
  "overall_score": <number 0-100>,
  "metrics": {
    "empathy": <number 0-100>,
    "professionalism": <number 0-100>,
    "problem_resolution": <number 0-100>,
    "clarity": <number 0-100>,
    ${needsDeescalation ? '"deescalation": <number 0-100>,' : ''}
    "product_knowledge_accuracy": <number 0-100>,
    "milestone_completion_rate": <number 0-100>
  },
  "milestones_achieved": [
    {
      "milestone": "milestone text",
      "achieved": true/false,
      "evidence": "brief explanation or quote"
    }
  ],
  "strengths": [
    {
      "point": "what they did well",
      "evidence": "specific quote from transcript"
    }
  ],
  "improvements": [
    {
      "point": "what needs work",
      "current": "what employee said (optional)",
      "better": "what would be better (optional)"
    }
  ]
}`

    console.log('🤖 Sending analysis request to GPT-4...')

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Cost-effective for analysis
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.3, // Some creativity but mostly consistent
      response_format: { type: "json_object" }
    })

    const responseContent = response.choices[0]?.message?.content || '{}'
    console.log('📄 GPT-4 response received')

    let analysisResult
    try {
      analysisResult = JSON.parse(responseContent)
    } catch (parseError) {
      console.error('❌ Failed to parse GPT-4 response as JSON:', parseError)
      throw new Error('Invalid JSON response from GPT-4')
    }

    // Combine with behavioral metrics
    const finalAssessment: ServicePracticeAssessment = {
      overall_score: analysisResult.overall_score || 0,
      metrics: analysisResult.metrics || {},
      milestones_achieved: analysisResult.milestones_achieved || [],
      strengths: analysisResult.strengths || [],
      improvements: analysisResult.improvements || [],
      behavioral_metrics: behavioralMetrics
    }

    return finalAssessment

  } catch (error) {
    console.error('❌ Error analyzing Service Practice session:', error)
    throw error
  }
}
