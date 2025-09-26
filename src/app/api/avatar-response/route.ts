import { NextRequest, NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import { aiQuestionGenerator } from '@/lib/ai-question-generator'
import { knowledgeBaseService } from '@/lib/knowledge-base'
import { elevenLabsKnowledgeService } from '@/lib/elevenlabs-knowledge'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface ConversationChunk {
  type: 'partial' | 'final'
  text: string
  speaker: 'user' | 'avatar'
  timestamp: number
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      userInput,
      conversationHistory = [],
      language = 'en',
      companyId = 'demo-company-1',
      scenarioContext = {},
      scenarioId
    } = body

    console.log(`🤖 Generating avatar response for user input: "${userInput}"`)

    // Build conversation context from history
    const conversationContext = buildConversationContext(conversationHistory)

    // Generate contextual response based on conversation state
    const response = await generateContextualResponse({
      userInput,
      conversationContext,
      language,
      companyId,
      scenarioContext,
      scenarioId
    })

    return NextResponse.json({
      success: true,
      text: response.text,
      type: response.type, // 'question', 'acknowledgment', 'followup', 'conclusion'
      confidence: response.confidence,
      next_expected: response.nextExpected,
      conversation_state: response.conversationState
    })

  } catch (error) {
    console.error('❌ Avatar response generation failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Response generation failed',
        text: getErrorFallbackResponse(language), // Fallback response to maintain flow
        type: 'fallback'
      },
      { status: 200 } // Use 200 to maintain conversation flow
    )
  }
}

/**
 * Build conversation context from history
 */
function buildConversationContext(history: ConversationChunk[]): string {
  return history
    .filter(chunk => chunk.type === 'final') // Only include final transcripts
    .map(chunk => `${chunk.speaker}: ${chunk.text}`)
    .join('\n')
}

/**
 * Generate contextual response based on conversation state
 */
async function generateContextualResponse({
  userInput,
  conversationContext,
  language,
  companyId,
  scenarioContext,
  scenarioId
}: {
  userInput: string
  conversationContext: string
  language: string
  companyId: string
  scenarioContext: any
  scenarioId?: string
}): Promise<{
  text: string
  type: string
  confidence: number
  nextExpected: string
  conversationState: string
}> {

  // Determine conversation state and appropriate response strategy
  const conversationState = analyzeConversationState(conversationContext, userInput)

  // Get scenario-specific knowledge context
  let knowledgeContext = ''
  try {
    if (scenarioId) {
      console.log(`🧠 Loading scenario-specific knowledge for: ${scenarioId}`)
      const scenarioKnowledge = await elevenLabsKnowledgeService.getScenarioKnowledge(
        scenarioId,
        companyId,
        5 // Max 5 knowledge chunks
      )
      knowledgeContext = scenarioKnowledge.formattedContext
      console.log(`✅ Scenario knowledge loaded: ${scenarioKnowledge.documents.length} documents, scope: ${scenarioKnowledge.knowledgeScope}`)
    } else {
      // Fallback to general company knowledge if no scenario provided
      console.log('⚠️ No scenario ID provided, using general knowledge')
      const documents = await knowledgeBaseService.getDocuments(companyId)
      if (documents.length > 0) {
        const sampleDocs = documents.slice(0, 3)
        knowledgeContext = sampleDocs
          .map(doc => `- ${doc.title}: ${doc.content.substring(0, 200)}...`)
          .join('\n')
      }
    }
  } catch (error) {
    console.warn('⚠️ Could not load knowledge context:', error)
    knowledgeContext = 'No specific knowledge available for this session.'
  }

  // Generate response using GPT-4
  const systemPrompt = buildSystemPrompt(language, knowledgeContext, conversationState)
  const userPrompt = buildUserPrompt(userInput, conversationContext, conversationState)

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 150, // Keep responses concise for natural conversation
    temperature: 0.7, // Balanced creativity
  })

  const responseText = completion.choices[0]?.message?.content?.trim() || ''

  // Analyze response type and next steps
  const responseType = classifyResponseType(responseText, conversationState)
  const nextExpected = determineNextExpected(responseType, conversationState)

  return {
    text: responseText,
    type: responseType,
    confidence: 0.85,
    nextExpected,
    conversationState: conversationState.type
  }
}

/**
 * Analyze conversation state to determine appropriate response strategy
 */
function analyzeConversationState(context: string, userInput: string): {
  type: string
  questionsAsked: number
  userEngagement: string
  needsFollowup: boolean
} {
  const lines = context.split('\n').filter(line => line.trim())
  const avatarLines = lines.filter(line => line.startsWith('avatar:'))
  const userLines = lines.filter(line => line.startsWith('user:'))

  // Analyze user engagement
  let userEngagement = 'good'
  if (userInput.length < 5) userEngagement = 'low'
  else if (userInput.length > 50) userEngagement = 'high'

  // Determine conversation state
  let type = 'initial'
  if (avatarLines.length === 0) type = 'greeting'
  else if (avatarLines.length < 3) type = 'building'
  else if (avatarLines.length < 8) type = 'active'
  else type = 'concluding'

  return {
    type,
    questionsAsked: avatarLines.length,
    userEngagement,
    needsFollowup: userInput.toLowerCase().includes('what') || userInput.endsWith('?')
  }
}

/**
 * Build system prompt for response generation
 */
function buildSystemPrompt(language: string, knowledgeContext: string, conversationState: any): string {
  const languageInstructions = getLanguageInstructions(language)

  return `You are an AI training avatar conducting a knowledge assessment conversation in ${language}. Your role is to:

1. Ask relevant questions about the company's products, services, and policies
2. Acknowledge user responses appropriately
3. Follow up on incomplete or unclear answers
4. Maintain natural, flowing conversation
5. Keep responses concise (1-2 sentences)

${languageInstructions}

Current conversation state: ${conversationState.type}
Questions asked so far: ${conversationState.questionsAsked}
User engagement: ${conversationState.userEngagement}

Available knowledge base context:
${knowledgeContext || 'No specific knowledge base available - ask general company questions.'}

Guidelines:
- If this is the start (greeting/initial), ask a warm opening question
- If user gave a good answer, acknowledge briefly then ask a follow-up question
- If user gave a short/unclear answer, ask for more detail
- If user seems disengaged, ask a more engaging question
- If many questions asked (8+), start concluding the session
- Always maintain professional, encouraging tone
- Ask one question at a time
- Make questions specific and relevant to the company context`
}

/**
 * Build user prompt with conversation context
 */
function buildUserPrompt(userInput: string, conversationContext: string, conversationState: any): string {
  return `Conversation so far:
${conversationContext || 'No previous conversation'}

User just said: "${userInput}"

Generate your next response as the AI avatar. Consider:
- The user's response quality and completeness
- Whether to acknowledge their answer
- What relevant question to ask next
- The overall conversation flow and state

Respond naturally and keep it conversational.`
}

/**
 * Classify the type of response generated
 */
function classifyResponseType(responseText: string, conversationState: any): string {
  const text = responseText.toLowerCase()

  if (text.includes('thank') || text.includes('great') || text.includes('good')) {
    return 'acknowledgment'
  }
  if (text.includes('?')) {
    return 'question'
  }
  if (text.includes('tell me more') || text.includes('can you explain')) {
    return 'followup'
  }
  if (text.includes('conclude') || text.includes('wrap up') || conversationState.questionsAsked > 8) {
    return 'conclusion'
  }

  return 'statement'
}

/**
 * Determine what type of response we expect from user next
 */
function determineNextExpected(responseType: string, conversationState: any): string {
  switch (responseType) {
    case 'question':
      return 'detailed_answer'
    case 'followup':
      return 'clarification'
    case 'acknowledgment':
      return 'ready_for_next'
    case 'conclusion':
      return 'session_end'
    default:
      return 'general_response'
  }
}

/**
 * Get language-specific instructions
 */
function getLanguageInstructions(language: string): string {
  const instructions: Record<string, string> = {
    ru: 'Отвечайте на русском языке. Будьте профессиональны и поддерживающими.',
    ka: 'გიპასუხეთ ქართულ ენაზე. იყავით პროფესიონალი და ამხანაგური.',
    es: 'Responde en español. Sé profesional y alentador.',
    fr: 'Répondez en français. Soyez professionnel et encourageant.',
    de: 'Antworten Sie auf Deutsch. Seien Sie professionell und ermutigend.',
    // Add more languages as needed
  }

  return instructions[language] || 'Respond in English. Be professional and encouraging.'
}

/**
 * Fallback response for errors
 */
function getErrorFallbackResponse(language: string): string {
  const fallbacks: Record<string, string> = {
    en: "I understand. Let me ask you another question about our services.",
    ru: "Понятно. Позвольте задать вам другой вопрос о наших услугах.",
    ka: "მესმის. მოდით გავქვათ კითხვა ჩვენი სერვისების შესახებ.",
    es: "Entiendo. Permíteme hacerte otra pregunta sobre nuestros servicios.",
    fr: "Je comprends. Permettez-moi de vous poser une autre question sur nos services.",
    de: "Ich verstehe. Lassen Sie mich Ihnen eine andere Frage zu unseren Dienstleistungen stellen."
  }

  return fallbacks[language] || fallbacks.en
}