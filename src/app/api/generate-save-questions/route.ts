import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabaseAdmin } from '@/lib/supabase'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export async function POST(request: NextRequest) {
  console.log('🤖 Starting AI Question Generation AND Database Save...')

  const companyId = '01f773e2-1027-490e-8d36-279136700bbf'

  try {
    // 1. Get selected documents from request body
    const body = await request.json()
    const { selectedDocuments } = body

    if (!selectedDocuments || selectedDocuments.length === 0) {
      console.error('❌ No documents selected')
      return NextResponse.json({ error: 'No documents selected' }, { status: 400 })
    }

    console.log(`✅ Processing ${selectedDocuments.length} selected documents`)
    const documents = selectedDocuments

    // 2. Clear existing AI-generated questions and topics
    console.log('🗑️ Clearing existing AI-generated content...')
    await supabaseAdmin
      .from('topic_questions')
      .delete()
      .neq('id', 0) // Delete all rows

    await supabaseAdmin
      .from('knowledge_topics')
      .delete()
      .neq('id', 0) // Delete all rows

    const savedTopics = []
    const savedQuestions = []

    // 3. Process each selected document
    for (const doc of documents) {
      console.log(`🧠 AI analyzing "${doc.title}"...`)

      const categoryMapping = {
        'Prices': 'prices',
        'Drinks info': 'drinks_info'
      }

      const documentCategory = categoryMapping[doc.title] || 'general'

      // Create ONE topic per document
      const { data: savedTopic, error: topicError } = await supabaseAdmin
        .from('knowledge_topics')
        .insert({
          name: doc.title,
          description: `Learn about the content and information in ${doc.title}`,
          category: documentCategory,
          difficulty_level: 1
        })
        .select()
        .single()

      if (savedTopic && !topicError) {
        savedTopics.push(savedTopic)
        console.log(`  💾 Created topic: ${doc.title}`)

        // Generate questions for this topic
        console.log(`  🤔 Generating questions for: ${doc.title}`)

        const questionsPrompt = `
STRICT INSTRUCTION: Create ONLY 5-8 UNIQUE simple question and answer pairs based on the EXACT document content. NO multiple choice, NO true/false, NO options.

Document: "${doc.title}"
Document Category: ${documentCategory}
Content: """
${doc.content}
"""

Based on the document category, create specific question types:

For PRICES documents, ask:
- "How much does [specific drink] cost?"
- "What sizes are available for [specific drink]?"
- "What is the price of [size] [drink]?"

For DRINKS_INFO documents, ask:
- "What is [drink name]?"
- "What does [drink name] consist of?"
- "What are the ingredients in [drink name]?"

IMPORTANT: Generate 5-8 COMPLETELY UNIQUE questions. Each question must be about a DIFFERENT drink or DIFFERENT aspect. NO DUPLICATES ALLOWED.

Return as JSON array with simple structure:
[
  {
    "question_template": "How much does Cappuccino cost?",
    "question_type": "open_ended",
    "correct_answer": "250/350/450 ml",
    "points": 1,
    "explanation": "According to the price list, Cappuccino costs this amount"
  }
]`

        try {
          const questionsResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: questionsPrompt }],
            temperature: 0.3,
            max_tokens: 3000
          })

          const questionsAI = questionsResponse.choices[0]?.message?.content?.trim()
          const questionsMatch = questionsAI?.match(/\[[\s\S]*\]/)

          if (questionsMatch) {
            const questions = JSON.parse(questionsMatch[0])
            console.log(`  ✅ Generated ${questions.length} questions`)

            // Save questions to database
            for (const question of questions) {
              const { data: savedQuestion, error: questionError } = await supabaseAdmin
                .from('topic_questions')
                .insert({
                  topic_id: savedTopic.id,
                  question_template: question.question_template,
                  question_type: 'open_ended',
                  correct_answer: question.correct_answer,
                  answer_options: null,
                  points: question.points || 1,
                  explanation: question.explanation
                })
                .select()
                .single()

              if (savedQuestion && !questionError) {
                savedQuestions.push(savedQuestion)
                console.log(`    💾 Saved question: ${question.question_template.substring(0, 50)}...`)
              } else {
                console.error(`    ❌ Failed to save question:`, questionError)
              }
            }
          }
        } catch (qError) {
          console.log(`  ⚠️ Question generation failed: ${qError}`)
        }
      } else {
        console.error(`  ❌ Failed to save topic:`, topicError)
      }
    }

    // 4. Return results
    console.log('🎉 AI EXTRACTION AND SAVE COMPLETE!')
    console.log(`📊 Results: ${savedTopics.length} topics, ${savedQuestions.length} questions saved to database`)

    return NextResponse.json({
      success: true,
      saved: true,
      topics: savedTopics,
      questions: savedQuestions,
      summary: {
        documentsAnalyzed: documents.length,
        topicsExtracted: savedTopics.length,
        questionsSaved: savedQuestions.length
      }
    })

  } catch (error) {
    console.error('❌ AI extraction and save failed:', error)
    return NextResponse.json(
      { error: 'AI extraction failed', details: error.message },
      { status: 500 }
    )
  }
}