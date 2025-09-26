import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function DELETE(request: NextRequest) {
  console.log('🗑️ Starting to clear all AI-generated questions and topics...')

  try {
    // 1. First get all topics to get their IDs
    const { data: existingTopics, error: fetchError } = await supabaseAdmin
      .from('knowledge_topics')
      .select('id')

    if (fetchError) {
      console.error('❌ Error fetching topics:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch existing topics', details: fetchError.message }, { status: 500 })
    }

    let deletedQuestions = 0
    let deletedTopics = 0

    // 2. Delete questions for each topic (to handle foreign key constraints properly)
    if (existingTopics && existingTopics.length > 0) {
      console.log(`🗑️ Clearing questions for ${existingTopics.length} topics...`)

      for (const topic of existingTopics) {
        const { error: questionsError } = await supabaseAdmin
          .from('topic_questions')
          .delete()
          .eq('topic_id', topic.id)

        if (questionsError) {
          console.error(`❌ Error clearing questions for topic ${topic.id}:`, questionsError)
        } else {
          console.log(`✅ Cleared questions for topic ${topic.id}`)
        }
      }

      // 3. Now delete all topics
      console.log('🗑️ Clearing all topics...')
      const { data: deletedTopicsData, error: topicsError } = await supabaseAdmin
        .from('knowledge_topics')
        .delete()
        .in('id', existingTopics.map(t => t.id))
        .select()

      if (topicsError) {
        console.error('❌ Error clearing topics:', topicsError)
        return NextResponse.json({ error: 'Failed to clear topics', details: topicsError.message }, { status: 500 })
      }

      deletedTopics = deletedTopicsData?.length || 0
    }

    // 4. Double-check by deleting any remaining items
    console.log('🧹 Final cleanup - removing any remaining items...')
    await supabaseAdmin.from('topic_questions').delete().neq('id', '')
    await supabaseAdmin.from('knowledge_topics').delete().neq('id', '')

    console.log(`✅ Successfully cleared all AI-generated content! (${deletedTopics} topics)`)

    return NextResponse.json({
      success: true,
      message: `All AI-generated questions and topics have been cleared from the database`,
      deletedTopics,
      deletedQuestions
    })

  } catch (error) {
    console.error('❌ Clear operation failed:', error)
    return NextResponse.json(
      { error: 'Failed to clear questions', details: error.message },
      { status: 500 }
    )
  }
}