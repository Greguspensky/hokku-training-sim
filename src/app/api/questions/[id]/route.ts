import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Delete a specific question
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log(`🗑️ Deleting question: ${params.id}`)

  try {
    const { error } = await supabaseAdmin
      .from('topic_questions')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('❌ Error deleting question:', error)
      return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 })
    }

    console.log(`✅ Successfully deleted question: ${params.id}`)
    return NextResponse.json({ success: true, message: 'Question deleted successfully' })

  } catch (error) {
    console.error('❌ Delete operation failed:', error)
    return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 })
  }
}

// Update a specific question's answer
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log(`✏️ Updating question: ${params.id}`)

  try {
    const { correct_answer } = await request.json()

    if (!correct_answer || typeof correct_answer !== 'string') {
      return NextResponse.json({ error: 'correct_answer is required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('topic_questions')
      .update({
        correct_answer: correct_answer.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error || !data) {
      console.error('❌ Error updating question:', error)
      return NextResponse.json({ error: 'Failed to update question' }, { status: 500 })
    }

    console.log(`✅ Successfully updated question: ${params.id}`)
    return NextResponse.json({ success: true, question: data })

  } catch (error) {
    console.error('❌ Update operation failed:', error)
    return NextResponse.json({ error: 'Failed to update question' }, { status: 500 })
  }
}