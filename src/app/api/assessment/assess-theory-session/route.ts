import { NextRequest, NextResponse } from 'next/server'
import { apiErrorHandler, createSuccessResponse, createErrorResponse, parseRequestBody } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Correctness threshold: answers with score >= 80% are considered correct
const CORRECTNESS_THRESHOLD = 80

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

    const { sessionId, userId, transcript: providedTranscript } = body

    if (!body || typeof body !== 'object') {
      console.error('❌ Invalid request body:', body)
      return NextResponse.json(
        { error: 'Invalid request body format' },
        { status: 400 }
      )
    }

    if (!sessionId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, userId' },
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

    // Fetch session from database to get ElevenLabs conversation ID if needed
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('training_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      console.error('❌ Error fetching session:', sessionError)
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Determine which transcript to use
    let transcript = providedTranscript || session.conversation_transcript

    // Check if transcript needs to be fetched from ElevenLabs
    const needsTranscriptFetch =
      !transcript ||
      transcript.length === 0 ||
      (transcript.length === 1 && transcript[0].content.includes('Get Transcript'))

    if (needsTranscriptFetch && session.elevenlabs_conversation_id) {
      console.log('📥 Transcript missing or incomplete, fetching from ElevenLabs...')
      console.log(`🔑 Using ElevenLabs conversation ID: ${session.elevenlabs_conversation_id}`)

      const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY
      if (!elevenlabsApiKey) {
        console.error('❌ ElevenLabs API key not configured')
        return NextResponse.json(
          { error: 'ElevenLabs API key not configured' },
          { status: 500 }
        )
      }

      try {
        const transcriptResponse = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversations/${session.elevenlabs_conversation_id}`,
          {
            method: 'GET',
            headers: {
              'xi-api-key': elevenlabsApiKey,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          }
        )

        if (!transcriptResponse.ok) {
          throw new Error('Failed to fetch transcript from ElevenLabs')
        }

        const conversationData = await transcriptResponse.json()

        // Extract transcript messages
        const fetchedTranscript: ConversationMessage[] = []

        if (Array.isArray(conversationData.transcript) && conversationData.transcript.length > 0) {
          for (const msg of conversationData.transcript) {
            fetchedTranscript.push({
              role: msg.role === 'agent' ? 'assistant' : 'user',
              content: msg.message || '',
              timestamp: msg.time_in_call_secs ? msg.time_in_call_secs * 1000 : Date.now()
            })
          }
        }

        if (fetchedTranscript.length === 0) {
          console.error('❌ No messages found in ElevenLabs transcript')
          return NextResponse.json(
            { error: 'No messages found in ElevenLabs transcript' },
            { status: 400 }
          )
        }

        console.log(`✅ Successfully fetched ${fetchedTranscript.length} messages from ElevenLabs`)

        // Update database with fetched transcript
        const { error: updateError } = await supabaseAdmin
          .from('training_sessions')
          .update({ conversation_transcript: fetchedTranscript })
          .eq('id', sessionId)

        if (updateError) {
          console.error('⚠️ Failed to save transcript to database:', updateError)
        } else {
          console.log('✅ Saved transcript to database')
        }

        transcript = fetchedTranscript
      } catch (error) {
        console.error('❌ Error fetching transcript from ElevenLabs:', error)
        return NextResponse.json(
          { error: 'Failed to fetch transcript from ElevenLabs' },
          { status: 500 }
        )
      }
    }

    if (!transcript || transcript.length === 0) {
      return NextResponse.json(
        { error: 'No transcript found for this session' },
        { status: 400 }
      )
    }

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
        success: true,
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
      // Mark session as completed even if no Q&A exchanges found
      const emptyAssessment = {
        summary: { totalQuestions: 0, correctAnswers: 0, score: 0 },
        assessmentResults: [],
        processedExchanges: 0,
        matchedQuestions: 0,
        analyzedAt: new Date().toISOString()
      }

      const { error: updateError } = await supabaseAdmin
        .from('training_sessions')
        .update({
          theory_assessment_results: emptyAssessment,
          assessment_completed_at: new Date().toISOString(),
          assessment_status: 'completed'
        })
        .eq('id', sessionId)

      if (updateError) {
        console.error('❌ Error marking empty session as completed:', updateError)
      } else {
        console.log('✅ Empty session marked as completed (no Q&A exchanges)')
      }

      return NextResponse.json({
        success: true,
        assessmentResults: [],
        summary: { totalQuestions: 0, correctAnswers: 0, score: 0 },
        message: 'No Q&A exchanges found in transcript',
        assessment: emptyAssessment
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

        // Assess the answer using AI (with session language)
        const assessment = await assessAnswer(
          exchange.question,
          exchange.answer,
          matchedQuestion.correct_answer,
          Array.isArray(matchedQuestion.knowledge_topics)
            ? matchedQuestion.knowledge_topics[0]?.name || 'Unknown Topic'
            : matchedQuestion.knowledge_topics?.name || 'Unknown Topic',
          session.language || 'en'
        )

        const topic = Array.isArray(matchedQuestion.knowledge_topics)
          ? matchedQuestion.knowledge_topics[0]
          : matchedQuestion.knowledge_topics

        // Apply threshold for correctness
        const isCorrectByThreshold = assessment.isCorrect || assessment.score >= CORRECTNESS_THRESHOLD

        const result: AssessmentResult = {
          questionId: matchedQuestion.id,
          questionAsked: exchange.question,
          userAnswer: exchange.answer,
          correctAnswer: matchedQuestion.correct_answer,
          isCorrect: isCorrectByThreshold,
          score: assessment.score,
          feedback: assessment.feedback,
          topicName: topic.name,
          topicCategory: topic.category,
          difficultyLevel: matchedQuestion.difficulty_level
        }

        assessmentResults.push(result)

        // Record the attempt in the database
        await recordQuestionAttempt(sessionId, userId, matchedQuestion, exchange, assessment)
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

    // Save assessment results to database for caching
    const assessmentData = {
      summary,
      assessmentResults,
      processedExchanges: qaExchanges.length,
      matchedQuestions: assessmentResults.length,
      analyzedAt: new Date().toISOString()
    }

    const { error: updateError } = await supabaseAdmin
      .from('training_sessions')
      .update({
        theory_assessment_results: assessmentData,
        assessment_completed_at: new Date().toISOString(),
        assessment_status: 'completed'
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('❌ Error saving assessment results:', updateError)
      // Don't fail the request - we have the results even if caching failed
    } else {
      console.log('✅ Assessment results cached in database')
    }

    return NextResponse.json({
      success: true,
      sessionId,
      assessmentResults,
      summary,
      processedExchanges: qaExchanges.length,
      matchedQuestions: assessmentResults.length,
      assessment: assessmentData
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
// Map language codes to full language names for GPT-4
function getLanguageName(languageCode: string): string {
  const languageMap: Record<string, string> = {
    'en': 'English',
    'ru': 'Russian',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'zh': 'Chinese',
    'ja': 'Japanese',
    'ko': 'Korean',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'cs': 'Czech',
    'nl': 'Dutch',
    'pl': 'Polish',
    'ka': 'Georgian'
  }
  return languageMap[languageCode] || 'English'
}

async function assessAnswer(
  question: string,
  userAnswer: string,
  correctAnswer: string,
  topicName: string,
  language: string = 'en'
): Promise<{ isCorrect: boolean, score: number, feedback: string }> {
  try {
    const languageName = getLanguageName(language)
    console.log(`🌍 Assessing answer in ${languageName} (${language})`)

    const prompt = `Assess this Q&A exchange for a ${topicName} training session:

Question: ${question}
Student Answer: ${userAnswer}
Expected Answer: ${correctAnswer}

Evaluate the student's answer and provide:
1. Whether it's correct (true/false)
2. A score from 0-100
3. Brief feedback (max 100 words) **IMPORTANT: Write feedback in ${languageName} language**

Consider:
- Factual accuracy
- Completeness
- Understanding demonstration
- Allow for reasonable variations in wording

**CRITICAL LANGUAGE INSTRUCTION**:
You MUST write the "feedback" field in ${languageName} language.
Only the JSON structure and field names should remain in English.

Respond in this exact JSON format:
{
  "isCorrect": true/false,
  "score": number,
  "feedback": "brief explanation in ${languageName}"
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
 * Record question attempt in database and update topic progress
 */
async function recordQuestionAttempt(
  sessionId: string,
  userId: string,
  question: any,
  exchange: any,
  assessment: any
): Promise<void> {
  try {
    const topic = Array.isArray(question.knowledge_topics)
      ? question.knowledge_topics[0]
      : question.knowledge_topics

    // Get employee_id from user_id
    const { data: employee, error: employeeError } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (employeeError || !employee) {
      console.error('❌ Could not find employee for user_id:', userId)
      return
    }

    const employeeId = employee.id

    // Apply correctness threshold
    const isCorrectByThreshold = assessment.isCorrect || assessment.score >= CORRECTNESS_THRESHOLD

    console.log(`🎯 Answer assessment: score=${assessment.score}%, AI says=${assessment.isCorrect}, threshold result=${isCorrectByThreshold}`)

    // Record the question attempt
    const attemptData = {
      training_session_id: sessionId,
      user_id: employeeId,
      topic_id: topic.id,
      question_id: question.id,
      question_asked: exchange.question,
      user_answer: exchange.answer,
      correct_answer: question.correct_answer,
      is_correct: isCorrectByThreshold,
      points_earned: isCorrectByThreshold ? (question.points || 1) : 0,
      time_spent_seconds: 30, // Estimate for voice answers
      attempt_number: 1,
      created_at: new Date().toISOString()
    }

    console.log('💾 Recording question attempt:', {
      question_id: question.id,
      employee_id: employeeId,
      is_correct: isCorrectByThreshold
    })

    const { error: attemptError } = await supabaseAdmin
      .from('question_attempts')
      .insert(attemptData)

    if (attemptError) {
      console.error('❌ Database error recording question attempt:', attemptError)
      throw attemptError
    }

    console.log(`✅ Recorded attempt for question ${question.id}: ${isCorrectByThreshold ? 'CORRECT' : 'INCORRECT'}`)

    // Update employee topic progress
    const { data: currentProgress } = await supabaseAdmin
      .from('user_topic_progress')
      .select('*')
      .eq('user_id', employeeId)
      .eq('topic_id', topic.id)
      .single()

    const totalAttempts = (currentProgress?.total_attempts || 0) + 1
    const correctAttempts = (currentProgress?.correct_attempts || 0) + (isCorrectByThreshold ? 1 : 0)
    const masteryLevel = totalAttempts > 0 ? correctAttempts / totalAttempts : 0

    const { error: progressError } = await supabaseAdmin
      .from('user_topic_progress')
      .upsert({
        user_id: employeeId,
        topic_id: topic.id,
        total_attempts: totalAttempts,
        correct_attempts: correctAttempts,
        mastery_level: masteryLevel,
        last_attempt_at: new Date().toISOString(),
        mastered_at: (masteryLevel >= 0.8 && totalAttempts >= 3)
          ? (currentProgress?.mastered_at || new Date().toISOString())
          : currentProgress?.mastered_at,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,topic_id'
      })

    if (progressError) {
      console.error('❌ Error updating topic progress:', progressError)
    } else {
      console.log(`✅ Updated topic progress: ${(masteryLevel * 100).toFixed(1)}% mastery (${correctAttempts}/${totalAttempts})`)
    }

  } catch (error) {
    console.error('❌ Error recording question attempt:', error)
    // Don't re-throw to prevent breaking the assessment flow
    console.error('⚠️ Question attempt was NOT fully saved - assessment will continue')
  }
}