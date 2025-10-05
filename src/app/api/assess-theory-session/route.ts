import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface AssessmentResult {
  questionId: string
  questionAsked: string
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
  score: number
  feedback: string
  topicName: string
  topicCategory: string
  difficultyLevel: number
}

export async function POST(request: NextRequest) {
  try {
    let body
    try {
      body = await request.json()
    } catch (jsonError) {
      console.error('❌ JSON parsing error in request:', jsonError)
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { sessionId, userId, transcript } = body

    if (!body || typeof body !== 'object') {
      console.error('❌ Invalid request body:', body)
      return NextResponse.json(
        { error: 'Invalid request body format' },
        { status: 400 }
      )
    }

    if (!sessionId || !userId || !transcript) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, userId, transcript' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    console.log(`🎯 Assessing theory session ${sessionId} for user ${userId}`)
    console.log(`📝 Transcript contains ${transcript.length} messages`)

    // Get user's structured questions for context matching
    const { data: practiceQuestions, error: questionsError } = await supabaseAdmin
      .from('topic_questions')
      .select(`
        id,
        question_template,
        correct_answer,
        difficulty_level,
        knowledge_topics!inner(
          id,
          name,
          category
        )
      `)
      .eq('is_active', true)

    if (questionsError) {
      console.error('❌ Error fetching questions:', questionsError)
      return NextResponse.json({ error: 'Failed to fetch questions for assessment' }, { status: 500 })
    }

    if (!practiceQuestions || practiceQuestions.length === 0) {
      return NextResponse.json({
        assessmentResults: [],
        summary: { totalQuestions: 0, correctAnswers: 0, score: 0 },
        message: 'No questions available for assessment'
      })
    }

    console.log(`📚 Found ${practiceQuestions.length} questions for assessment matching`)

    // Extract Q&A pairs from transcript
    const qaExchanges = extractQAPairs(transcript)
    console.log(`💬 Extracted ${qaExchanges.length} Q&A exchanges from transcript`)

    if (qaExchanges.length === 0) {
      return NextResponse.json({
        assessmentResults: [],
        summary: { totalQuestions: 0, correctAnswers: 0, score: 0 },
        message: 'No Q&A exchanges found in transcript'
      })
    }

    // Match and assess each Q&A exchange
    const assessmentResults: AssessmentResult[] = []

    for (const exchange of qaExchanges) {
      console.log(`🔍 Processing Q&A: "${exchange.question.substring(0, 50)}..." -> "${exchange.answer.substring(0, 50)}..."`)

      // Debug: Log sample questions for comparison
      if (practiceQuestions.length > 0) {
        console.log('📚 Sample database questions for matching:')
        practiceQuestions.slice(0, 3).forEach((q, i) => {
          console.log(`  ${i + 1}. ${q.question_template}`)
        })
      }

      // Find the best matching question from our database
      const matchedQuestion = await findMatchingQuestion(exchange.question, practiceQuestions)

      if (matchedQuestion) {
        console.log(`✅ Matched with question: ${matchedQuestion.id}`)

        // Assess the answer using AI
        const assessment = await assessAnswer(
          exchange.question,
          exchange.answer,
          matchedQuestion.correct_answer,
          Array.isArray(matchedQuestion.knowledge_topics)
            ? matchedQuestion.knowledge_topics[0]?.name || 'Unknown Topic'
            : matchedQuestion.knowledge_topics?.name || 'Unknown Topic'
        )

        const topic = Array.isArray(matchedQuestion.knowledge_topics)
          ? matchedQuestion.knowledge_topics[0]
          : matchedQuestion.knowledge_topics

        const result: AssessmentResult = {
          questionId: matchedQuestion.id,
          questionAsked: exchange.question,
          userAnswer: exchange.answer,
          correctAnswer: matchedQuestion.correct_answer,
          isCorrect: assessment.isCorrect,
          score: assessment.score,
          feedback: assessment.feedback,
          topicName: topic.name,
          topicCategory: topic.category,
          difficultyLevel: matchedQuestion.difficulty_level
        }

        assessmentResults.push(result)

        // Record the attempt in the database
        await recordQuestionAttempt(userId, matchedQuestion, exchange, assessment)
      } else {
        console.log(`⚠️ No matching question found for: "${exchange.question.substring(0, 100)}..."`)
        console.log('💡 Consider checking if this question exists in your database or if the OpenAI matching is working correctly')
      }
    }

    // Calculate summary statistics
    const totalQuestions = assessmentResults.length
    const correctAnswers = assessmentResults.filter(r => r.isCorrect).length
    const averageScore = totalQuestions > 0
      ? assessmentResults.reduce((sum, r) => sum + r.score, 0) / totalQuestions
      : 0

    const summary = {
      totalQuestions,
      correctAnswers,
      incorrectAnswers: totalQuestions - correctAnswers,
      score: Math.round(averageScore),
      accuracy: totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0
    }

    console.log(`📊 Assessment complete: ${correctAnswers}/${totalQuestions} correct (${summary.accuracy}%)`)

    return NextResponse.json({
      success: true,
      sessionId,
      assessmentResults,
      summary,
      processedExchanges: qaExchanges.length,
      matchedQuestions: assessmentResults.length
    })

  } catch (error) {
    console.error('❌ Error in assess-theory-session API:', error)
    return NextResponse.json(
      { error: 'Internal server error during session assessment' },
      { status: 500 }
    )
  }
}

/**
 * Extract Q&A pairs from conversation transcript
 */
function extractQAPairs(transcript: ConversationMessage[]): Array<{ question: string, answer: string }> {
  const qaExchanges = []

  for (let i = 0; i < transcript.length - 1; i++) {
    const currentMessage = transcript[i]
    const nextMessage = transcript[i + 1]

    // Look for assistant question followed by user answer
    if (currentMessage.role === 'assistant' && nextMessage.role === 'user') {
      const userAnswer = nextMessage.content.trim()

      // Include all Q&A pairs, even short answers (they should be marked incorrect)
      // Only skip truly empty responses or pure punctuation
      if (userAnswer.length > 0 && !/^[.!?,;:\s]*$/.test(userAnswer)) {
        qaExchanges.push({
          question: currentMessage.content.trim(),
          answer: userAnswer
        })

        console.log(`📋 Extracted Q&A: "${currentMessage.content.substring(0, 50)}..." -> "${userAnswer.substring(0, 30)}..."`)
      } else {
        console.log(`⏭️ Skipped empty/punctuation answer: "${userAnswer}"`)
      }
    }
  }

  return qaExchanges
}

/**
 * Find the best matching question from our database using fuzzy matching
 */
async function findMatchingQuestion(spokenQuestion: string, availableQuestions: any[]): Promise<any | null> {
  try {
    // Use OpenAI to find the best matching question
    const prompt = `Given this spoken question from a conversation: "${spokenQuestion}"

Find the best matching question from this list of training questions:
${availableQuestions.map((q, i) => `${i + 1}. ${q.question_template}`).join('\n')}

IMPORTANT:
- The spoken question may be in a different language (Russian, English, etc.)
- Look for semantic similarity and meaning, not exact word matching
- Consider questions about coffee drinks, menu items, prices, and procedures
- Match concepts like "cappuccino", "prices", "menu items" even across languages

Return only the number (1-${availableQuestions.length}) of the best matching question, or "0" if no good match exists.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 10,
      temperature: 0
    })

    const matchNumber = parseInt(response.choices[0]?.message?.content?.trim() || '0')

    if (matchNumber > 0 && matchNumber <= availableQuestions.length) {
      return availableQuestions[matchNumber - 1]
    }

    return null
  } catch (error) {
    console.error('❌ Error finding matching question:', error)
    return null
  }
}

/**
 * Assess an answer using AI
 */
async function assessAnswer(
  question: string,
  userAnswer: string,
  correctAnswer: string,
  topicName: string
): Promise<{ isCorrect: boolean, score: number, feedback: string }> {
  try {
    const prompt = `Assess this Q&A exchange for a ${topicName} training session:

Question: ${question}
Student Answer: ${userAnswer}
Expected Answer: ${correctAnswer}

Evaluate the student's answer and provide:
1. Whether it's correct (true/false)
2. A score from 0-100
3. Brief feedback (max 100 words)

Consider:
- Factual accuracy
- Completeness
- Understanding demonstration
- Allow for reasonable variations in wording

Respond in this exact JSON format:
{
  "isCorrect": true/false,
  "score": number,
  "feedback": "brief explanation"
}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0
    })

    const responseContent = response.choices[0]?.message?.content || '{}'

    let result
    try {
      result = JSON.parse(responseContent)
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI response as JSON:', parseError)
      console.error('📄 Raw response content:', responseContent)

      // Fallback: try to extract information from plain text response
      const isCorrectMatch = responseContent.toLowerCase().includes('true') || responseContent.toLowerCase().includes('correct')
      const scoreMatch = responseContent.match(/\d+/)

      return {
        isCorrect: isCorrectMatch,
        score: scoreMatch ? Math.max(0, Math.min(100, parseInt(scoreMatch[0]))) : 0,
        feedback: 'Assessment completed with parsing issues. Please review manually.'
      }
    }

    return {
      isCorrect: result.isCorrect || false,
      score: Math.max(0, Math.min(100, result.score || 0)),
      feedback: result.feedback || 'Unable to assess answer'
    }
  } catch (error) {
    console.error('❌ Error assessing answer:', error)
    return {
      isCorrect: false,
      score: 0,
      feedback: 'Error occurred during answer assessment'
    }
  }
}

/**
 * Record question attempt in database
 */
async function recordQuestionAttempt(
  userId: string,
  question: any,
  exchange: any,
  assessment: any
): Promise<void> {
  try {
    const topic = Array.isArray(question.knowledge_topics)
      ? question.knowledge_topics[0]
      : question.knowledge_topics

    const attemptData = {
      user_id: userId,
      topic_id: topic.id,
      question_id: question.id,
      question_asked: exchange.question,
      user_answer: exchange.answer,
      correct_answer: question.correct_answer,
      is_correct: assessment.isCorrect,
      points_earned: assessment.isCorrect ? 2 : 0,
      time_spent_seconds: 30, // Estimate for voice answers
      attempt_number: 1,
      created_at: new Date().toISOString()
    }

    console.log('💾 Attempting to save question attempt:', {
      question_id: question.id,
      user_id: userId,
      is_correct: assessment.isCorrect
    })

    const { data, error } = await supabaseAdmin
      .from('question_attempts')
      .insert(attemptData)
      .select()

    if (error) {
      console.error('❌ Database error recording question attempt:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        attemptData
      })
      throw error
    }

    console.log(`✅ Recorded attempt for question ${question.id}: ${assessment.isCorrect ? 'CORRECT' : 'INCORRECT'}`)
  } catch (error) {
    console.error('❌ Error recording question attempt:', error)
    // Don't re-throw to prevent breaking the assessment flow, but log clearly
    console.error('⚠️ Question attempt was NOT saved to database - assessment will continue')
  }
}