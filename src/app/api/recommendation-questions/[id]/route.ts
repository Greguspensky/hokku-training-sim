import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: questionId } = await params
    const body = await request.json()
    const { question_text, category, difficulty_level } = body

    if (!question_text || !category || !difficulty_level) {
      return NextResponse.json({
        success: false,
        error: 'Question text, category, and difficulty level are required'
      }, { status: 400 })
    }

    console.log(`✏️ Updating recommendation question: ${questionId}`)

    const { data: updatedQuestion, error } = await supabaseAdmin
      .from('recommendation_questions')
      .update({
        question_text: question_text.trim(),
        category: category.trim(),
        difficulty_level: parseInt(difficulty_level),
        updated_at: new Date().toISOString()
      })
      .eq('id', questionId)
      .select()
      .single()

    if (error) {
      console.error('❌ Error updating recommendation question:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to update recommendation question'
      }, { status: 500 })
    }

    if (!updatedQuestion) {
      return NextResponse.json({
        success: false,
        error: 'Recommendation question not found'
      }, { status: 404 })
    }

    console.log(`✅ Successfully updated recommendation question: ${questionId}`)

    return NextResponse.json({
      success: true,
      question: updatedQuestion
    })

  } catch (error) {
    console.error('❌ Error in recommendation-questions API (PUT):', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: questionId } = await params

    console.log(`🗑️ Deleting recommendation question: ${questionId}`)

    // Soft delete by setting is_active to false
    const { data: deletedQuestion, error } = await supabaseAdmin
      .from('recommendation_questions')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', questionId)
      .select()
      .single()

    if (error) {
      console.error('❌ Error deleting recommendation question:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to delete recommendation question'
      }, { status: 500 })
    }

    if (!deletedQuestion) {
      return NextResponse.json({
        success: false,
        error: 'Recommendation question not found'
      }, { status: 404 })
    }

    console.log(`✅ Successfully deleted recommendation question: ${questionId}`)

    return NextResponse.json({
      success: true,
      message: 'Recommendation question deleted successfully'
    })

  } catch (error) {
    console.error('❌ Error in recommendation-questions API (DELETE):', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}