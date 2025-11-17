import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { elevenLabsKnowledgeService } from '@/lib/elevenlabs-knowledge'
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
  manager_summary: string  // Friendly informal summary for employee
  metrics: {
    empathy: { score: number; feedback: string }
    professionalism: { score: number; feedback: string }
    problem_resolution: { score: number; feedback: string }
    clarity: { score: number; feedback: string }
    deescalation?: { score: number; feedback: string }
    product_knowledge_accuracy: { score: number; feedback: string }
    milestone_completion_rate: { score: number; feedback: string }
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

    // Prepare knowledge context with smart fallback strategy
    let knowledgeDocuments: any[] = []

    // Strategy 1: Try to use cached knowledge_context from session (fast path)
    if (session.knowledge_context && session.knowledge_context.documents && session.knowledge_context.documents.length > 0) {
      knowledgeDocuments = session.knowledge_context.documents
      console.log(`📚 Using cached knowledge from session: ${knowledgeDocuments.length} documents`)
    }
    // Strategy 2: Fetch knowledge directly from database (robust fallback)
    else {
      console.log(`⚠️ No cached knowledge_context found in session, fetching from database...`)

      if (!session.scenario_id) {
        console.warn(`⚠️ WARNING: No scenario_id in session ${sessionId}`)
      } else if (!session.company_id) {
        console.warn(`⚠️ WARNING: No company_id in session ${sessionId}`)
      } else {
        try {
          console.log(`🔄 Fetching knowledge for scenario ${session.scenario_id}, company ${session.company_id}`)

          // Use the existing knowledge service to fetch documents
          const knowledgeContext = await elevenLabsKnowledgeService.getScenarioKnowledge(
            session.scenario_id,
            session.company_id,
            8 // maxChunks - use 8 for service practice (consistent with original logic)
          )

          knowledgeDocuments = knowledgeContext.documents
          console.log(`✅ Successfully fetched knowledge from database: ${knowledgeDocuments.length} documents`)
          console.log(`📝 Knowledge scope: ${knowledgeContext.knowledgeScope} for ${knowledgeContext.scenarioType} scenario`)

          // Log sample document titles for debugging
          if (knowledgeDocuments.length > 0) {
            const sampleTitles = knowledgeDocuments.slice(0, 3).map(d => d.title).join(', ')
            console.log(`📄 Sample documents: ${sampleTitles}${knowledgeDocuments.length > 3 ? '...' : ''}`)
          }
        } catch (fetchError) {
          console.error(`❌ Failed to fetch knowledge from database:`, fetchError)
          console.error(`   Session ID: ${sessionId}`)
          console.error(`   Scenario ID: ${session.scenario_id}`)
          console.error(`   Company ID: ${session.company_id}`)
        }
      }
    }

    // Final validation
    console.log(`📚 Total knowledge documents available for assessment: ${knowledgeDocuments.length}`)
    if (knowledgeDocuments.length === 0) {
      console.warn('⚠️ ============================================')
      console.warn('⚠️ WARNING: No knowledge documents available!')
      console.warn('⚠️ Product knowledge validation will be limited or impossible')
      console.warn(`⚠️ Session ID: ${sessionId}`)
      console.warn(`⚠️ Scenario ID: ${scenario?.id}`)
      console.warn('⚠️ This means the employee CANNOT be properly assessed for product knowledge accuracy')
      console.warn('⚠️ The system will still generate a score, but it will not be able to validate menu items')
      console.warn('⚠️ ============================================')
    } else {
      console.log(`✅ Knowledge base ready for product validation (${knowledgeDocuments.length} documents loaded)`)
    }

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

EVALUATE THE EMPLOYEE'S PERFORMANCE on these metrics (score each 0-100 AND provide 2-3 sentence feedback):

1. **Empathy Score (0-100)** - Use of empathetic language, acknowledgment of emotions, validation before offering solutions
   **Empathy Feedback (2-3 sentences)** - Directly address the employee using "you" pronouns. Quote specific examples from the transcript showing empathy or lack thereof. If low score, explain what was missing and what they should do differently. Example: "You struggled to acknowledge the customer's emotions. When they said 'This is unacceptable!', you immediately offered solutions without first validating their frustration. Try phrases like 'I understand how frustrating this must be' before problem-solving."

2. **Professionalism Score (0-100)** - Polite addressing, proper greetings/closings, appropriate formality, no slang
   **Professionalism Feedback (2-3 sentences)** - Address the employee directly with specific examples. Quote inappropriate language if applicable. If violations exist, explain what was wrong and the correct approach.

3. **Problem Resolution Quality (0-100)** - Was a specific solution offered? Was it relevant? Did they confirm satisfaction?
   **Problem Resolution Feedback (2-3 sentences)** - Tell the employee what they did well or poorly in solving the issue. Quote their solution attempts. Explain what would have been more effective.

4. **Communication Clarity (0-100)** - Clear, easy-to-understand responses, avoiding jargon, proper structure
   **Communication Clarity Feedback (2-3 sentences)** - Give the employee specific examples of clear or unclear communication from the transcript. If confusing, quote the unclear parts and explain how to rephrase.
${needsDeescalation ? '5. **De-escalation Effectiveness Score (0-100)** - Did the employee calm the customer? Avoided defensive language? Maintained calm tone?\n   **De-escalation Feedback (2-3 sentences)** - Tell the employee how they handled the escalated situation. Quote their de-escalation attempts or failures. Explain techniques they used well or should have used.' : ''}
${needsDeescalation ? '6' : '5'}. **Product Knowledge Accuracy Score (0-100)** - ⚠️ CRITICAL VALIDATION METRIC ⚠️
   - You MUST cross-reference EVERY menu item, product, dish, or ingredient the employee mentioned against the knowledge base provided above
   - If the employee mentioned ANY item that does NOT exist in the knowledge base → They INVENTED/FABRICATED it → This is a SEVERE VIOLATION
   - Scoring rules:
     * ALL items correctly match knowledge base: 90-100
     * Minor errors (wrong price, wrong size): 60-80
     * ONE invented/fake item: 20-40
     * MULTIPLE invented/fake items: 0-20
   - If ANY fake items are found:
     * You MUST quote the exact fake items in the manager_summary
     * Use clear language: "invented", "fabricated", "not on our menu", "does not exist"
     * This MUST appear as one of the numbered moments in the walkthrough
     * Overall score MUST be below 50 when multiple fake items exist
   - If knowledge base is empty/missing: Score as "N/A" and state "Cannot validate product knowledge - no menu provided"
   **Product Knowledge Feedback (2-3 sentences)** - Address the employee about their product knowledge accuracy. If they mentioned fake items, quote them and explain they don't exist on the menu. If accurate, praise their knowledge and cite specific examples.

${needsDeescalation ? '7' : '6'}. **Milestone Completion Rate Score (0-100)** - Calculate percentage of milestones achieved (0-100)
   **Milestone Completion Feedback (2-3 sentences)** - Tell the employee which milestones they achieved or missed. Explain why certain milestones weren't met and what they need to do to achieve them next time.

For each milestone, determine if it was achieved (true/false) and provide brief evidence.

Also identify:
- **3 Key Strengths** with specific quotes from the transcript as evidence (ONLY from [Employee] lines)
- **3 Areas for Improvement** with examples of what the employee said vs. what would be better (ONLY from [Employee] lines - do NOT quote [AI Customer] lines)

⚠️ **CRITICAL REQUIREMENT - MANAGER WALKTHROUGH** ⚠️

You MUST create a detailed, step-by-step walkthrough of the conversation, NOT a generic summary.

**MANDATORY FORMAT WITH CLEAR STRUCTURE** (You will be penalized for generic or unformatted responses):

1. **Opening Line**: Start with: "Let's walk through what happened in this session."

2. **Add blank line** (use \n\n)

3. **Chronological Moments** - List 3-5 specific moments with numbered format:

   **1. [Brief moment title]**
   At the beginning, when the customer said [quote], you responded with [exact employee quote]. This was [good/problematic] because [explanation]. [If bad: What you should have done instead: 'Better response here.']

   **2. [Brief moment title]**
   Then, when [specific event], you said [exact employee quote]. [Explanation]. [Alternative if needed]

   **3. [Brief moment title]**
   Later in the conversation... [continue pattern]

4. **Add blank line** (use \n\n)

5. **Key Takeaways** - Use bullet points:

   **Key takeaways:**
   • [First takeaway]
   • [Second takeaway]
   • [Third takeaway if relevant]

**FORMATTING RULES**:
- Use \n\n for paragraph breaks (double newline)
- Use **text** for bold section headers
- Use numbered format: "**1. Title**" then paragraph
- Use bullet points (•) for lists
- Each moment should be its own clear paragraph
- Minimum 10 sentences total with at least 3-5 specific quoted moments

**⚠️ PRODUCT KNOWLEDGE REQUIREMENT**:
- If the employee mentioned ANY menu items, products, or dishes that do NOT exist in the knowledge base provided above:
  * You MUST include this as one of your numbered chronological moments
  * Title it something like: "**X. Invented/Fabricated Menu Items**" or "**X. Inaccurate Product Information**"
  * Quote the EXACT fake items the employee mentioned
  * Clearly state: "This item does not exist on our menu" or "You fabricated this dish"
  * Explain what they should have done instead (offered real menu items from knowledge base)
- Product knowledge errors are just as important as professionalism violations

**EXAMPLES OF GOOD WALKTHROUGH**:
❌ BAD (too generic): "You showed some effort but there were serious issues with professionalism."

✅ GOOD (properly formatted):
"Let's walk through what happened in this session.

**1. Initial Greeting**
At the start, when the customer said 'Здравствуйте', you responded with 'Добрый день. У вас есть бронестола?' This was problematic because you asked if they had a reservation instead of directly addressing their request for a menu. A better response would have been to say, 'Добро пожаловать! Позвольте мне принести вам меню.'

**2. Menu Request Delay**
Then, when the customer asked for the menu, you said, 'Одну секундочку, я проверю наличие столов и вернусь к вам через минутку. Прошу!' This caused unnecessary delay. You should have immediately provided the menu instead of checking for a table, which was unnecessary.

**3. Refusal to Escalate**
Later in the conversation, when the customer requested to speak with a manager, you said, 'Менеджер недоступен.' This was unacceptable as it dismissed the customer's request for escalation. Instead, you should have offered to find the manager or take their contact information.

**Key takeaways:**
• Always prioritize immediate customer requests
• Maintain professionalism and never dismiss escalation requests
• Provide clear, direct responses without unnecessary delays"

**LENGTH REQUIREMENT**: MINIMUM 10 sentences with at least 3-5 specific quoted moments from the transcript.

**SERIOUS VIOLATIONS** (threats, bribes, refusal to escalate, violence):
- You MUST quote the exact concerning words
- You MUST explain why it's a serious violation
- You MUST use strong language: "unacceptable", "completely inappropriate", "serious violation", "immediate corrective action needed"

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

**CRITICAL - SERIOUS VIOLATIONS THAT REQUIRE LOW SCORES (0-20 in affected metrics)**:
- Threats of violence or harm (e.g., "I'll cut off my finger", physical threats)
- Bribing customers
- Refusing to escalate to manager when explicitly requested by customer
- Forcing/threatening customers to leave
- Discriminatory language or behavior
- Any behavior that would result in immediate termination in real workplace

If ANY of these occur, the professionalism score MUST be 0-20, and overall score MUST be below 40.

---

🔴 **FINAL REMINDER BEFORE YOU RESPOND** 🔴

For the "manager_summary" field, you MUST provide a DETAILED CHRONOLOGICAL WALKTHROUGH with PROPER FORMATTING:
✅ Start with: "Let's walk through what happened in this session."
✅ Add blank line (use \n\n)
✅ Use numbered sections: "**1. [Title]**" then paragraph for each moment
✅ Include 3-5 specific moments with EXACT QUOTES from [Employee] lines
✅ Explain WHY each moment was good or bad
✅ State what SHOULD have been done instead for mistakes
✅ **⚠️ IF EMPLOYEE MENTIONED FAKE/INVENTED MENU ITEMS**: This MUST be one of your numbered moments with exact quotes and clear statement "this does not exist on our menu"
✅ Add blank line before "**Key takeaways:**"
✅ Use bullet points (•) for key takeaways list
✅ Minimum 10 sentences
❌ NO generic summaries like "There were issues with professionalism"
❌ NO vague statements without specific quotes
❌ NO single-paragraph walls of text
❌ NO ignoring product knowledge errors - they are as serious as professionalism violations

---

Respond in this exact JSON format:
{
  "overall_score": <number 0-100>,
  "manager_summary": "DETAILED CHRONOLOGICAL WALKTHROUGH with PROPER FORMATTING. MUST start with 'Let's walk through what happened in this session.' then blank line (\\n\\n), then numbered sections using '**1. [Title]**' format for each moment (3-5 moments) with EXACT QUOTES from [Employee] lines, then blank line, then '**Key takeaways:**' with bullet points (•). Minimum 10 sentences. Use \\n\\n for paragraph breaks.",
  "metrics": {
    "empathy": {
      "score": <number 0-100>,
      "feedback": "2-3 sentences directly addressing employee with 'you', quoting specific examples from transcript, explaining what was good/bad and what to improve"
    },
    "professionalism": {
      "score": <number 0-100>,
      "feedback": "2-3 sentences with specific examples, using conversational manager tone"
    },
    "problem_resolution": {
      "score": <number 0-100>,
      "feedback": "2-3 sentences about their solution approach, quoting their attempts, suggesting improvements"
    },
    "clarity": {
      "score": <number 0-100>,
      "feedback": "2-3 sentences about communication clarity, quoting clear or unclear parts, explaining how to improve"
    },
    ${needsDeescalation ? '"deescalation": {\n      "score": <number 0-100>,\n      "feedback": "2-3 sentences about de-escalation techniques used or missed, with specific examples"\n    },' : ''}
    "product_knowledge_accuracy": {
      "score": <number 0-100>,
      "feedback": "2-3 sentences about product knowledge. If fake items were mentioned, MUST quote them and state they don't exist on menu. If accurate, praise with examples."
    },
    "milestone_completion_rate": {
      "score": <number 0-100>,
      "feedback": "2-3 sentences about which milestones were achieved/missed and why, with guidance on improvement"
    }
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
      messages: [
        {
          role: 'system',
          content: 'You are an expert training manager conducting a detailed coaching session. You MUST provide specific, chronological walkthroughs with exact quotes from the conversation, not generic summaries. Be thorough, specific, and quote actual words the employee said.'
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 4000, // Increased for detailed manager walkthrough with quotes
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
      manager_summary: analysisResult.manager_summary || "Let's review this session together. I'll walk through what I observed and we'll identify areas for improvement. Please review the detailed analysis below.",
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
