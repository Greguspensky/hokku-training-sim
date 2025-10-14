import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { question_ids } = await request.json()

    if (!question_ids || !Array.isArray(question_ids) || question_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'question_ids array is required' },
        { status: 400 }
      )
    }

    console.log(`🔍 Fetching ${question_ids.length} questions by IDs...`)

    // Fetch questions by IDs from recommendation_questions table
    const { data: questions, error } = await supabaseAdmin
      .from('recommendation_questions')
      .select('*')
      .in('id', question_ids)

    if (error) {
      console.error('❌ Error fetching questions:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch questions' },
        { status: 500 }
      )
    }

    console.log(`✅ Found ${questions?.length || 0} questions`)

    // Ensure questions are returned in the same order as requested
    const orderedQuestions = question_ids.map(id =>
      questions?.find(q => q.id === id)
    ).filter(Boolean) // Remove any null/undefined entries

    return NextResponse.json({
      success: true,
      questions: orderedQuestions,
      count: orderedQuestions.length
    })

  } catch (error) {
    console.error('❌ Error in questions API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { question_ids } = await request.json()

    if (!question_ids || !Array.isArray(question_ids) || question_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'question_ids array is required' },
        { status: 400 }
      )
    }

    console.log(`🗑️ Deleting ${question_ids.length} questions...`)

    // Delete questions from topic_questions table
    const { error } = await supabaseAdmin
      .from('topic_questions')
      .delete()
      .in('id', question_ids)

    if (error) {
      console.error('❌ Error deleting questions:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete questions' },
        { status: 500 }
      )
    }

    console.log(`✅ Successfully deleted ${question_ids.length} questions`)

    return NextResponse.json({
      success: true,
      deleted_count: question_ids.length
    })

  } catch (error) {
    console.error('❌ Error in bulk delete API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}