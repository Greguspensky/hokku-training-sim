/**
 * API endpoint to manually update question answer for an employee
 * Used by managers to correct transcription errors in employee answers
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
      new_answer,
      manager_id
    } = body

    console.log('🔄 Update question answer request:', {
      employee_id,
      question_id,
      new_answer,
      manager_id
    })

    // Validate required fields
    if (!employee_id || !question_id || new_answer === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: employee_id, question_id, new_answer' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if there's an existing attempt
    const { data: existingAttempt, error: fetchError } = await supabase
      .from('question_attempts')
      .select('*')
      .eq('user_id', employee_id)
      .eq('question_id', question_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (fetchError || !existingAttempt) {
      console.error('❌ No attempt found for this question:', fetchError)
      return NextResponse.json(
        { error: 'No existing answer found for this question' },
        { status: 404 }
      )
    }

    // Update the answer (only update user_answer field for now)
    const updateData: any = {
      user_answer: new_answer
    }

    const { error: updateError } = await supabase
      .from('question_attempts')
      .update(updateData)
      .eq('id', existingAttempt.id)

    if (updateError) {
      console.error('❌ Failed to update answer:', updateError)
      throw updateError
    }

    console.log('✅ Updated question answer:', existingAttempt.id)

    return NextResponse.json({
      success: true,
      message: 'Answer updated successfully',
      data: {
        question_id,
        employee_id,
        new_answer
      }
    })

  } catch (error) {
    console.error('❌ Failed to update question answer:', error)
    return NextResponse.json(
      {
        error: 'Failed to update question answer',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
