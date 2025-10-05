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