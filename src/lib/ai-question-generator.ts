import OpenAI from 'openai'
import { KnowledgeBaseDocument } from './knowledge-base'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface GeneratedQuestion {
  id: string
  question: string
  options?: string[]
  correctAnswer: string
  explanation: string
  type: 'multiple_choice' | 'open_ended'
  sourceDocument?: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
}

export interface QuestionGenerationOptions {
  questionCount?: number
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  questionType?: 'multiple_choice' | 'open_ended' | 'mixed'
  focusAreas?: string[]
}

export class AIQuestionGenerator {
  /**
   * Generate factual questions from knowledge base documents
   */
  async generateQuestionsFromDocuments(
    documents: KnowledgeBaseDocument[],
    options: QuestionGenerationOptions = {}
  ): Promise<GeneratedQuestion[]> {
    const {
      questionCount = 3,
      difficulty = 'beginner',
      questionType = 'mixed',
      focusAreas = []
    } = options

    if (!documents.length) {
      throw new Error('No documents provided for question generation')
    }

    // Combine document content for context
    const documentContext = documents.map(doc =>
      `Документ "${doc.title}":\n${doc.content}`
    ).join('\n\n---\n\n')

    const focusInstruction = focusAreas.length > 0
      ? `Сосредоточьтесь на следующих областях: ${focusAreas.join(', ')}.`
      : ''

    const systemPrompt = `Вы эксперт по созданию обучающих вопросов для персонала кафе/ресторана.
Ваша задача - создать точные, фактические вопросы на основе предоставленной документации.

ВАЖНО:
- Все вопросы должны быть основаны ТОЛЬКО на фактах из документов
- Неправильные ответы в вариантах должны быть правдоподобными, но НЕ содержаться в документах
- Проверяйте цены, размеры порций, названия напитков/блюд
- Вопросы должны тестировать знание конкретных фактов (цены, ингредиенты, размеры)

${focusInstruction}

Верните ответ в формате JSON массива со следующей структурой:
[
  {
    "id": "unique_id",
    "question": "текст вопроса",
    "type": "multiple_choice" или "open_ended",
    "options": ["вариант1", "вариант2", "вариант3", "вариант4"], // только для multiple_choice
    "correctAnswer": "правильный ответ",
    "explanation": "объяснение с ссылкой на документ",
    "sourceDocument": "название документа",
    "difficulty": "${difficulty}"
  }
]`

    const userPrompt = `На основе следующей документации создайте ${questionCount} ${this.getDifficultyDescription(difficulty)} вопроса типа "${questionType}":

${documentContext}

Создайте ${questionCount} вопроса, которые проверяют точное знание фактов из документов.`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3, // Low temperature for factual accuracy
        max_tokens: 2000
      })

      const response = completion.choices[0]?.message?.content
      if (!response) {
        throw new Error('No response from OpenAI')
      }

      // Parse the JSON response
      let questions: GeneratedQuestion[]
      try {
        questions = JSON.parse(response)
      } catch (parseError) {
        // Try to extract JSON from response if it's wrapped in text
        const jsonMatch = response.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          questions = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('Failed to parse OpenAI response as JSON')
        }
      }

      // Validate and enrich questions
      return questions.map((q, index) => ({
        ...q,
        id: q.id || `ai_generated_${Date.now()}_${index}`,
        difficulty: q.difficulty || difficulty,
        type: this.normalizeQuestionType(q.type, questionType)
      }))

    } catch (error) {
      console.error('Error generating questions with OpenAI:', error)
      throw new Error(`Failed to generate questions: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate questions specifically for product knowledge
   */
  async generateProductKnowledgeQuestions(
    documents: KnowledgeBaseDocument[],
    options: QuestionGenerationOptions = {}
  ): Promise<GeneratedQuestion[]> {
    const productFocusAreas = [
      'цены на напитки',
      'размеры порций',
      'названия напитков',
      'ингредиенты',
      'меню выпечки',
      'различия между напитками'
    ]

    return this.generateQuestionsFromDocuments(documents, {
      ...options,
      focusAreas: [...productFocusAreas, ...(options.focusAreas || [])]
    })
  }

  /**
   * Generate questions for a specific knowledge base category
   */
  async generateCategoryQuestions(
    documents: KnowledgeBaseDocument[],
    categoryName: string,
    options: QuestionGenerationOptions = {}
  ): Promise<GeneratedQuestion[]> {
    // Filter documents by category if needed
    const categoryDocuments = documents.filter(doc =>
      doc.category?.name.toLowerCase().includes(categoryName.toLowerCase()) ||
      doc.title.toLowerCase().includes(categoryName.toLowerCase())
    )

    if (categoryDocuments.length === 0) {
      // Use all documents if no category-specific ones found
      return this.generateQuestionsFromDocuments(documents, options)
    }

    return this.generateQuestionsFromDocuments(categoryDocuments, options)
  }

  private getDifficultyDescription(difficulty: string): string {
    switch (difficulty) {
      case 'beginner': return 'простых'
      case 'intermediate': return 'средних'
      case 'advanced': return 'сложных'
      default: return 'простых'
    }
  }

  private normalizeQuestionType(
    type: string,
    requestedType: string
  ): 'multiple_choice' | 'open_ended' {
    if (requestedType === 'mixed') {
      return type === 'open_ended' ? 'open_ended' : 'multiple_choice'
    }
    return requestedType === 'open_ended' ? 'open_ended' : 'multiple_choice'
  }
}

// Export singleton instance
export const aiQuestionGenerator = new AIQuestionGenerator()