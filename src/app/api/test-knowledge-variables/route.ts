/**
 * Test endpoint to show what dynamic variables are being generated for ElevenLabs
 */

import { NextRequest, NextResponse } from 'next/server'
import { elevenLabsKnowledgeService } from '@/lib/elevenlabs-knowledge'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { scenarioId, companyId } = body

    if (!scenarioId || !companyId) {
      return NextResponse.json(
        { error: 'Missing required fields: scenarioId, companyId' },
        { status: 400 }
      )
    }

    console.log(`🧪 Testing knowledge variables for scenario: ${scenarioId}`)

    // Load scenario knowledge
    const knowledgeContext = await elevenLabsKnowledgeService.getScenarioKnowledge(
      scenarioId,
      companyId,
      5
    )

    // Create the same variables that would be sent to ElevenLabs
    const trainingMode = knowledgeContext.scenarioType === 'theory' ? 'theory' : 'service_practice'

    const examinerInstructions = `You are an AI training examiner conducting a ${trainingMode} training session.

${trainingMode === 'theory'
  ? `THEORY Q&A MODE:
- Ask specific, factual questions based on the knowledge provided
- Test knowledge of procedures, policies, prices, and facts
- Move to the next question after any answer (don't get stuck on wrong answers)
- Ask one question at a time
- Be strict but fair in your evaluation`
  : `SERVICE PRACTICE MODE:
- You are a customer in a realistic service scenario
- Present challenges that test the employee's service skills
- Use the knowledge base to create authentic customer requests
- Respond as a customer would in real situations`
}

Keep questions focused on the specific knowledge provided. Stay in character as a professional examiner.`

    const dynamicVariables = {
      examiner_instructions: examinerInstructions,
      knowledge_context: knowledgeContext.formattedContext,
      training_mode: trainingMode,
      documents_available: `${knowledgeContext.documents.length} knowledge documents loaded from: ${knowledgeContext.documents.map(d => d.title).join(', ')}`
    }

    return NextResponse.json({
      success: true,
      scenarioId,
      variables: dynamicVariables,
      metadata: {
        documentsCount: knowledgeContext.documents.length,
        knowledgeScope: knowledgeContext.knowledgeScope,
        contextLength: knowledgeContext.formattedContext.length,
        documentTitles: knowledgeContext.documents.map(d => d.title)
      }
    })

  } catch (error) {
    console.error('❌ Failed to generate test variables:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate test variables',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}