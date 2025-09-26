/**
 * API endpoint to load scenario knowledge on the server-side
 * This is needed because client-side components can't access SUPABASE_SERVICE_ROLE_KEY
 */

import { NextRequest, NextResponse } from 'next/server'
import { elevenLabsKnowledgeService } from '@/lib/elevenlabs-knowledge'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { scenarioId, companyId, maxChunks = 5 } = body

    if (!scenarioId || !companyId) {
      return NextResponse.json(
        { error: 'Missing required fields: scenarioId, companyId' },
        { status: 400 }
      )
    }

    console.log(`🔄 Loading knowledge for scenario: ${scenarioId}, company: ${companyId}`)

    // Load scenario knowledge using the server-side service
    const knowledgeContext = await elevenLabsKnowledgeService.getScenarioKnowledge(
      scenarioId,
      companyId,
      maxChunks
    )

    console.log(`✅ Loaded knowledge context with ${knowledgeContext.documents.length} documents`)
    console.log(`📝 Context length: ${knowledgeContext.formattedContext.length} characters`)

    return NextResponse.json({
      success: true,
      data: knowledgeContext
    })

  } catch (error) {
    console.error('❌ Failed to load scenario knowledge:', error)
    return NextResponse.json(
      {
        error: 'Failed to load scenario knowledge',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}