import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const topicName = searchParams.get('topic')

    if (!email || !topicName) {
      return NextResponse.json({ error: 'email and topic parameters required' }, { status: 400 })
    }

    // Get user's company_id
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('email', email)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get the topic
    const { data: topic } = await supabaseAdmin
      .from('knowledge_topics')
      .select('id')
      .eq('name', topicName)
      .eq('company_id', user.company_id)
      .single()

    if (!topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }

    // Get all questions
    const { data: questions } = await supabaseAdmin
      .from('topic_questions')
      .select('question_template, correct_answer')
      .eq('topic_id', topic.id)
      .order('created_at')

    return NextResponse.json({
      success: true,
      count: questions?.length || 0,
      questions: questions || []
    })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
