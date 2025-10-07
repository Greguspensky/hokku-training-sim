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
