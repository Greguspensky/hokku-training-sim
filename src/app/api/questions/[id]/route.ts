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

// Update a specific question's answer or move to different topic
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log(`✏️ Updating question: ${params.id}`)

  try {
    const body = await request.json()
    const { correct_answer, topic_id } = body

    // Validate that at least one field is provided
    if (!correct_answer && !topic_id) {
      return NextResponse.json({ error: 'Either correct_answer or topic_id is required' }, { status: 400 })
    }

    // Build update object dynamically
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (correct_answer) {
      if (typeof correct_answer !== 'string') {
        return NextResponse.json({ error: 'correct_answer must be a string' }, { status: 400 })
      }
      updateData.correct_answer = correct_answer.trim()
    }

    if (topic_id) {
      if (typeof topic_id !== 'string') {
        return NextResponse.json({ error: 'topic_id must be a string' }, { status: 400 })
      }
      updateData.topic_id = topic_id
      console.log(`📦 Moving question ${params.id} to topic ${topic_id}`)
    }

    const { data, error } = await supabaseAdmin
      .from('topic_questions')
      .update(updateData)
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