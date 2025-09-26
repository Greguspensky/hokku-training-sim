import { NextRequest, NextResponse } from 'next/server'
import { QuestionPoolManager } from '@/lib/question-pool-manager'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('user_id') || '01f773e2-1027-490e-8d36-279136700bbf' // Default user ID
  const companyId = searchParams.get('company_id') || '01f773e2-1027-490e-8d36-279136700bbf' // Default company ID
  const maxQuestions = parseInt(searchParams.get('max_questions') || '10')

  console.log(`🎯 Testing priority-based question selection`)
  console.log(`  User ID: ${userId}`)
  console.log(`  Company ID: ${companyId}`)
  console.log(`  Max Questions: ${maxQuestions}`)

  try {
    // Test the new priority-based selection
    const { questions, topics, strategy } = await QuestionPoolManager.getPriorityBasedQuestions(
      userId,
      companyId,
      maxQuestions
    )

    // Group questions by status for analysis
    const statusGroups = questions.reduce((acc, q) => {
      acc[q.status] = acc[q.status] || []
      acc[q.status].push({
        id: q.id,
        question: q.question_template.substring(0, 80) + (q.question_template.length > 80 ? '...' : ''),
        topic: q.topic_name,
        difficulty: q.difficulty_level,
        status: q.status
      })
      return acc
    }, {} as Record<string, any[]>)

    // Verify priority ordering
    const statusCounts = {
      unanswered: questions.filter(q => q.status === 'unanswered').length,
      incorrect: questions.filter(q => q.status === 'incorrect').length,
      correct: questions.filter(q => q.status === 'correct').length
    }

    // Check if ordering is correct
    let lastStatusPriority = -1
    let isCorrectlyOrdered = true
    const priorityOrder = { 'unanswered': 0, 'incorrect': 1, 'correct': 2 }

    for (const question of questions) {
      const currentPriority = priorityOrder[question.status]
      if (currentPriority < lastStatusPriority) {
        isCorrectlyOrdered = false
        break
      }
      lastStatusPriority = currentPriority
    }

    return NextResponse.json({
      success: true,
      strategy,
      totalQuestions: questions.length,
      totalTopics: topics.length,
      statusCounts,
      isCorrectlyOrdered,
      statusGroups,
      questions: questions.map((q, index) => ({
        order: index + 1,
        id: q.id,
        status: q.status,
        question: q.question_template,
        topic: q.topic_name,
        difficulty: q.difficulty_level,
        points: q.points
      })),
      topics: topics.map(t => ({
        id: t.id,
        name: t.name,
        category: t.category,
        difficulty: t.difficulty_level
      }))
    })

  } catch (error) {
    console.error('❌ Error testing priority questions:', error)
    return NextResponse.json(
      {
        error: 'Failed to test priority questions',
        details: error.message,
        stack: error.stack
      },
      { status: 500 }
    )
  }
}