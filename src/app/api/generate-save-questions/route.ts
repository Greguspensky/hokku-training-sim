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
    // 1. Get documents from database
    console.log('📚 Loading knowledge base documents...')
    const { data: documents, error } = await supabaseAdmin
      .from('knowledge_base_documents')
      .select('*')
      .eq('company_id', companyId)

    if (error || !documents || documents.length === 0) {
      console.error('❌ No documents found:', error)
      return NextResponse.json({ error: 'No documents found' }, { status: 404 })
    }

    console.log(`✅ Found ${documents.length} documents to analyze`)

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

    // 3. Extract topics and questions from each document
    for (const doc of documents) {
      console.log(`🧠 AI analyzing "${doc.title}"...`)

      // Extract topics using GPT-4 - Focus only on document content
      const categoryMapping = {
        'Prices': 'prices',
        'Drinks info': 'drinks_info'
      }

      const documentCategory = categoryMapping[doc.title] || 'general'

      const topicsPrompt = `
STRICT INSTRUCTION: Only create topics based on the EXACT content in this document. Do NOT add topics about health, safety, policies, or procedures unless they are explicitly mentioned in the document content.

Document: "${doc.title}"
Document Category: ${documentCategory}
Content: """
${doc.content}
"""

Based ONLY on what is written in this document content above, extract learning topics:

If this is a PRICES document, focus on:
- Price information for specific drinks
- Size options available
- Cost-related topics

If this is a DRINKS INFO document, focus on:
- Drink compositions and ingredients
- Drink descriptions
- What each drink consists of

Do NOT create topics about health, safety, policies, or procedures unless they are explicitly mentioned in the document content.

Return response as JSON array:
[
  {
    "name": "Topic Name Based on Document Content",
    "description": "What employees need to learn from this specific document",
    "category": "${documentCategory}",
    "difficulty_level": 1
  }
]`

      try {
        const topicsResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: topicsPrompt }],
          temperature: 0.1,
          max_tokens: 2000
        })

        const topicsAI = topicsResponse.choices[0]?.message?.content?.trim()
        const topicsMatch = topicsAI?.match(/\[[\s\S]*\]/)

        if (topicsMatch) {
          const topics = JSON.parse(topicsMatch[0])
          console.log(`  ✅ Extracted ${topics.length} topics`)

          // Save topics to database
          for (const topic of topics) {
            const { data: savedTopic, error: topicError } = await supabaseAdmin
              .from('knowledge_topics')
              .insert({
                name: topic.name,
                description: topic.description,
                category: topic.category,
                difficulty_level: topic.difficulty_level
              })
              .select()
              .single()

            if (savedTopic && !topicError) {
              savedTopics.push(savedTopic)
              console.log(`  💾 Saved topic: ${topic.name}`)

              // Generate questions for each topic
              console.log(`  🤔 Generating questions for: ${topic.name}`)

              const questionsPrompt = `
STRICT INSTRUCTION: Create ONLY simple question and answer pairs based on the EXACT document content. NO multiple choice, NO true/false, NO options.

Topic: "${topic.name}"
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

Generate 2-3 questions that can ONLY be answered using information from the document above.

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
                  temperature: 0.2,
                  max_tokens: 2000
                })

                const questionsAI = questionsResponse.choices[0]?.message?.content?.trim()
                const questionsMatch = questionsAI?.match(/\[[\s\S]*\]/)

                if (questionsMatch) {
                  const questions = JSON.parse(questionsMatch[0])
                  console.log(`    ✅ Generated ${questions.length} questions`)

                  // Save questions to database
                  for (const question of questions) {
                    const { data: savedQuestion, error: questionError } = await supabaseAdmin
                      .from('topic_questions')
                      .insert({
                        topic_id: savedTopic.id,
                        question_template: question.question_template,
                        question_type: 'open_ended', // Force all questions to be open_ended
                        correct_answer: question.correct_answer,
                        answer_options: null, // Remove multiple choice options
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
                console.log(`    ⚠️ Question generation failed: ${qError}`)
              }
            } else {
              console.error(`  ❌ Failed to save topic:`, topicError)
            }
          }
        }
      } catch (tError) {
        console.log(`  ⚠️ Topic extraction failed: ${tError}`)
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