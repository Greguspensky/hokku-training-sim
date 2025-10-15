/**
 * API endpoint to manually update question status for an employee
 * Used by managers to override question status (unanswered -> correct/incorrect)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      employee_id,
      question_id,
      new_status, // 'correct', 'incorrect', or 'unanswered'
      manager_id
    } = body

    console.log('🔄 Update question status request:', {
      employee_id,
      question_id,
      new_status,
      manager_id
    })

    // Validate required fields
    if (!employee_id || !question_id || !new_status) {
      return NextResponse.json(
        { error: 'Missing required fields: employee_id, question_id, new_status' },
        { status: 400 }
      )
    }

    // Validate status value
    if (!['correct', 'incorrect', 'unanswered'].includes(new_status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: correct, incorrect, or unanswered' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get question details
    const { data: question, error: questionError } = await supabase
      .from('topic_questions')
      .select(`
        id,
        question_template,
        correct_answer,
        topic_id,
        knowledge_topics!inner(
          id,
          name,
          company_id
        )
      `)
      .eq('id', question_id)
      .single()

    if (questionError || !question) {
      console.error('❌ Question not found:', questionError)
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      )
    }

    const topic = Array.isArray(question.knowledge_topics)
      ? question.knowledge_topics[0]
      : question.knowledge_topics

    // If new_status is 'unanswered', delete any existing attempts
    if (new_status === 'unanswered') {
      // Production schema uses user_id instead of employee_id
      const { error: deleteError } = await supabase
        .from('question_attempts')
        .delete()
        .eq('user_id', employee_id)
        .eq('question_id', question_id)

      if (deleteError) {
        console.error('❌ Failed to delete attempts:', deleteError)
      } else {
        console.log('✅ Deleted question attempts for reset')
      }

      // Recalculate topic progress
      await recalculateTopicProgress(supabase, employee_id, topic.id)

      return NextResponse.json({
        success: true,
        message: 'Question status reset to unanswered'
      })
    }

    // For 'correct' or 'incorrect' status, create or update an attempt
    const is_correct = new_status === 'correct'

    // Check if there's an existing attempt
    // Production schema uses user_id instead of employee_id
    const { data: existingAttempt } = await supabase
      .from('question_attempts')
      .select('*')
      .eq('user_id', employee_id)
      .eq('question_id', question_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (existingAttempt) {
      // Update existing attempt
      const updateData: any = {
        is_correct,
        user_answer: `[Manager Override: ${new_status}]`,
        updated_at: new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from('question_attempts')
        .update(updateData)
        .eq('id', existingAttempt.id)

      if (updateError) {
        console.error('❌ Failed to update attempt:', updateError)
        throw updateError
      }

      console.log('✅ Updated existing question attempt:', existingAttempt.id)
    } else {
      // Create new attempt record
      // Production schema uses: user_id (not employee_id), user_answer (not employee_answer)
      const insertData: any = {
        user_id: employee_id, // Production schema uses user_id
        question_id,
        topic_id: topic.id,
        question_asked: question.question_template,
        user_answer: `[Manager Override: ${new_status}]`,
        correct_answer: question.correct_answer || '',
        is_correct,
        points_earned: is_correct ? 10 : 0,
        time_spent_seconds: 0,
        attempt_number: 1
      }

      console.log('🔧 Creating question attempt with production schema (user_id, user_answer)')

      const { error: insertError } = await supabase
        .from('question_attempts')
        .insert(insertData)

      if (insertError) {
        console.error('❌ Failed to create attempt:', {
          error: insertError,
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint
        })
        throw insertError
      }

      console.log('✅ Created new question attempt record')
    }

    // Recalculate topic progress
    await recalculateTopicProgress(supabase, employee_id, topic.id)

    return NextResponse.json({
      success: true,
      message: `Question status updated to ${new_status}`,
      data: {
        question_id,
        employee_id,
        new_status,
        is_correct
      }
    })

  } catch (error) {
    console.error('❌ Failed to update question status:', error)
    return NextResponse.json(
      {
        error: 'Failed to update question status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Recalculate topic progress based on all attempts
 */
async function recalculateTopicProgress(
  supabase: any,
  employee_id: string,
  topic_id: string
) {
  try {
    // Get all questions for this topic
    const { data: topicQuestions } = await supabase
      .from('topic_questions')
      .select('id')
      .eq('topic_id', topic_id)
      .eq('is_active', true)

    if (!topicQuestions || topicQuestions.length === 0) {
      console.log('⚠️ No questions found for topic:', topic_id)
      return
    }

    const questionIds = topicQuestions.map(q => q.id)

    // Get all attempts for this employee and topic
    // Production schema uses user_id instead of employee_id
    const { data: attempts } = await supabase
      .from('question_attempts')
      .select('*')
      .eq('user_id', employee_id)
      .in('question_id', questionIds)

    // Calculate latest status for each question
    const questionStatusMap = new Map()

    if (attempts && attempts.length > 0) {
      attempts.forEach(attempt => {
        const existing = questionStatusMap.get(attempt.question_id)
        if (!existing || new Date(attempt.created_at) > new Date(existing.created_at)) {
          questionStatusMap.set(attempt.question_id, attempt)
        }
      })
    }

    // Count correct/incorrect/unanswered
    let totalAttempts = 0
    let correctAttempts = 0

    questionIds.forEach(qId => {
      const latestAttempt = questionStatusMap.get(qId)
      if (latestAttempt) {
        totalAttempts++
        if (latestAttempt.is_correct) {
          correctAttempts++
        }
      }
    })

    const masteryLevel = totalAttempts > 0 ? correctAttempts / totalAttempts : 0

    // Upsert progress record
    // Production schema uses user_topic_progress table with user_id column
    const { error: progressError } = await supabase
      .from('user_topic_progress')
      .upsert({
        user_id: employee_id, // Production schema uses user_id
        topic_id,
        total_attempts: totalAttempts,
        correct_attempts: correctAttempts,
        mastery_level: masteryLevel,
        last_attempt_at: new Date().toISOString(),
        mastered_at: (masteryLevel >= 0.8 && totalAttempts >= 3)
          ? new Date().toISOString()
          : null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,topic_id'
      })

    if (progressError) {
      console.error('❌ Failed to update topic progress:', progressError)
    } else {
      console.log(`✅ Recalculated topic progress: ${masteryLevel.toFixed(2)} mastery (${correctAttempts}/${totalAttempts})`)
    }
  } catch (error) {
    console.error('❌ Error recalculating topic progress:', error)
  }
}
