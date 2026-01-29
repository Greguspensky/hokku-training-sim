import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { topicId: string } }
) {
  try {
    const { topicId } = params
    const body = await request.json()
    const { name } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Topic name is required' }, { status: 400 })
    }

    // Update the topic name
    const { data, error } = await supabaseAdmin
      .from('knowledge_topics')
      .update({ name: name.trim() })
      .eq('id', topicId)
      .select()
      .single()

    if (error) {
      console.error('Error updating topic:', error)
      return NextResponse.json({ error: 'Failed to update topic' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      topic: data
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { topicId: string } }
) {
  try {
    const { topicId } = params

    console.log(`🗑️ Deleting topic: ${topicId}`)

    // First, delete all questions associated with this topic
    const { error: questionsError } = await supabaseAdmin
      .from('topic_questions')
      .delete()
      .eq('topic_id', topicId)

    if (questionsError) {
      console.error('Error deleting topic questions:', questionsError)
      return NextResponse.json(
        { error: 'Failed to delete topic questions', details: questionsError.message },
        { status: 500 }
      )
    }

    console.log(`✅ Deleted questions for topic: ${topicId}`)

    // Then, delete the topic itself
    const { error: topicError } = await supabaseAdmin
      .from('knowledge_topics')
      .delete()
      .eq('id', topicId)

    if (topicError) {
      console.error('Error deleting topic:', topicError)
      return NextResponse.json(
        { error: 'Failed to delete topic', details: topicError.message },
        { status: 500 }
      )
    }

    console.log(`✅ Topic deleted successfully: ${topicId}`)

    return NextResponse.json({
      success: true,
      message: 'Topic and all associated questions deleted successfully'
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
