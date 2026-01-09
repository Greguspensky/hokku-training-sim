import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { email, topicName, updates } = await request.json()

    if (!email || !topicName || !updates) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    console.log(`🔄 Starting bulk update for ${topicName}...`)

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

    // Get all questions for this topic
    const { data: questions } = await supabaseAdmin
      .from('topic_questions')
      .select('id, question_template')
      .eq('topic_id', topic.id)

    if (!questions || questions.length === 0) {
      return NextResponse.json({ error: 'No questions found' }, { status: 404 })
    }

    console.log(`📋 Found ${questions.length} questions to update`)

    // Update each question
    const updateResults = []
    let successCount = 0
    let failCount = 0

    for (const update of updates) {
      const question = questions.find(q => q.question_template === update.question)

      if (question) {
        const { error } = await supabaseAdmin
          .from('topic_questions')
          .update({ correct_answer: update.answer })
          .eq('id', question.id)

        if (error) {
          console.error(`❌ Failed to update question: ${update.question.substring(0, 50)}...`, error)
          failCount++
          updateResults.push({ question: update.question, success: false, error: error.message })
        } else {
          console.log(`✅ Updated: ${update.question.substring(0, 50)}...`)
          successCount++
          updateResults.push({ question: update.question, success: true })
        }
      } else {
        console.warn(`⚠️ Question not found: ${update.question.substring(0, 50)}...`)
        failCount++
        updateResults.push({ question: update.question, success: false, error: 'Question not found in database' })
      }
    }

    console.log(`🎉 Update complete! Success: ${successCount}, Failed: ${failCount}`)

    return NextResponse.json({
      success: true,
      totalUpdates: updates.length,
      successCount,
      failCount,
      results: updateResults
    })

  } catch (error) {
    console.error('❌ Bulk update failed:', error)
    return NextResponse.json(
      { error: 'Failed to update answers', details: error.message },
      { status: 500 }
    )
  }
}
