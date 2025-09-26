import OpenAI from 'openai'
import { supabaseAdmin } from './supabase'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export interface KnowledgeTopic {
  id?: string
  company_id: string
  name: string
  description: string
  category: 'menu' | 'procedures' | 'policies' | 'general'
  difficulty_level: 1 | 2 | 3
  parent_topic_id?: string
  is_active: boolean
}

export interface TopicQuestion {
  id?: string
  topic_id: string
  question_template: string
  question_type: 'multiple_choice' | 'open_ended' | 'true_false'
  correct_answer: string
  answer_options?: string[]
  difficulty_level: 1 | 2 | 3
  points: number
  explanation: string
  is_active: boolean
}

export class KnowledgeExtractionService {
  /**
   * Extract knowledge topics from company documents
   */
  static async extractTopicsFromDocuments(companyId: string): Promise<KnowledgeTopic[]> {
    console.log('📚 Extracting knowledge topics for company:', companyId)

    // Get all knowledge base documents for the company
    const { data: documents, error: docsError } = await supabaseAdmin
      .from('knowledge_base_documents')
      .select('*')
      .eq('company_id', companyId)

    if (docsError) {
      console.error('❌ Error fetching documents:', docsError)
      throw new Error('Failed to fetch company documents')
    }

    if (!documents || documents.length === 0) {
      console.warn('⚠️ No documents found for company:', companyId)
      return []
    }

    console.log(`📄 Processing ${documents.length} documents...`)

    const allTopics: KnowledgeTopic[] = []

    for (const doc of documents) {
      try {
        const topics = await this.extractTopicsFromDocument(doc.content, companyId, doc.title)
        allTopics.push(...topics)
      } catch (error) {
        console.error(`❌ Error processing document ${doc.title}:`, error)
        // Continue with other documents
      }
    }

    // Deduplicate topics by name
    const uniqueTopics = this.deduplicateTopics(allTopics)

    console.log(`✅ Extracted ${uniqueTopics.length} unique topics`)
    return uniqueTopics
  }

  /**
   * Extract topics from a single document using AI
   */
  private static async extractTopicsFromDocument(
    content: string,
    companyId: string,
    documentTitle: string
  ): Promise<KnowledgeTopic[]> {
    const prompt = `
Analyze the following company knowledge document and extract distinct learning topics that employees should master.

Document: "${documentTitle}"
Content: """
${content}
"""

For each topic, provide:
1. name: Short, clear topic name (e.g., "Cappuccino Sizes", "Cash Register Process")
2. description: Brief description of what employees need to know
3. category: One of: menu, procedures, policies, general
4. difficulty_level: 1=beginner, 2=intermediate, 3=advanced

Focus on actionable knowledge that can be tested with specific questions.

Return response as JSON array:
[
  {
    "name": "Topic Name",
    "description": "What employees need to learn",
    "category": "menu|procedures|policies|general",
    "difficulty_level": 1|2|3
  }
]
`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2000
      })

      const aiResponse = response.choices[0]?.message?.content?.trim()
      if (!aiResponse) {
        throw new Error('Empty AI response')
      }

      // Try to parse JSON response
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        throw new Error('No JSON array found in AI response')
      }

      const parsedTopics = JSON.parse(jsonMatch[0])

      // Convert to KnowledgeTopic format
      return parsedTopics.map((topic: any): KnowledgeTopic => ({
        company_id: companyId,
        name: topic.name,
        description: topic.description,
        category: topic.category,
        difficulty_level: topic.difficulty_level,
        is_active: true
      }))

    } catch (error) {
      console.error(`❌ AI extraction failed for document "${documentTitle}":`, error)

      // Fallback: create basic topic from document title
      return [{
        company_id: companyId,
        name: documentTitle.replace(/\.(md|txt|pdf)$/i, ''),
        description: `Knowledge from document: ${documentTitle}`,
        category: 'general' as const,
        difficulty_level: 1 as const,
        is_active: true
      }]
    }
  }

  /**
   * Generate questions for a specific topic
   */
  static async generateQuestionsForTopic(
    topic: KnowledgeTopic,
    companyDocuments: string,
    maxQuestions: number = 5
  ): Promise<TopicQuestion[]> {
    console.log(`🤔 Generating questions for topic: ${topic.name}`)

    const prompt = `
Create ${maxQuestions} training questions about "${topic.name}" for employee assessment.

Topic Details:
- Name: ${topic.name}
- Description: ${topic.description}
- Category: ${topic.category}
- Difficulty: ${topic.difficulty_level}/3

Context from company documents:
"""
${companyDocuments}
"""

Generate questions that test specific knowledge employees need for their job.

For each question provide:
1. question_template: The question text (can include {placeholders} for dynamic content)
2. question_type: "multiple_choice", "open_ended", or "true_false"
3. correct_answer: The correct answer
4. answer_options: Array of options (for multiple_choice only)
5. points: 1-5 points based on difficulty
6. explanation: Why this answer is correct

Return as JSON array:
[
  {
    "question_template": "What sizes are available for cappuccino?",
    "question_type": "multiple_choice",
    "correct_answer": "250ml, 350ml, 450ml",
    "answer_options": ["250ml, 350ml, 450ml", "Only 350ml", "200ml, 400ml, 600ml", "Small, Medium, Large"],
    "points": 2,
    "explanation": "According to the menu, cappuccino comes in three sizes: 250ml, 350ml, and 450ml"
  }
]
`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 3000
      })

      const aiResponse = response.choices[0]?.message?.content?.trim()
      if (!aiResponse) {
        throw new Error('Empty AI response')
      }

      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        throw new Error('No JSON array found in AI response')
      }

      const parsedQuestions = JSON.parse(jsonMatch[0])

      return parsedQuestions.map((q: any): TopicQuestion => ({
        topic_id: topic.id!,
        question_template: q.question_template,
        question_type: q.question_type,
        correct_answer: q.correct_answer,
        answer_options: q.answer_options,
        difficulty_level: Math.min(3, Math.max(1, q.points || topic.difficulty_level)) as 1 | 2 | 3,
        points: q.points || 1,
        explanation: q.explanation,
        is_active: true
      }))

    } catch (error) {
      console.error(`❌ Question generation failed for topic "${topic.name}":`, error)

      // Fallback: create one basic question
      return [{
        topic_id: topic.id!,
        question_template: `What do you know about ${topic.name}?`,
        question_type: 'open_ended' as const,
        correct_answer: `Knowledge related to ${topic.name} based on company training materials`,
        points: 1,
        difficulty_level: 1 as const,
        explanation: `This question tests understanding of ${topic.name}`,
        is_active: true
      }]
    }
  }

  /**
   * Remove duplicate topics by name (case-insensitive)
   */
  private static deduplicateTopics(topics: KnowledgeTopic[]): KnowledgeTopic[] {
    const seen = new Set<string>()
    return topics.filter(topic => {
      const key = topic.name.toLowerCase().trim()
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  /**
   * Save topics to database (when tables are available)
   */
  static async saveTopicsToDatabase(topics: KnowledgeTopic[]): Promise<void> {
    if (topics.length === 0) return

    try {
      const { error } = await supabaseAdmin
        .from('knowledge_topics')
        .insert(topics)

      if (error) {
        console.error('❌ Error saving topics to database:', error)
        throw error
      }

      console.log(`✅ Saved ${topics.length} topics to database`)
    } catch (error) {
      console.warn('⚠️ Database tables may not exist yet. Topics generated but not saved:', error)
      // Continue without saving for now
    }
  }

  /**
   * Save questions to database (when tables are available)
   */
  static async saveQuestionsToDatabase(questions: TopicQuestion[]): Promise<void> {
    if (questions.length === 0) return

    try {
      const { error } = await supabaseAdmin
        .from('topic_questions')
        .insert(questions)

      if (error) {
        console.error('❌ Error saving questions to database:', error)
        throw error
      }

      console.log(`✅ Saved ${questions.length} questions to database`)
    } catch (error) {
      console.warn('⚠️ Database tables may not exist yet. Questions generated but not saved:', error)
      // Continue without saving for now
    }
  }

  /**
   * Full knowledge extraction pipeline
   */
  static async extractAndGenerateKnowledge(companyId: string): Promise<{
    topics: KnowledgeTopic[]
    questions: TopicQuestion[]
  }> {
    console.log('🚀 Starting full knowledge extraction pipeline...')

    // Step 1: Extract topics from documents
    const topics = await this.extractTopicsFromDocuments(companyId)

    // Step 2: Get all document content for context
    const { data: documents } = await supabaseAdmin
      .from('knowledge_base_documents')
      .select('content')
      .eq('company_id', companyId)

    const allContent = documents?.map(d => d.content).join('\n\n') || ''

    // Step 3: Generate questions for each topic
    const allQuestions: TopicQuestion[] = []

    for (const topic of topics) {
      // Mock ID since we don't have database yet
      topic.id = `topic-${Date.now()}-${Math.random().toString(36).substring(7)}`

      const questions = await this.generateQuestionsForTopic(topic, allContent, 3)
      allQuestions.push(...questions)
    }

    console.log(`✅ Extraction complete: ${topics.length} topics, ${allQuestions.length} questions`)

    return {
      topics,
      questions: allQuestions
    }
  }
}