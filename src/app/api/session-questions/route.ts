import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { QuestionPoolManager } from '@/lib/question-pool-manager'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId') || '01f773e2-1027-490e-8d36-279136700bbf'
    const employeeId = searchParams.get('employeeId')
    const limit = parseInt(searchParams.get('limit') || '10')

    console.log(`🎯 Fetching ${limit} priority-based questions for company: ${companyId}, employee: ${employeeId}`)

    // If no employeeId provided, fall back to basic question fetching
    if (!employeeId) {
      console.log('⚠️ No employeeId provided, using basic question order')

      // Fetch questions with their topics from the database (fallback logic)
      const { data: questions, error } = await supabaseAdmin
        .from('topic_questions')
        .select(`
          id,
          question_template,
          correct_answer,
          difficulty_level,
          question_type,
          knowledge_topics!inner(
            id,
            name,
            category
          )
        `)
        .eq('is_active', true)
        .eq('knowledge_topics.company_id', companyId)
        .order('difficulty_level', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(limit)

      if (error) {
        console.error('❌ Error fetching session questions:', error)
        return NextResponse.json(
          { error: 'Failed to fetch session questions' },
          { status: 500 }
        )
      }

      // Transform the data for easier consumption
      const formattedQuestions = (questions || []).map((q, index) => ({
        id: q.id,
        questionNumber: index + 1,
        question: q.question_template,
        correctAnswer: q.correct_answer,
        difficultyLevel: q.difficulty_level,
        questionType: q.question_type,
        status: 'unanswered' as const,
        topic: {
          id: q.knowledge_topics.id,
          name: q.knowledge_topics.name,
          category: q.knowledge_topics.category
        }
      }))

      return NextResponse.json({
        success: true,
        questions: formattedQuestions,
        totalCount: formattedQuestions.length,
        companyId,
        strategy: 'fallback-basic-order'
      })
    }

    // Use priority-based question selection (same as training sessions)
    const { questions: priorityQuestions, strategy } = await QuestionPoolManager.getPriorityBasedQuestions(
      employeeId,
      companyId,
      limit
    )

    if (!priorityQuestions || priorityQuestions.length === 0) {
      console.log('⚠️ No priority questions found for employee')
      return NextResponse.json({
        success: true,
        questions: [],
        totalCount: 0,
        message: 'No questions available for this employee',
        strategy
      })
    }

    // Transform priority questions for preview display
    const formattedQuestions = priorityQuestions.map((q, index) => ({
      id: q.id,
      questionNumber: index + 1,
      question: q.question_text || q.question_template,
      correctAnswer: q.correct_answer,
      difficultyLevel: q.difficulty_level,
      questionType: q.question_type,
      status: q.status,
      topic: {
        id: q.topic_id,
        name: q.topic_name || 'Unknown Topic',
        category: q.topic_category || 'general'
      }
    }))

    console.log(`✅ Retrieved ${formattedQuestions.length} priority-based questions for session preview`)
    console.log(`📊 Strategy used: ${strategy}`)

    // Log question status breakdown for debugging
    const statusBreakdown = formattedQuestions.reduce((acc, q) => {
      acc[q.status] = (acc[q.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    console.log(`📋 Question status breakdown:`, statusBreakdown)

    return NextResponse.json({
      success: true,
      questions: formattedQuestions,
      totalCount: formattedQuestions.length,
      companyId,
      employeeId,
      strategy,
      statusBreakdown
    })

  } catch (error) {
    console.error('❌ Error in session-questions API:', error)
    return NextResponse.json(
      { error: 'Internal server error fetching session questions' },
      { status: 500 }
    )
  }
}