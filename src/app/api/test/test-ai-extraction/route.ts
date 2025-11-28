import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabaseAdmin } from '@/lib/supabase'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export async function POST(request: NextRequest) {
  console.log('🤖 Starting REAL AI Knowledge Extraction with GPT-4...')

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

    console.log(`✅ Found ${documents.length} documents to analyze:`)
    documents.forEach(doc => {
      console.log(`  - "${doc.title}" (${doc.content.length} chars)`)
    })

    const allTopics = []
    const allQuestions = []

    // 2. Extract topics and questions from each document
    for (const doc of documents) {
      console.log(`🧠 AI analyzing "${doc.title}"...`)

      // Extract topics using GPT-4
      const topicsPrompt = `
Analyze this coffee shop document and extract distinct learning topics that employees should master.

Document: "${doc.title}"
Content: """
${doc.content}
"""

For each topic, provide:
1. name: Short, clear topic name (e.g., "Cappuccino Sizes", "Espresso Preparation")
2. description: Brief description of what employees need to know
3. category: One of: menu, procedures, policies, general
4. difficulty_level: 1=beginner, 2=intermediate, 3=advanced

Focus on actionable knowledge that can be tested with specific questions.

Return response as JSON array:
[
  {
    "name": "Topic Name",
    "description": "What employees need to learn",
    "category": "menu|procedures|policies|general",
    "difficulty_level": 1|2|3
  }
]
`

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

          // Generate questions for each topic
          for (const topic of topics) {
            console.log(`  🤔 Generating questions for: ${topic.name}`)

            const questionsPrompt = `
Create 2-3 training questions about "${topic.name}" for employee assessment.

Topic Details:
- Name: ${topic.name}
- Description: ${topic.description}
- Category: ${topic.category}
- Difficulty: ${topic.difficulty_level}/3

Context from company document:
"""
${doc.content}
"""

Generate questions that test specific knowledge employees need for their job.

For each question provide:
1. question_template: The question text
2. question_type: "multiple_choice", "open_ended", or "true_false"
3. correct_answer: The correct answer
4. answer_options: Array of options (for multiple_choice only, 3-4 options)
5. points: 1-5 points based on difficulty
6. explanation: Why this answer is correct

Return as JSON array:
[
  {
    "question_template": "What sizes are available for cappuccino?",
    "question_type": "multiple_choice",
    "correct_answer": "250ml, 350ml, 450ml",
    "answer_options": ["250ml, 350ml, 450ml", "Only 350ml", "200ml, 400ml", "Small, Medium, Large"],
    "points": 2,
    "explanation": "According to our menu, cappuccino comes in three sizes: 250ml, 350ml, and 450ml"
  }
]
`

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
                console.log(`  ✅ Generated ${questions.length} questions`)

                // Add to results
                topic.id = `ai-topic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                allTopics.push(topic)

                questions.forEach((q: any) => {
                  q.topic_id = topic.id
                  q.id = `ai-question-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                  allQuestions.push(q)
                })
              }
            } catch (qError) {
              console.log(`  ⚠️ Question generation failed: ${qError}`)
            }
          }
        }
      } catch (tError) {
        console.log(`  ⚠️ Topic extraction failed: ${tError}`)
      }
    }

    // 3. Return results
    console.log('🎉 AI EXTRACTION COMPLETE!')
    console.log(`📊 Results: ${allTopics.length} topics, ${allQuestions.length} questions`)

    return NextResponse.json({
      success: true,
      topics: allTopics,
      questions: allQuestions,
      summary: {
        documentsAnalyzed: documents.length,
        topicsExtracted: allTopics.length,
        questionsGenerated: allQuestions.length
      }
    })

  } catch (error) {
    console.error('❌ AI extraction failed:', error)
    return NextResponse.json(
      { error: 'AI extraction failed', details: error.message },
      { status: 500 }
    )
  }
}