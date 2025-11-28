/**
 * API Route: Sync Knowledge Base to ElevenLabs
 * POST /api/elevenlabs-knowledge-sync
 *
 * Creates/updates Knowledge Base document on ElevenLabs and links to agent
 */

import { NextRequest, NextResponse } from 'next/server'
import { elevenLabsKnowledgeService } from '@/lib/elevenlabs-knowledge'
import { getOrCreateCompanyKnowledgeBase, linkKnowledgeBaseToAgent, checkKnowledgeBaseStatus } from '@/lib/elevenlabs-knowledge-sync'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, scenarioId, agentId } = body

    if (!companyId || !scenarioId || !agentId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: companyId, scenarioId, agentId' },
        { status: 400 }
      )
    }

    console.log(`🔄 Syncing KB for company ${companyId}, scenario ${scenarioId}`)

    // 1. Load knowledge from database
    const knowledgeContext = await elevenLabsKnowledgeService.getScenarioKnowledge(
      scenarioId,
      companyId,
      5 // maxChunks
    )

    if (!knowledgeContext || !knowledgeContext.formattedContext) {
      return NextResponse.json(
        { success: false, error: 'No knowledge context found for this scenario' },
        { status: 404 }
      )
    }

    // 2. Get formatted knowledge for KB (menu items + company info only)
    const knowledgeText = knowledgeContext.formattedContext
    console.log(`📝 Knowledge text prepared: ${knowledgeText.length} characters`)

    // 3. Create or get cached KB document
    const kbDocument = await getOrCreateCompanyKnowledgeBase(
      companyId,
      scenarioId,
      knowledgeText
    )

    console.log(`✅ KB document ready:`, kbDocument)

    // 4. Link KB document to agent
    const linkResult = await linkKnowledgeBaseToAgent(agentId, [kbDocument])

    if (!linkResult.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to link KB to agent' },
        { status: 500 }
      )
    }

    // 5. Check KB document indexing status
    console.log('📊 Checking KB document indexing status...')
    try {
      const kbStatus = await checkKnowledgeBaseStatus(kbDocument.id)
      console.log('📊 KB Document Indexing Status:', {
        id: kbStatus.id,
        name: kbStatus.name,
        hasIndexes: kbStatus.rag_indexes?.length > 0,
        indexCount: kbStatus.rag_indexes?.length || 0,
      })
    } catch (statusError) {
      console.warn('⚠️ Could not check KB status:', statusError)
    }

    console.log(`✅ KB sync complete for agent ${agentId}`)

    return NextResponse.json({
      success: true,
      documentId: kbDocument.id,
      documentName: kbDocument.name,
      knowledgeLength: knowledgeText.length,
      documentsCount: knowledgeContext.documents.length,
    })

  } catch (error) {
    console.error('❌ KB sync error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
