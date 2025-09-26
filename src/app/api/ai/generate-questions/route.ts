import { NextRequest, NextResponse } from 'next/server'
import { aiQuestionGenerator, QuestionGenerationOptions } from '@/lib/ai-question-generator'
import { knowledgeBaseService } from '@/lib/knowledge-base'
import { getCurrentUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    // Temporarily allow demo mode for testing
    const demoUser = user || {
      id: 'demo-user',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'manager'
    }

    const body = await request.json()
    const {
      company_id,
      document_ids = [],
      category_ids = [],
      question_count = 3,
      difficulty = 'beginner',
      question_type = 'mixed',
      focus_areas = []
    } = body

    // Validate required fields
    if (!company_id) {
      return NextResponse.json(
        { success: false, error: 'company_id is required' },
        { status: 400 }
      )
    }

    // Try to get questions from knowledge base first
    console.log('📚 Attempting to generate questions from knowledge base')
    let questions = []
    let documentsUsed = 0

    try {
      // Get knowledge base documents
      let documents = []

      if (document_ids && document_ids.length > 0) {
        // Get specific documents
        console.log(`📄 Fetching ${document_ids.length} specific documents`)
        for (const docId of document_ids) {
          const doc = await knowledgeBaseService.getDocument(docId)
          if (doc) documents.push(doc)
        }
      } else if (category_ids && category_ids.length > 0) {
        // Get documents from specific categories
        console.log(`📂 Fetching documents from ${category_ids.length} categories`)
        for (const categoryId of category_ids) {
          const categoryDocs = await knowledgeBaseService.getDocuments(company_id, categoryId)
          documents.push(...categoryDocs)
        }
      } else {
        // Get all documents for the company
        console.log('📚 Fetching all company documents')
        documents = await knowledgeBaseService.getDocuments(company_id)
      }

      if (documents.length > 0) {
        console.log(`✅ Found ${documents.length} documents, generating AI questions`)

        const generatedQuestions = await aiQuestionGenerator.generateQuestionsFromDocuments(
          documents,
          {
            questionCount: question_count,
            difficulty: difficulty,
            questionType: question_type,
            focusAreas: focus_areas
          }
        )

        // Convert to the format expected by the avatar system
        questions = generatedQuestions.map(q => ({
          id: q.id,
          text: q.question,
          category: q.sourceDocument || 'Knowledge Base',
          difficulty: q.difficulty,
          type: 'open-ended' as const
        }))

        documentsUsed = documents.length
        console.log(`🎯 Generated ${questions.length} questions from ${documentsUsed} documents`)
      } else {
        throw new Error('No documents found in knowledge base')
      }
    } catch (error) {
      console.warn('⚠️ Knowledge base question generation failed:', error)
      console.log('📚 Falling back to demo questions')

      // Fallback to demo questions if knowledge base fails
      const fallbackQuestions = [
        {
          id: 'demo1',
          text: 'What is our company\'s main product or service?',
          category: 'General',
          difficulty: 'beginner' as const,
          type: 'open-ended' as const
        },
        {
          id: 'demo2',
          text: 'How would you describe our customer service philosophy?',
          category: 'Service',
          difficulty: 'beginner' as const,
          type: 'open-ended' as const
        },
        {
          id: 'demo3',
          text: 'What are the key features of our flagship product?',
          category: 'Product',
          difficulty: 'intermediate' as const,
          type: 'open-ended' as const
        },
        {
          id: 'demo4',
          text: 'How do you handle customer complaints?',
          category: 'Service',
          difficulty: 'intermediate' as const,
          type: 'open-ended' as const
        },
        {
          id: 'demo5',
          text: 'What is our refund and return policy?',
          category: 'Policy',
          difficulty: 'beginner' as const,
          type: 'open-ended' as const
        }
      ]

      questions = fallbackQuestions.slice(0, question_count)
    }

    return NextResponse.json({
      success: true,
      questions,
      metadata: {
        documents_used: documentsUsed,
        generated_count: questions.length,
        mode: documentsUsed > 0 ? 'knowledge_base' : 'fallback'
      }
    })

  } catch (error) {
    console.error('Generate questions error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate questions'
      },
      { status: 500 }
    )
  }
}

// GET endpoint to test question generation
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'company_id parameter is required' },
        { status: 400 }
      )
    }

    // Generate sample fallback questions for testing
    const questions = [
      {
        id: 'test1',
        text: 'What is our company\'s main product or service?',
        category: 'General',
        difficulty: 'beginner' as const,
        type: 'open-ended' as const
      },
      {
        id: 'test2',
        text: 'How would you describe our customer service philosophy?',
        category: 'Service',
        difficulty: 'beginner' as const,
        type: 'open-ended' as const
      }
    ]

    return NextResponse.json({
      success: true,
      questions,
      message: 'Sample questions generated successfully'
    })

  } catch (error) {
    console.error('Test questions error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate test questions'
      },
      { status: 500 }
    )
  }
}