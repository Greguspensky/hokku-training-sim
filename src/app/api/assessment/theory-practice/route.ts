import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('user_id')
  const assignmentId = searchParams.get('assignment_id')

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
  }

  console.log(`📚 Getting theory practice questions for user: ${userId}`)

  try {
    // Get all questions with their topics
    const { data: allQuestions, error: questionsError } = await supabaseAdmin
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

    if (questionsError) {
      console.error('❌ Error fetching questions:', questionsError)
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
    }

    if (!allQuestions || allQuestions.length === 0) {
      return NextResponse.json({
        questions: [],
        message: 'No questions available for practice'
      })
    }

    // Get user's question attempts to determine what needs practice
    const { data: attempts, error: attemptsError } = await supabaseAdmin
      .from('question_attempts')
      .select('*')
      .eq('user_id', userId)

    if (attemptsError) {
      console.warn('⚠️ Error fetching attempts (table might not exist):', attemptsError)
    }

    console.log(`🎯 Found ${attempts?.length || 0} previous attempts`)

    // Create attempt lookup map (latest attempt for each question)
    const attemptMap = new Map()
    attempts?.forEach(attempt => {
      const key = attempt.question_id || `${attempt.topic_id}_${attempt.question_asked}`
      if (!attemptMap.has(key) || new Date(attempt.created_at) > new Date(attemptMap.get(key).created_at)) {
        attemptMap.set(key, attempt)
      }
    })

    // Filter questions that need practice (unanswered OR answered incorrectly)
    const practiceQuestions = allQuestions.filter(question => {
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

      // Include question if:
      // 1. Never attempted (unanswered)
      // 2. Last attempt was incorrect
      if (!attempt) {
        return true // Unanswered
      }

      return !attempt.is_correct // Answered incorrectly
    })

    // Sort questions by priority:
    // 1. Incorrect answers first (need retry)
    // 2. Then unanswered questions
    // 3. Within each group, sort by difficulty (easier first)
    practiceQuestions.sort((a, b) => {
      const topicA = Array.isArray(a.knowledge_topics) ? a.knowledge_topics[0] : a.knowledge_topics
      const topicB = Array.isArray(b.knowledge_topics) ? b.knowledge_topics[0] : b.knowledge_topics

      const attemptA = attemptMap.get(a.id) || Array.from(attemptMap.values()).find(att =>
        att.topic_id === topicA.id &&
        (att.question_asked?.toLowerCase().includes(a.question_template.toLowerCase().substring(0, 20)) ||
         a.question_template.toLowerCase().includes(att.question_asked?.toLowerCase().substring(0, 20)))
      )
      const attemptB = attemptMap.get(b.id) || Array.from(attemptMap.values()).find(att =>
        att.topic_id === topicB.id &&
        (att.question_asked?.toLowerCase().includes(b.question_template.toLowerCase().substring(0, 20)) ||
         b.question_template.toLowerCase().includes(att.question_asked?.toLowerCase().substring(0, 20)))
      )

      // Priority 1: Incorrect answers first
      const isIncorrectA = attemptA && !attemptA.is_correct
      const isIncorrectB = attemptB && !attemptB.is_correct

      if (isIncorrectA && !isIncorrectB) return -1
      if (!isIncorrectA && isIncorrectB) return 1

      // Priority 2: Sort by difficulty within same category
      return a.difficulty_level - b.difficulty_level
    })

    // Transform to practice format
    const practiceData = practiceQuestions.map(question => {
      const topic = Array.isArray(question.knowledge_topics) ? question.knowledge_topics[0] : question.knowledge_topics

      const attempt = attemptMap.get(question.id) || Array.from(attemptMap.values()).find(att =>
        att.topic_id === topic.id &&
        (att.question_asked?.toLowerCase().includes(question.question_template.toLowerCase().substring(0, 20)) ||
         question.question_template.toLowerCase().includes(att.question_asked?.toLowerCase().substring(0, 20)))
      )

      return {
        id: question.id,
        question_template: question.question_template,
        correct_answer: question.correct_answer,
        topic_name: topic.name,
        topic_category: topic.category,
        difficulty_level: question.difficulty_level,
        status: attempt ? (attempt.is_correct ? 'correct' : 'incorrect') : 'unanswered',
        previous_answer: attempt?.employee_answer || attempt?.user_answer,
        attempts: attempt ? 1 : 0,
        last_attempt_at: attempt?.created_at
      }
    })

    const summary = {
      total_available: allQuestions.length,
      needs_practice: practiceData.length,
      incorrect_answers: practiceData.filter(q => q.status === 'incorrect').length,
      unanswered: practiceData.filter(q => q.status === 'unanswered').length
    }

    console.log('📊 Theory Practice Summary:')
    console.log(`  Total Questions Available: ${summary.total_available}`)
    console.log(`  Questions Needing Practice: ${summary.needs_practice}`)
    console.log(`  Incorrect Answers: ${summary.incorrect_answers}`)
    console.log(`  Unanswered: ${summary.unanswered}`)

    return NextResponse.json({
      questions: practiceData,
      summary,
      assignment_id: assignmentId
    })

  } catch (error) {
    console.error('❌ Theory practice fetch failed:', error)
    return NextResponse.json(
      { error: 'Failed to fetch theory practice questions', details: error.message },
      { status: 500 }
    )
  }
}

// Record a practice attempt
export async function POST(request: NextRequest) {
  console.log('📝 Recording theory practice attempt...')

  try {
    const {
      user_id,
      question_id,
      topic_id,
      question_asked,
      user_answer,
      correct_answer,
      is_correct,
      assignment_id,
      time_spent_seconds
    } = await request.json()

    if (!user_id || !question_id || !question_asked || !user_answer || !correct_answer) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Record the attempt in question_attempts table
    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from('question_attempts')
      .insert({
        user_id,
        topic_id,
        question_id,
        question_asked,
        user_answer,
        correct_answer,
        is_correct,
        points_earned: is_correct ? 2 : 0,
        time_spent_seconds,
        attempt_number: 1, // We'll improve this later to track multiple attempts
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (attemptError) {
      console.error('❌ Error recording attempt:', attemptError)
      return NextResponse.json({ error: 'Failed to record attempt' }, { status: 500 })
    }

    // Update user progress in user_topic_progress table
    const { data: existingProgress } = await supabaseAdmin
      .from('user_topic_progress')
      .select('*')
      .eq('user_id', user_id)
      .eq('topic_id', topic_id)
      .single()

    const now = new Date().toISOString()
    const newTotalAttempts = (existingProgress?.total_attempts || 0) + 1
    const newCorrectAttempts = (existingProgress?.correct_attempts || 0) + (is_correct ? 1 : 0)
    const newMasteryLevel = Math.min(1.0, newCorrectAttempts / newTotalAttempts)

    const progressData = {
      user_id,
      topic_id,
      mastery_level: newMasteryLevel,
      total_attempts: newTotalAttempts,
      correct_attempts: newCorrectAttempts,
      last_attempt_at: now,
      mastered_at: newMasteryLevel >= 0.8 && !existingProgress?.mastered_at ? now : existingProgress?.mastered_at,
      updated_at: now
    }

    if (existingProgress) {
      await supabaseAdmin
        .from('user_topic_progress')
        .update(progressData)
        .eq('user_id', user_id)
        .eq('topic_id', topic_id)
    } else {
      await supabaseAdmin
        .from('user_topic_progress')
        .insert({ ...progressData, created_at: now })
    }

    console.log(`✅ Recorded practice attempt: ${is_correct ? 'CORRECT' : 'INCORRECT'}`)

    return NextResponse.json({
      success: true,
      attempt_id: attempt.id,
      is_correct,
      mastery_level: newMasteryLevel,
      progress_updated: true
    })

  } catch (error) {
    console.error('❌ Failed to record practice attempt:', error)
    return NextResponse.json(
      { error: 'Failed to record attempt', details: error.message },
      { status: 500 }
    )
  }
}