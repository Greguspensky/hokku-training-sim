/**
 * ElevenLabs Knowledge Service
 * Handles scenario-specific knowledge retrieval and formatting for ElevenLabs conversations
 * Supports both Theory Q&A (restricted knowledge) and Service Practice (broader knowledge)
 */

import { knowledgeBaseService, KnowledgeBaseDocument } from './knowledge-base'
import { scenarioService, Scenario } from './scenarios'

export interface ScenarioKnowledgeContext {
  scenarioId: string
  scenarioType: 'theory' | 'service_practice'
  documents: KnowledgeBaseDocument[]
  formattedContext: string
  knowledgeScope: 'restricted' | 'broad'
}

export interface KnowledgeChunk {
  title: string
  content: string
  category: string
  relevanceScore: number
}

class ElevenLabsKnowledgeService {
  /**
   * Load knowledge context for a specific scenario
   */
  async getScenarioKnowledge(
    scenarioId: string,
    companyId: string,
    maxChunks: number = 5
  ): Promise<ScenarioKnowledgeContext> {
    try {
      console.log(`🧠 Loading knowledge for scenario: ${scenarioId}`)

      // Get scenario details - handle demo scenarios specially
      let scenario = await scenarioService.getScenario(scenarioId)
      if (!scenario && (scenarioId.startsWith('demo-scenario-') || scenarioId.includes('demo-assignment-'))) {
        // Create a mock scenario for demo purposes
        // For demo assignments, default to theory Q&A based on CLAUDE.md documentation
        scenario = {
          id: scenarioId,
          scenario_type: 'theory', // Demo assignments are theory Q&A sessions
          title: 'Theory Assessment',
          company_id: companyId,
          track_id: 'demo-track',
          difficulty: 'beginner',
          language: 'en'
        }
        console.log(`🧪 Created mock scenario for demo: ${scenarioId}`)
      }

      if (!scenario) {
        throw new Error(`Scenario ${scenarioId} not found`)
      }

      // Determine knowledge scope based on scenario type
      const knowledgeScope = scenario.scenario_type === 'theory' ? 'restricted' : 'broad'
      console.log(`📚 Knowledge scope: ${knowledgeScope} for ${scenario.scenario_type} scenario`)

      // Load appropriate knowledge documents
      let documents: KnowledgeBaseDocument[] = []
      try {
        documents = await this.loadScenarioDocuments(scenario, companyId, knowledgeScope)
        console.log(`📄 Loaded ${documents.length} documents for ${scenario.scenario_type} scenario`)
      } catch (docError) {
        console.warn(`⚠️ Failed to load scenario documents, loading all company documents:`, docError)
        // Fallback: Load all company documents if scenario-specific loading fails
        documents = await knowledgeBaseService.getCompanyDocuments(companyId)
        console.log(`📄 Fallback: Loaded ${documents.length} company documents`)
      }

      // Format knowledge for ElevenLabs context
      const formattedContext = this.formatKnowledgeContext(documents, scenario.scenario_type, maxChunks)
      console.log(`📝 Formatted context length: ${formattedContext.length} characters`)

      return {
        scenarioId,
        scenarioType: scenario.scenario_type,
        documents,
        formattedContext,
        knowledgeScope
      }

    } catch (error) {
      console.error('❌ Failed to load scenario knowledge:', error)
      // Return empty context rather than throwing to maintain conversation flow
      return {
        scenarioId,
        scenarioType: 'theory',
        documents: [],
        formattedContext: 'No specific knowledge available for this scenario.',
        knowledgeScope: 'restricted'
      }
    }
  }

  /**
   * Load documents based on scenario type and assignments
   */
  private async loadScenarioDocuments(
    scenario: Scenario,
    companyId: string,
    knowledgeScope: 'restricted' | 'broad'
  ): Promise<KnowledgeBaseDocument[]> {

    if (knowledgeScope === 'restricted') {
      // Theory Q&A: Load only assigned knowledge categories/documents
      return this.loadRestrictedKnowledge(scenario, companyId)
    } else {
      // Service Practice: Load broader company knowledge
      return this.loadBroadKnowledge(companyId, scenario)
    }
  }

  /**
   * Load restricted knowledge for Theory Q&A scenarios
   */
  private async loadRestrictedKnowledge(
    scenario: Scenario,
    companyId: string
  ): Promise<KnowledgeBaseDocument[]> {
    const documents: KnowledgeBaseDocument[] = []

    // Load documents from specific assigned categories
    if (scenario.knowledge_category_ids && scenario.knowledge_category_ids.length > 0) {
      console.log(`📁 Loading from assigned categories: ${scenario.knowledge_category_ids.join(', ')}`)

      for (const categoryId of scenario.knowledge_category_ids) {
        const categoryDocs = await knowledgeBaseService.getDocuments(companyId, categoryId)
        documents.push(...categoryDocs)
      }
    }

    // Load specific assigned documents
    if (scenario.knowledge_document_ids && scenario.knowledge_document_ids.length > 0) {
      console.log(`📄 Loading assigned documents: ${scenario.knowledge_document_ids.join(', ')}`)

      for (const docId of scenario.knowledge_document_ids) {
        const doc = await knowledgeBaseService.getDocument(docId)
        if (doc) {
          documents.push(doc)
        }
      }
    }

    // If no specific assignments, fall back to company documents (limited)
    if (documents.length === 0) {
      console.log('⚠️ No assigned knowledge found, loading sample company documents')
      const allDocs = await knowledgeBaseService.getDocuments(companyId)
      return allDocs.slice(0, 3) // Limit to 3 documents for theory scenarios
    }

    // Remove duplicates
    const uniqueDocuments = documents.filter((doc, index, self) =>
      index === self.findIndex(d => d.id === doc.id)
    )

    console.log(`✅ Loaded ${uniqueDocuments.length} restricted knowledge documents`)
    return uniqueDocuments
  }

  /**
   * Load broader knowledge for Service Practice scenarios
   */
  private async loadBroadKnowledge(
    companyId: string,
    scenario: Scenario
  ): Promise<KnowledgeBaseDocument[]> {
    console.log('🌐 Loading broad company knowledge for service practice')

    // Get all company documents
    const allDocuments = await knowledgeBaseService.getDocuments(companyId)

    // Prioritize customer-facing knowledge for service scenarios
    const prioritizedDocs = this.prioritizeServiceKnowledge(allDocuments, scenario)

    console.log(`✅ Loaded ${prioritizedDocs.length} documents for service practice`)
    return prioritizedDocs
  }

  /**
   * Prioritize knowledge relevant to customer service scenarios
   */
  private prioritizeServiceKnowledge(
    documents: KnowledgeBaseDocument[],
    scenario: Scenario
  ): KnowledgeBaseDocument[] {
    // Priority categories for service practice
    const servicePriorityCategories = [
      'customer service',
      'pricing',
      'menu',
      'policies',
      'procedures',
      'sop'
    ]

    const prioritized: { doc: KnowledgeBaseDocument, score: number }[] = documents.map(doc => {
      let score = 0

      // Higher score for service-related categories
      const categoryName = doc.category?.name.toLowerCase() || ''
      servicePriorityCategories.forEach(priority => {
        if (categoryName.includes(priority)) {
          score += 10
        }
      })

      // Higher score for service-related content
      const content = doc.content.toLowerCase()
      if (content.includes('customer') || content.includes('service') || content.includes('price')) {
        score += 5
      }

      // Consider scenario template type
      if (scenario.template_type === 'upselling' && (content.includes('upsell') || content.includes('upgrade'))) {
        score += 15
      }
      if (scenario.template_type === 'upset_customer' && (content.includes('complaint') || content.includes('refund'))) {
        score += 15
      }

      return { doc, score }
    })

    // Sort by relevance score and return top documents
    return prioritized
      .sort((a, b) => b.score - a.score)
      .slice(0, 8) // Limit to 8 documents for service practice
      .map(item => item.doc)
  }

  /**
   * Format knowledge documents for ElevenLabs conversation context
   */
  private formatKnowledgeContext(
    documents: KnowledgeBaseDocument[],
    scenarioType: 'theory' | 'service_practice',
    maxChunks: number
  ): string {
    if (documents.length === 0) {
      return 'No specific company knowledge available.'
    }

    const chunks = this.createKnowledgeChunks(documents, maxChunks)

    if (scenarioType === 'theory') {
      return this.formatTheoryContext(chunks)
    } else {
      return this.formatServiceContext(chunks)
    }
  }

  /**
   * Create manageable knowledge chunks from documents
   */
  private createKnowledgeChunks(
    documents: KnowledgeBaseDocument[],
    maxChunks: number
  ): KnowledgeChunk[] {
    const chunks: KnowledgeChunk[] = []

    for (const doc of documents) {
      // Split long content into smaller chunks (max 300 chars per chunk)
      const contentChunks = this.splitContent(doc.content, 300)

      for (let i = 0; i < contentChunks.length && chunks.length < maxChunks; i++) {
        chunks.push({
          title: doc.title,
          content: contentChunks[i],
          category: doc.category?.name || 'General',
          relevanceScore: 1.0 // Could implement smarter scoring later
        })
      }

      if (chunks.length >= maxChunks) break
    }

    return chunks.slice(0, maxChunks)
  }

  /**
   * Split content into manageable chunks
   */
  private splitContent(content: string, maxLength: number): string[] {
    if (content.length <= maxLength) {
      return [content]
    }

    const chunks: string[] = []
    const sentences = content.split(/[.!?]+/)
    let currentChunk = ''

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim()
      if (!trimmedSentence) continue

      if (currentChunk.length + trimmedSentence.length + 2 <= maxLength) {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence
      } else {
        if (currentChunk) {
          chunks.push(currentChunk + '.')
        }
        currentChunk = trimmedSentence
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk + (currentChunk.endsWith('.') ? '' : '.'))
    }

    return chunks
  }

  /**
   * Format knowledge context for Theory Q&A scenarios
   */
  private formatTheoryContext(chunks: KnowledgeChunk[]): string {
    const context = chunks.map(chunk =>
      `**${chunk.category} - ${chunk.title}:**\n${chunk.content}`
    ).join('\n\n')

    return `You are conducting a Theory Q&A session. Ask specific, factual questions based on this company knowledge:

${context}

Focus on testing the employee's knowledge of specific facts, procedures, prices, and policies from these documents. Ask one question at a time and expect detailed, accurate answers.`
  }

  /**
   * Format knowledge context for Service Practice scenarios
   */
  private formatServiceContext(chunks: KnowledgeChunk[]): string {
    const context = chunks.map(chunk =>
      `**${chunk.category} - ${chunk.title}:**\n${chunk.content}`
    ).join('\n\n')

    return `You are a customer in a service practice scenario. Use this company knowledge to create realistic customer interactions:

${context}

Act as a customer who might ask about these products, services, or policies. Present realistic scenarios that test the employee's ability to help customers using this knowledge.`
  }

  /**
   * Search for specific knowledge during conversation
   */
  async searchKnowledgeDuringConversation(
    companyId: string,
    searchQuery: string,
    scenarioType: 'theory' | 'service_practice',
    maxResults: number = 3
  ): Promise<KnowledgeChunk[]> {
    try {
      console.log(`🔍 Searching knowledge: "${searchQuery}"`)

      // Use existing search functionality
      const documents = await knowledgeBaseService.searchDocuments(companyId, searchQuery)

      if (documents.length === 0) {
        return []
      }

      // Create and return relevant chunks
      const chunks = this.createKnowledgeChunks(documents.slice(0, maxResults), maxResults)

      console.log(`✅ Found ${chunks.length} relevant knowledge chunks`)
      return chunks

    } catch (error) {
      console.error('❌ Knowledge search failed:', error)
      return []
    }
  }
}

// Export singleton instance
export const elevenLabsKnowledgeService = new ElevenLabsKnowledgeService()