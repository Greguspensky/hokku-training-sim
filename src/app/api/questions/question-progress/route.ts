import { NextRequest, NextResponse } from 'next/server'
import { apiErrorHandler, createSuccessResponse, createErrorResponse, parseRequestBody } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('user_id')
  const companyId = searchParams.get('company_id')

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
  }

  console.log(`📚 Getting question-level progress for user: ${userId}, company: ${companyId || 'not specified'}`)

  try {
    // If company_id is provided, first get topics for that company
    let topicIds: string[] | null = null

    if (companyId) {
      console.log(`🏢 Filtering questions for company: ${companyId}`)
      const { data: companyTopics, error: topicsError } = await supabaseAdmin
        .from('knowledge_topics')
        .select('id')
        .eq('company_id', companyId)

      if (topicsError) {
        console.warn('⚠️ Error fetching company topics:', topicsError)
      } else if (companyTopics && companyTopics.length > 0) {
        topicIds = companyTopics.map(t => t.id)
        console.log(`📋 Found ${topicIds.length} topics for company`)
      } else {
        console.log(`⚠️ No topics found for company ${companyId}`)
        // Return empty result if no topics for this company
        return NextResponse.json({
          questions: [],
          topics: []
        })
      }
    }

    // Build the query
    let query = supabaseAdmin
      .from('topic_questions')
      .select(`
        id,
        question_template,
        correct_answer,
        difficulty_level,
        knowledge_topics!inner(
          id,
          name,
          category,
          difficulty_level
        )
      `)
      .eq('is_active', true)

    // Filter by topic IDs if we have them
    if (topicIds && topicIds.length > 0) {
      query = query.in('topic_id', topicIds)
    }

    const { data: allQuestions, error: questionsError} = await query

    if (questionsError) {
      console.error('❌ Error fetching questions:', questionsError)
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
    }

    if (!allQuestions || allQuestions.length === 0) {
      return NextResponse.json({
        questions: [],
        topics: []
      })
    }

    console.log(`📝 Found ${allQuestions.length} questions`)

    // Get user's question attempts to determine status
    const { data: attempts, error: attemptsError } = await supabaseAdmin
      .from('question_attempts')
      .select('*')
      .eq('user_id', userId)

    if (attemptsError) {
      console.warn('⚠️ Error fetching attempts (table might not exist):', attemptsError)
    }

    console.log(`🎯 Found ${attempts?.length || 0} question attempts`)

    // Create attempt lookup map
    const attemptMap = new Map()
    attempts?.forEach(attempt => {
      const key = attempt.question_id || `${attempt.topic_id}_${attempt.question_asked}`
      if (!attemptMap.has(key) || new Date(attempt.created_at) > new Date(attemptMap.get(key).created_at)) {
        attemptMap.set(key, attempt)
      }
    })

    // Process each question to determine status
    const questionsWithStatus = allQuestions.map(question => {
      const topic = Array.isArray(question.knowledge_topics)
        ? question.knowledge_topics[0]
        : question.knowledge_topics

      // Try to find attempt by question_id first, then by topic + question text
      let attempt = attemptMap.get(question.id)
      if (!attempt) {
        // Fallback: look for attempts by topic and similar question text
        attempt = Array.from(attemptMap.values()).find(a =>
          a.topic_id === topic.id &&
          (a.question_asked?.toLowerCase().includes(question.question_template.toLowerCase().substring(0, 20)) ||
           question.question_template.toLowerCase().includes(a.question_asked?.toLowerCase().substring(0, 20)))
        )
      }

      let status = 'unanswered'
      let attemptCount = 0
      let lastAnswer = undefined
      let lastAttemptAt = undefined
      let managerOverride = false
      let managerOverrideStatus = undefined

      if (attempt) {
        status = attempt.is_correct ? 'correct' : 'incorrect'
        attemptCount = 1 // We're only tracking the latest attempt for now
        lastAnswer = attempt.employee_answer || attempt.user_answer
        lastAttemptAt = attempt.created_at
        managerOverride = attempt.manager_override || false
        managerOverrideStatus = attempt.manager_override_status
      }

      return {
        id: question.id,
        question_template: question.question_template,
        correct_answer: question.correct_answer,
        topic_name: topic.name,
        topic_category: topic.category,
        difficulty_level: question.difficulty_level,
        status,
        attempts: attemptCount,
        last_answer: lastAnswer,
        last_attempt_at: lastAttemptAt,
        manager_override: managerOverride,
        manager_override_status: managerOverrideStatus
      }
    })

    // Calculate topic summaries
    const topicMap = new Map()

    questionsWithStatus.forEach(question => {
      const topicKey = question.topic_name

      if (!topicMap.has(topicKey)) {
        topicMap.set(topicKey, {
          topic_id: allQuestions.find(q => {
            const topic = Array.isArray(q.knowledge_topics) ? q.knowledge_topics[0] : q.knowledge_topics
            return topic.name === question.topic_name
          })?.knowledge_topics?.id || question.topic_name,
          topic_name: question.topic_name,
          topic_category: question.topic_category,
          total_questions: 0,
          correct_questions: 0,
          incorrect_questions: 0,
          unanswered_questions: 0,
          mastery_percentage: 0
        })
      }

      const topicSummary = topicMap.get(topicKey)
      topicSummary.total_questions++

      if (question.status === 'correct') {
        topicSummary.correct_questions++
      } else if (question.status === 'incorrect') {
        topicSummary.incorrect_questions++
      } else {
        topicSummary.unanswered_questions++
      }

      // Calculate mastery percentage (correct answers / total questions)
      topicSummary.mastery_percentage = topicSummary.total_questions > 0
        ? Math.round((topicSummary.correct_questions / topicSummary.total_questions) * 100)
        : 0
    })

    const topicSummaries = Array.from(topicMap.values()).sort((a, b) =>
      a.topic_name.localeCompare(b.topic_name)
    )

    console.log('📊 Progress Summary:')
    console.log(`  Questions: ${questionsWithStatus.length} total`)
    console.log(`  Correct: ${questionsWithStatus.filter(q => q.status === 'correct').length}`)
    console.log(`  Incorrect: ${questionsWithStatus.filter(q => q.status === 'incorrect').length}`)
    console.log(`  Unanswered: ${questionsWithStatus.filter(q => q.status === 'unanswered').length}`)
    console.log(`  Topics: ${topicSummaries.length}`)

    return NextResponse.json({
      questions: questionsWithStatus,
      topics: topicSummaries
    })

  } catch (error) {
    console.error('❌ Question progress fetch failed:', error)
    return NextResponse.json(
      { error: 'Failed to fetch question progress', details: error.message },
      { status: 500 }
    )
  }
}