/**
 * Test endpoint to simulate the exact session start flow with dynamic knowledge
 */

import { NextRequest, NextResponse } from 'next/server'
import { elevenLabsKnowledgeService } from '@/lib/elevenlabs-knowledge'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { scenarioId, companyId } = body

    console.log(`🚀 Simulating session start for scenario: ${scenarioId}`)

    // Step 1: Load knowledge context (same as loadKnowledgeContext function)
    const loadedContext = await elevenLabsKnowledgeService.getScenarioKnowledge(
      scenarioId,
      companyId,
      5
    )

    console.log('🔄 Knowledge loaded in startSession:', loadedContext ? `${loadedContext.documents?.length || 0} documents` : 'No context')

    // Step 2: Simulate initializeConversation with loaded context
    const contextToUse = loadedContext
    console.log('🔍 Using knowledge context:', contextToUse ? `${contextToUse.documents?.length || 0} documents loaded` : 'No context available')

    const trainingMode = 'theory' // Default for demo scenarios

    // Step 3: Create dynamic variables (same as in initializeConversation)
    const HARDCODED_KNOWLEDGE_BASE = '[HARD-CODED] Coffee shop menu with drinks and pastries'
    const HARDCODED_EXAMINER_INSTRUCTIONS = '[HARD-CODED] Strict theory examiner for coffee shop knowledge'

    const dynamicVariables = {
      training_mode: trainingMode,
      company_name: companyId,
      difficulty_level: 'intermediate',
      session_type: 'assessment',
      language: 'en',
      // This is the critical line - use dynamic or fallback to hard-coded
      knowledge_context: contextToUse?.formattedContext || HARDCODED_KNOWLEDGE_BASE,
      knowledge_scope: contextToUse?.knowledgeScope || 'restricted',
      documents_available: contextToUse?.documents?.length || 1,
      examiner_instructions: contextToUse?.formattedContext ?
        `You are a STRICT THEORY EXAMINER for a company training. Ask specific, factual questions based on this knowledge context and move immediately to the next question after any student response.` :
        HARDCODED_EXAMINER_INSTRUCTIONS
    }

    // Check what we're actually sending
    const isUsingDynamicContent = !dynamicVariables.knowledge_context.includes('[HARD-CODED]')
    const isUsingDynamicInstructions = !dynamicVariables.examiner_instructions.includes('[HARD-CODED]')

    return NextResponse.json({
      success: true,
      sessionStartSimulation: {
        knowledgeLoaded: !!loadedContext,
        documentsCount: loadedContext?.documents?.length || 0,
        isUsingDynamicContent,
        isUsingDynamicInstructions,
        contentPreview: dynamicVariables.knowledge_context.substring(0, 100) + '...',
        instructionsPreview: dynamicVariables.examiner_instructions.substring(0, 100) + '...'
      },
      dynamicVariables,
      // Show what ElevenLabs would receive
      elevenLabsWouldReceive: {
        knowledge_context: dynamicVariables.knowledge_context,
        examiner_instructions: dynamicVariables.examiner_instructions,
        documents_available: dynamicVariables.documents_available
      }
    })

  } catch (error) {
    console.error('❌ Session start simulation failed:', error)
    return NextResponse.json(
      {
        error: 'Session start simulation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}