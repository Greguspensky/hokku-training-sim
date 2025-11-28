/**
 * API endpoint to record individual question attempts during training sessions
 * Updates both question_attempts table and employee_topic_progress
 */

import { NextRequest, NextResponse } from 'next/server'
import { apiErrorHandler, createSuccessResponse, createErrorResponse, parseRequestBody } from '@/lib/utils/api';
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const body = await parseRequestBody<any>(request)
    const {
      training_session_id,
      employee_id,
      topic_id,
      question_id,
      question_asked,
      employee_answer,
      correct_answer,
      is_correct,
      points_earned = 0,
      time_spent_seconds,
      attempt_number = 1
    } = body

    // Validate required fields
    if (!training_session_id || !employee_id || !question_id || !question_asked) {
      return createErrorResponse('Missing required fields', 400)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Record the question attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('question_attempts')
      .insert({
        training_session_id,
        employee_id,
        topic_id,
        question_id,
        question_asked,
        employee_answer,
        correct_answer,
        is_correct,
        points_earned,
        time_spent_seconds,
        attempt_number
      })
      .select()
      .single()

    if (attemptError) {
      console.error('❌ Failed to record question attempt:', attemptError)
      throw attemptError
    }

    console.log('✅ Recorded question attempt:', attempt.id)

    // 2. Update employee topic progress if topic_id is provided
    if (topic_id) {
      // Get current progress
      const { data: currentProgress } = await supabase
        .from('employee_topic_progress')
        .select('*')
        .eq('employee_id', employee_id)
        .eq('topic_id', topic_id)
        .single()

      const totalAttempts = (currentProgress?.total_attempts || 0) + 1
      const correctAttempts = (currentProgress?.correct_attempts || 0) + (is_correct ? 1 : 0)
      const masteryLevel = totalAttempts > 0 ? correctAttempts / totalAttempts : 0

      // Upsert progress record
      const { error: progressError } = await supabase
        .from('employee_topic_progress')
        .upsert({
          employee_id,
          topic_id,
          total_attempts: totalAttempts,
          correct_attempts: correctAttempts,
          mastery_level: masteryLevel,
          last_attempt_at: new Date().toISOString(),
          // Mark as mastered if above 80% and at least 3 attempts
          mastered_at: (masteryLevel >= 0.8 && totalAttempts >= 3)
            ? new Date().toISOString()
            : currentProgress?.mastered_at,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'employee_id,topic_id'
        })

      if (progressError) {
        console.error('❌ Failed to update topic progress:', progressError)
        // Don't throw - attempt was recorded successfully
      } else {
        console.log(`✅ Updated topic progress: ${masteryLevel.toFixed(2)} mastery (${correctAttempts}/${totalAttempts})`)
      }
    }

    return createSuccessResponse({
      data: {
        attempt_id: attempt.id,
        is_correct,
        points_earned
      }
    })

  } catch (error) {
    return apiErrorHandler(error, 'Record question attempt')
  }
}
