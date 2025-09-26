import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabaseAdmin } from '@/lib/supabase'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export async function POST(request: NextRequest) {
  console.log('✋ Starting Manual Question Processing...')

  const companyId = '01f773e2-1027-490e-8d36-279136700bbf'

  try {
    const { questions } = await request.json()

    if (!questions || typeof questions !== 'string') {
      return NextResponse.json({ error: 'Questions text is required' }, { status: 400 })
    }

    // 1. Get all knowledge base documents to use for finding answers
    console.log('📚 Loading knowledge base documents...')
    const { data: documents, error: docError } = await supabaseAdmin
      .from('knowledge_base_documents')
      .select('*')
      .eq('company_id', companyId)

    if (docError || !documents || documents.length === 0) {
      console.error('❌ No documents found:', docError)
      return NextResponse.json({ error: 'No knowledge base documents found' }, { status: 404 })
    }

    console.log(`✅ Found ${documents.length} documents to search for answers`)

    // Combine all document content for context
    const knowledgeContext = documents.map(doc => `
Document: "${doc.title}"
Content: ${doc.content}
`).join('\n---\n')

    // 2. Create or find the "Added Manually" topic
    console.log('📝 Creating "Added Manually" topic...')

    let manualTopic
    const { data: existingTopic, error: topicFetchError } = await supabaseAdmin
      .from('knowledge_topics')
      .select('*')
      .eq('name', 'Added Manually')
      .eq('category', 'manual')
      .single()

    if (existingTopic) {
      manualTopic = existingTopic
      console.log('✅ Using existing "Added Manually" topic')
    } else {
      const { data: newTopic, error: topicError } = await supabaseAdmin
        .from('knowledge_topics')
        .insert({
          name: 'Added Manually',
          description: 'Questions that were manually added by the user',
          category: 'manual',
          difficulty_level: 1
        })
        .select()
        .single()

      if (topicError || !newTopic) {
        console.error('❌ Error creating manual topic:', topicError)
        return NextResponse.json({ error: 'Failed to create manual topic' }, { status: 500 })
      }

      manualTopic = newTopic
      console.log('✅ Created new "Added Manually" topic')
    }

    // 3. Parse and process questions
    const questionList = questions
      .split('\n')
      .map(q => q.trim())
      .filter(q => q.length > 0 && q.includes('?'))

    if (questionList.length === 0) {
      return NextResponse.json({ error: 'No valid questions found. Please include questions ending with "?"' }, { status: 400 })
    }

    console.log(`🤔 Processing ${questionList.length} manual questions...`)

    const savedQuestions = []

    // 4. For each question, use LLM to find answer from knowledge base
    for (let i = 0; i < questionList.length; i++) {
      const question = questionList[i]
      console.log(`  🔍 Finding answer for: ${question.substring(0, 50)}...`)

      const answerPrompt = `
You are an expert at finding answers from company knowledge base documents.

QUESTION TO ANSWER: "${question}"

AVAILABLE KNOWLEDGE BASE:
${knowledgeContext}

TASK: Find the answer to the question using ONLY the information provided in the knowledge base above.

RULES:
1. If you can find a clear answer in the documents, provide it
2. If the information is not available in the documents, respond with "no answer found"
3. Be specific and concise
4. Quote relevant parts from the documents when possible

Provide only the answer, nothing else:`

      try {
        const answerResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: answerPrompt }],
          temperature: 0.1,
          max_tokens: 300
        })

        const answer = answerResponse.choices[0]?.message?.content?.trim() || 'no answer found'

        // 5. Save question to database
        const { data: savedQuestion, error: questionError } = await supabaseAdmin
          .from('topic_questions')
          .insert({
            topic_id: manualTopic.id,
            question_template: question,
            question_type: 'open_ended',
            correct_answer: answer,
            answer_options: null,
            points: 1,
            explanation: `Answer found using knowledge base search for manually added question.`
          })
          .select()
          .single()

        if (savedQuestion && !questionError) {
          savedQuestions.push(savedQuestion)
          console.log(`    ✅ Saved: ${question.substring(0, 40)}... → ${answer.substring(0, 30)}...`)
        } else {
          console.error(`    ❌ Failed to save question:`, questionError)
        }

      } catch (error) {
        console.error(`    ⚠️ Error processing question "${question}":`, error)

        // Save question with "no answer found" if LLM fails
        const { data: savedQuestion } = await supabaseAdmin
          .from('topic_questions')
          .insert({
            topic_id: manualTopic.id,
            question_template: question,
            question_type: 'open_ended',
            correct_answer: 'no answer found',
            answer_options: null,
            points: 1,
            explanation: 'Unable to find answer in knowledge base due to processing error.'
          })
          .select()
          .single()

        if (savedQuestion) {
          savedQuestions.push(savedQuestion)
        }
      }
    }

    console.log('🎉 MANUAL QUESTION PROCESSING COMPLETE!')
    console.log(`📊 Results: ${savedQuestions.length} questions processed and saved`)

    return NextResponse.json({
      success: true,
      questionsProcessed: questionList.length,
      questionsSaved: savedQuestions.length,
      topic: manualTopic,
      questions: savedQuestions
    })

  } catch (error) {
    console.error('❌ Manual question processing failed:', error)
    return NextResponse.json(
      { error: 'Failed to process manual questions', details: error.message },
      { status: 500 }
    )
  }
}