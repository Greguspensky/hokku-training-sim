/**
 * Test endpoint to simulate the complete ElevenLabs session initialization flow
 * This shows exactly what would be sent to ElevenLabs without actually starting a session
 */

import { NextRequest, NextResponse } from 'next/server'
import { elevenLabsKnowledgeService } from '@/lib/elevenlabs-knowledge'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { scenarioId, companyId, agentId = 'agent_0201k5h7pzgve478dn5fnh21r35n' } = body

    if (!scenarioId || !companyId) {
      return NextResponse.json(
        { error: 'Missing required fields: scenarioId, companyId' },
        { status: 400 }
      )
    }

    console.log(`🔄 Testing complete flow for scenario: ${scenarioId}`)

    // Step 1: Load scenario knowledge (same as what ElevenLabsAvatarSession does)
    const knowledgeContext = await elevenLabsKnowledgeService.getScenarioKnowledge(
      scenarioId,
      companyId,
      5
    )

    // Step 2: Build dynamic variables (same as what ElevenLabsAvatarSession does)
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

    // Step 3: Show what would be sent to conversation service
    console.log('🔧 Dynamic variables that would be sent to ElevenLabs:')
    console.log('- Training mode:', dynamicVariables.training_mode)
    console.log('- Documents available:', dynamicVariables.documents_available)
    console.log('- Knowledge context preview:', dynamicVariables.knowledge_context.substring(0, 200) + '...')
    console.log('- Instructions preview:', dynamicVariables.examiner_instructions.substring(0, 100) + '...')

    // Check if we're using hard-coded content
    const isUsingHardcodedContent = dynamicVariables.knowledge_context.includes('[HARD-CODED]') ||
                                   dynamicVariables.knowledge_context.includes('COFFEE SHOP MENU') ||
                                   dynamicVariables.knowledge_context.includes('Эспрессо')

    return NextResponse.json({
      success: true,
      testResult: {
        scenarioId,
        dynamicContentLoaded: !isUsingHardcodedContent,
        documentsLoaded: knowledgeContext.documents.length,
        documentTitles: knowledgeContext.documents.map(d => d.title),
        trainingMode,
        contextLength: dynamicVariables.knowledge_context.length,
        sampleQuestionTopic: knowledgeContext.documents[0]?.title || 'No documents',
        isReplacingHardcodedContent: !isUsingHardcodedContent
      },
      dynamicVariables,
      // Show preview of what agent would see
      agentSystemPrompt: `{{examiner_instructions}}

Use this knowledge base to ask questions:
{{knowledge_context}}

Training mode: {{training_mode}}
Available documents: {{documents_available}}`
    })

  } catch (error) {
    console.error('❌ Complete flow test failed:', error)
    return NextResponse.json(
      {
        error: 'Complete flow test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}