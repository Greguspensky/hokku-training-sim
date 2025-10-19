/**
 * ElevenLabs Knowledge Base Synchronization Service
 * Manages uploading menu/company data to ElevenLabs Knowledge Base and linking to agents
 */

export interface KnowledgeBaseDocument {
  id: string
  name: string
}

export interface KnowledgeBaseLinkResult {
  success: boolean
  documentId?: string
  error?: string
}

/**
 * Create a Knowledge Base document from text
 * @param text - The content to upload (menu items + company info)
 * @param name - Document name (e.g., "Company Menu - Camera Obscura")
 * @returns Document ID and name
 */
export async function createKnowledgeBaseDocument(
  text: string,
  name: string
): Promise<KnowledgeBaseDocument> {
  const apiKey = process.env.ELEVENLABS_API_KEY

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY not configured')
  }

  console.log(`📤 Creating ElevenLabs KB document: "${name}"`)
  console.log(`📊 Content length: ${text.length} characters`)

  const response = await fetch('https://api.elevenlabs.io/v1/convai/knowledge-base/text', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      name,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('❌ Failed to create KB document:', errorData)
    throw new Error(`ElevenLabs KB API error: ${response.status} - ${JSON.stringify(errorData)}`)
  }

  const result = await response.json()
  console.log(`✅ KB document created: ${result.id}`)

  return {
    id: result.id,
    name: result.name,
  }
}

/**
 * Link Knowledge Base documents to an agent
 * @param agentId - ElevenLabs agent ID
 * @param documents - Array of KB documents {id, name} to link
 * @returns Success status
 */
export async function linkKnowledgeBaseToAgent(
  agentId: string,
  documents: KnowledgeBaseDocument[]
): Promise<KnowledgeBaseLinkResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY not configured')
  }

  console.log(`🔗 Linking ${documents.length} KB documents to agent ${agentId}`)
  console.log(`📋 Documents to link:`, documents.map(d => ({ id: d.id, name: d.name })))

  // Construct knowledge_base array according to ElevenLabs API spec
  // IMPORTANT: ElevenLabs requires 'name' field or API returns 400 error
  const knowledgeBase = documents.map(doc => ({
    type: 'text' as const,
    id: doc.id,
    name: doc.name,  // REQUIRED by ElevenLabs API
    usage_mode: 'auto' as const, // ElevenLabs confirmed: use "auto" for menu items
  }))

  const requestBody = {
    conversation_config: {
      agent: {
        prompt: {
          knowledge_base: knowledgeBase,
          rag: {
            enabled: true,
            max_retrieved_rag_chunks_count: 5,
            max_documents_length: 5000,
          },
        },
      },
    },
  }

  console.log('📤 FULL REQUEST BODY being sent to ElevenLabs:')
  console.log(JSON.stringify(requestBody, null, 2))

  const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
    method: 'PATCH',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('❌ Failed to link KB to agent:', errorData)
    console.error('❌ Response status:', response.status, response.statusText)
    throw new Error(`ElevenLabs Agent API error: ${response.status} - ${JSON.stringify(errorData)}`)
  }

  const responseData = await response.json()
  console.log('📥 PATCH Response from ElevenLabs:')
  console.log(JSON.stringify(responseData, null, 2))

  console.log(`✅ KB documents linked to agent ${agentId}`)

  // Verify the agent configuration by fetching it back
  console.log('🔍 Verifying agent configuration...')
  const verifyResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
    method: 'GET',
    headers: {
      'xi-api-key': apiKey,
    },
  })

  if (verifyResponse.ok) {
    const agentConfig = await verifyResponse.json()
    console.log('📋 Current Agent Configuration:')
    console.log(JSON.stringify(agentConfig.conversation_config?.agent?.prompt || {}, null, 2))

    const kbStatus = agentConfig.conversation_config?.agent?.prompt?.knowledge_base
    const ragStatus = agentConfig.conversation_config?.agent?.prompt?.rag
    console.log('📊 Knowledge Base Status:', kbStatus ? `${kbStatus.length} documents linked` : 'NOT LINKED')
    console.log('📊 RAG Status:', ragStatus ? 'ENABLED' : 'NOT ENABLED')
  } else {
    console.warn('⚠️ Could not verify agent configuration')
  }

  return {
    success: true,
    documentId: documents[0].id, // Return first document ID for reference
  }
}

/**
 * Search for existing Knowledge Base document by name
 * @param documentName - Full document name to search for
 * @returns KB document {id, name} if found, null otherwise
 */
async function searchExistingDocument(documentName: string): Promise<KnowledgeBaseDocument | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY

  if (!apiKey) {
    console.warn('⚠️ ELEVENLABS_API_KEY not configured, cannot search for existing documents')
    return null
  }

  try {
    console.log(`🔍 Searching ElevenLabs API for existing document: "${documentName}"`)

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/knowledge-base?search=${encodeURIComponent(documentName)}&types=text`,
      {
        headers: {
          'xi-api-key': apiKey,
        },
      }
    )

    if (!response.ok) {
      console.warn(`⚠️ Search request failed: ${response.status} ${response.statusText}`)
      return null
    }

    const data = await response.json()
    console.log(`📊 Search returned ${data.documents?.length || 0} documents`)

    // Find exact match by name
    const matchingDoc = data.documents?.find((doc: any) => doc.name === documentName)

    if (matchingDoc) {
      console.log(`✅ Found existing document:`, { id: matchingDoc.id, name: matchingDoc.name })
      return {
        id: matchingDoc.id,
        name: matchingDoc.name,
      }
    }

    console.log(`ℹ️ No exact match found for "${documentName}"`)
    return null

  } catch (error) {
    console.error('❌ Error searching for existing documents:', error)
    return null
  }
}

/**
 * Get or create company-specific Knowledge Base document
 * Uses in-memory cache to avoid recreating documents
 * @param companyId - Company UUID
 * @param scenarioId - Scenario UUID
 * @param knowledgeText - Formatted knowledge text (menu + company info)
 * @returns KB document {id, name}
 */
const kbDocumentCache = new Map<string, KnowledgeBaseDocument>()

export async function getOrCreateCompanyKnowledgeBase(
  companyId: string,
  scenarioId: string,
  knowledgeText: string
): Promise<KnowledgeBaseDocument> {
  const cacheKey = `${companyId}-${scenarioId}`

  console.log(`🔍 KB Document Cache Check:`)
  console.log(`   Cache key: ${cacheKey}`)
  console.log(`   Cache has key: ${kbDocumentCache.has(cacheKey)}`)
  console.log(`   Cache size: ${kbDocumentCache.size}`)
  console.log(`   Cache contents:`, Array.from(kbDocumentCache.entries()).map(([k, v]) => [k, { id: v.id, name: v.name }]))

  // Check cache first
  if (kbDocumentCache.has(cacheKey)) {
    const cachedDoc = kbDocumentCache.get(cacheKey)!
    console.log(`✅ Using cached KB document:`, { id: cachedDoc.id, name: cachedDoc.name })
    return cachedDoc
  }

  console.log(`⚠️ No cached document found, checking ElevenLabs API...`)

  // Generate document name
  const documentName = `Company Menu - ${companyId.slice(0, 8)} - Scenario ${scenarioId.slice(0, 8)}`

  // Check if document already exists on ElevenLabs (prevents duplicates after server restart)
  const existingDoc = await searchExistingDocument(documentName)
  if (existingDoc) {
    console.log(`✅ Found existing document via API search, reusing it`)
    // Cache it for future requests
    kbDocumentCache.set(cacheKey, existingDoc)
    return existingDoc
  }

  console.log(`⚠️ No existing document found, creating new KB document...`)

  // Create new KB document only if not found in cache or API
  const document = await createKnowledgeBaseDocument(knowledgeText, documentName)

  // Cache the full document object
  kbDocumentCache.set(cacheKey, document)
  console.log(`📝 Created and cached KB document:`, { id: document.id, name: document.name }, `for key ${cacheKey}`)
  console.log(`📝 Cache size after creation: ${kbDocumentCache.size}`)

  return document
}

/**
 * Clear the KB document cache (useful for testing or updates)
 */
export function clearKnowledgeBaseCache(): void {
  kbDocumentCache.clear()
  console.log('🗑️ Cleared KB document cache')
}

/**
 * Check KB document indexing status
 * @param documentId - KB document ID
 * @returns Document details including RAG indexing status
 */
export async function checkKnowledgeBaseStatus(documentId: string): Promise<any> {
  const apiKey = process.env.ELEVENLABS_API_KEY

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY not configured')
  }

  console.log(`🔍 Checking KB document status: ${documentId}`)

  const response = await fetch(`https://api.elevenlabs.io/v1/convai/knowledge-base/${documentId}`, {
    method: 'GET',
    headers: {
      'xi-api-key': apiKey,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('❌ Failed to get KB document status:', errorData)
    throw new Error(`ElevenLabs KB API error: ${response.status} - ${JSON.stringify(errorData)}`)
  }

  const documentStatus = await response.json()
  console.log('📊 KB Document Status:')
  console.log(JSON.stringify(documentStatus, null, 2))

  return documentStatus
}
