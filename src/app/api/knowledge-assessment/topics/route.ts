import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('company_id')

  if (!companyId) {
    return NextResponse.json({ error: 'company_id is required' }, { status: 400 })
  }

  try {
    // Get topics with their questions for this company
    const { data: topics, error } = await supabaseAdmin
      .from('knowledge_topics')
      .select(`
        *,
        topic_questions (*)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching topics:', error)
      return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      topics: topics || [],
      summary: {
        totalTopics: topics?.length || 0,
        totalQuestions: topics?.reduce((sum, topic) => sum + (topic.topic_questions?.length || 0), 0) || 0
      }
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, category, company_id, difficulty_level } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Topic name is required' }, { status: 400 })
    }

    if (!company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 })
    }

    // Create new topic
    const { data: topic, error } = await supabaseAdmin
      .from('knowledge_topics')
      .insert({
        name: name.trim(),
        description: description?.trim() || '',
        category: category || 'manual',
        company_id,
        difficulty_level: difficulty_level || 1
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating topic:', error)
      return NextResponse.json({ error: 'Failed to create topic' }, { status: 500 })
    }

    console.log('✅ Topic created:', topic.id, topic.name)

    return NextResponse.json({
      success: true,
      topic
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}