import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { sessionId, forceReAnalysis = false } = await request.json()

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Session ID is required'
      }, { status: 400 })
    }

    // Get the session from database
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('training_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({
        success: false,
        error: 'Session not found'
      }, { status: 404 })
    }

    // Check if analysis is already completed and cached (unless forced re-analysis)
    console.log(`🔍 Checking cache status for session ${sessionId}:`)
    console.log(`  - forceReAnalysis: ${forceReAnalysis}`)
    console.log(`  - assessment_status: "${session.assessment_status}"`)
    console.log(`  - theory_assessment_results exists: ${!!session.theory_assessment_results}`)

    if (!forceReAnalysis && session.assessment_status === 'completed' && session.theory_assessment_results) {
      console.log(`✅ Using cached assessment results for session ${sessionId}`)

      return NextResponse.json({
        success: true,
        sessionId,
        transcriptAnalysis: {
          totalMessages: session.conversation_transcript?.length || 0,
          userMessages: session.conversation_transcript?.filter(m => m.role === 'user').length || 0,
          assistantMessages: session.conversation_transcript?.filter(m => m.role === 'assistant').length || 0,
          qaPairsFound: session.theory_assessment_results?.processedExchanges || 0,
          transcript: session.conversation_transcript || []
        },
        assessment: session.theory_assessment_results,
        fromCache: true,
        cachedAt: session.assessment_completed_at
      })
    }

    if (!session.elevenlabs_conversation_id) {
      return NextResponse.json({
        success: false,
        error: 'No ElevenLabs conversation ID found for this session'
      }, { status: 400 })
    }

    console.log(`🔄 Fetching transcript for session ${sessionId} with conversation ID: ${session.elevenlabs_conversation_id}`)

    // Fetch transcript directly from ElevenLabs API (bypass internal API call to avoid 401 issues)
    const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY
    if (!elevenlabsApiKey) {
      console.error('❌ ElevenLabs API key not configured in environment variables')
      return NextResponse.json({
        success: false,
        error: 'ElevenLabs API key not configured'
      }, { status: 500 })
    }

    console.log(`🔗 Calling ElevenLabs API directly for conversation: ${session.elevenlabs_conversation_id}`)

    // Use the same retry logic as the transcript endpoint
    let transcriptResponse: Response
    const maxRetries = 3

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      console.log(`🔄 ElevenLabs API attempt ${attempt + 1}/${maxRetries}`)

      try {
        transcriptResponse = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${session.elevenlabs_conversation_id}`, {
          method: 'GET',
          headers: {
            'xi-api-key': elevenlabsApiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        })

        if (transcriptResponse.ok) {
          console.log(`✅ ElevenLabs API success on attempt ${attempt + 1}`)
          break
        }

        // Enhanced logging for 401 errors
        if (transcriptResponse.status === 401) {
          console.error('🔑 Authentication failed:', {
            attempt: attempt + 1,
            conversationId: session.elevenlabs_conversation_id,
            timestamp: new Date().toISOString(),
            responseHeaders: Object.fromEntries(transcriptResponse.headers.entries()),
            vercelRegion: process.env.VERCEL_REGION,
            nodeEnv: process.env.NODE_ENV,
            apiKeyConfigured: !!elevenlabsApiKey,
            apiKeyLength: elevenlabsApiKey?.length,
            apiKeyFormat: elevenlabsApiKey?.startsWith('sk-')
          })

          // Retry 401 errors as they can be intermittent
          if (attempt < maxRetries - 1) {
            const delay = Math.pow(2, attempt) * 1000
            console.log(`⏳ Retrying 401 auth error in ${delay}ms...`)
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }
        }

        // Final attempt or non-retryable error
        if (attempt === maxRetries - 1) {
          const errorText = await transcriptResponse.text()
          console.error(`❌ ElevenLabs API final error:`, {
            status: transcriptResponse.status,
            statusText: transcriptResponse.statusText,
            details: errorText,
            attempt: attempt + 1,
            maxRetries
          })
          return NextResponse.json({
            success: false,
            error: `Failed to fetch transcript from ElevenLabs: ${transcriptResponse.status}`
          }, { status: 500 })
        }

      } catch (fetchError: any) {
        console.error(`❌ Network error on attempt ${attempt + 1}:`, fetchError.message)

        if (attempt === maxRetries - 1) {
          return NextResponse.json({
            success: false,
            error: `Network error after ${maxRetries} attempts: ${fetchError.message}`
          }, { status: 500 })
        }

        const delay = Math.pow(2, attempt) * 1000
        console.log(`⏳ Network error, retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    const conversationData = await transcriptResponse.json()

    // Transform ElevenLabs format to match expected format
    const transcriptMessages = conversationData.transcript || []
    const formattedTranscript = []

    if (Array.isArray(transcriptMessages)) {
      for (const msg of transcriptMessages) {
        const role = msg.role === 'agent' ? 'assistant' : msg.role
        const content = msg.message || ''
        const timestamp = msg.time_in_call_secs * 1000

        if (content.trim().length > 0) {
          formattedTranscript.push({
            role,
            content,
            timestamp
          })
        }
      }
    }

    const durationSeconds = conversationData.metadata?.call_duration_secs || 0
    const transcriptData = {
      success: true,
      conversationId: session.elevenlabs_conversation_id,
      transcript: {
        ...conversationData,
        messages: formattedTranscript
      },
      messageCount: formattedTranscript.length,
      durationSeconds: durationSeconds,
      fetchedAt: new Date().toISOString()
    }

    console.log(`✅ Retrieved and formatted transcript with ${formattedTranscript.length} messages`)

    // Use the formatted transcript messages
    const messages = formattedTranscript

    if (!messages || messages.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No transcript messages found'
      }, { status: 404 })
    }

    console.log(`⏱️ Session duration: ${durationSeconds} seconds`)

    // Update the session with the fresh transcript and duration
    const { error: updateError } = await supabaseAdmin
      .from('training_sessions')
      .update({
        conversation_transcript: messages,
        session_duration_seconds: durationSeconds
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('⚠️ Failed to update session with new transcript:', updateError)
    }

    // Run assessment on the transcript (direct integration to avoid API call issues)
    console.log('🧪 Running assessment directly...')
    let assessmentResult = null

    try {
      // Import OpenAI and necessary dependencies
      const OpenAI = (await import('openai')).default

      if (!process.env.OPENAI_API_KEY) {
        console.error('❌ OpenAI API key not configured')
        assessmentResult = {
          assessmentResults: [],
          summary: { totalQuestions: 0, correctAnswers: 0, score: 0 },
          message: 'Assessment unavailable - OpenAI API key not configured'
        }
      } else {
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        })

        // Load actual questions from database for matching
        console.log('📚 Loading questions from database for matching...')
        const { data: dbQuestions, error: questionsError } = await supabaseAdmin
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
          console.error('❌ Error loading questions:', questionsError)
        }

        console.log(`✅ Loaded ${dbQuestions?.length || 0} questions from database`)

        // Simple assessment using OpenAI directly
        const qaExchanges = []
        for (let i = 0; i < messages.length - 1; i++) {
          const current = messages[i]
          const next = messages[i + 1]

          if (current.role === 'assistant' && next.role === 'user' &&
              current.content.includes('?') && next.content.trim().length > 2) {
            qaExchanges.push({
              question: current.content.trim(),
              answer: next.content.trim()
            })
          }
        }

        console.log(`🔍 Found ${qaExchanges.length} Q&A exchanges for assessment`)

        if (qaExchanges.length > 0 && dbQuestions && dbQuestions.length > 0) {
          // Match each Q&A exchange to a database question and assess it
          const transformedAssessments = []

          for (const exchange of qaExchanges) {
            try {
              // Find matching question from database using AI
              console.log(`🔎 Matching question: "${exchange.question.substring(0, 50)}..."`)

              const matchPrompt = `Given this spoken question: "${exchange.question}"

Find the best matching question from this list:
${dbQuestions.map((q, i) => `${i + 1}. ${q.question_template}`).join('\n')}

Return only the number (1-${dbQuestions.length}) of the best match, or "0" if no good match.`

              const matchResponse = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: matchPrompt }],
                max_tokens: 10,
                temperature: 0
              })

              const matchNumber = parseInt(matchResponse.choices[0]?.message?.content?.trim() || '0')

              if (matchNumber > 0 && matchNumber <= dbQuestions.length) {
                const matchedQuestion = dbQuestions[matchNumber - 1]
                const topic = Array.isArray(matchedQuestion.knowledge_topics)
                  ? matchedQuestion.knowledge_topics[0]
                  : matchedQuestion.knowledge_topics

                console.log(`✅ Matched to: ${matchedQuestion.question_template.substring(0, 50)}...`)

                // Assess the answer using AI
                const assessPrompt = `Question: ${exchange.question}
User Answer: ${exchange.answer}
Correct Answer: ${matchedQuestion.correct_answer}

Evaluate if the user's answer is correct. Return JSON:
{
  "isCorrect": boolean,
  "score": 0-100,
  "feedback": "explanation"
}`

                const assessResponse = await openai.chat.completions.create({
                  model: 'gpt-4o-mini',
                  messages: [{ role: 'user', content: assessPrompt }],
                  response_format: { type: "json_object" },
                  temperature: 0.3
                })

                const assessment = JSON.parse(assessResponse.choices[0].message.content || '{}')

                const result = {
                  questionId: matchedQuestion.id, // Real UUID!
                  questionAsked: exchange.question,
                  userAnswer: exchange.answer,
                  correctAnswer: matchedQuestion.correct_answer,
                  isCorrect: assessment.isCorrect || false,
                  score: assessment.score || 0,
                  feedback: assessment.feedback || '',
                  topicName: topic.name,
                  topicCategory: topic.category,
                  difficultyLevel: matchedQuestion.difficulty_level
                }

                transformedAssessments.push(result)

                // Save to question_attempts table
                try {
                  const attemptData = {
                    user_id: session.employee_id,
                    topic_id: topic.id,
                    question_id: matchedQuestion.id,
                    question_asked: exchange.question,
                    user_answer: exchange.answer,
                    correct_answer: matchedQuestion.correct_answer,
                    is_correct: assessment.isCorrect || false,
                    points_earned: (assessment.isCorrect || false) ? 2 : 0,
                    time_spent_seconds: 30,
                    attempt_number: 1,
                    created_at: session.created_at
                  }

                  console.log(`💾 Saving attempt: ${matchedQuestion.id} - ${assessment.isCorrect ? 'CORRECT' : 'INCORRECT'}`)

                  const { error: insertError } = await supabaseAdmin
                    .from('question_attempts')
                    .insert(attemptData)

                  if (insertError) {
                    console.error(`❌ Failed to save attempt:`, insertError.message)
                  } else {
                    console.log(`✅ Attempt saved successfully`)
                  }
                } catch (saveError) {
                  console.error(`❌ Error saving attempt:`, saveError)
                }
              } else {
                console.log(`⚠️ No match found for question`)
              }
            } catch (matchError) {
              console.error(`❌ Error processing exchange:`, matchError)
            }
          }

          console.log(`📊 Processed ${transformedAssessments.length} / ${qaExchanges.length} Q&A exchanges`)

          // Calculate proper summary statistics from the transformed assessments
          const correctAnswers = transformedAssessments.filter(a => a.isCorrect).length
          const totalQuestions = transformedAssessments.length
          const averageScore = totalQuestions > 0
            ? Math.round(transformedAssessments.reduce((sum, a) => sum + a.score, 0) / totalQuestions)
            : 0
          const accuracy = totalQuestions > 0
            ? Math.round((correctAnswers / totalQuestions) * 100)
            : 0

          assessmentResult = {
            assessmentResults: transformedAssessments,
            summary: {
              totalQuestions,
              correctAnswers,
              incorrectAnswers: totalQuestions - correctAnswers,
              averageScore,
              accuracy,
              score: averageScore  // Add this for UI compatibility
            }
          }
          console.log('✅ Assessment completed with database matching')
        } else {
          assessmentResult = {
            assessmentResults: [],
            summary: { totalQuestions: 0, correctAnswers: 0, averageScore: 0, accuracy: 0 },
            message: 'No Q&A exchanges found for assessment'
          }
        }
      }
    } catch (assessmentError: any) {
      console.error('❌ Assessment error:', assessmentError.message)
      assessmentResult = {
        assessmentResults: [],
        summary: { totalQuestions: 0, correctAnswers: 0, averageScore: 0, accuracy: 0 },
        message: `Assessment failed: ${assessmentError.message}`
      }
    }

    // Analyze Q&A pairs
    let qaPairs = 0
    let userMessages = 0
    let assistantMessages = 0

    for (let i = 0; i < messages.length - 1; i++) {
      const current = messages[i]
      const next = messages[i + 1]

      if (current.role === 'user') userMessages++
      if (current.role === 'assistant') assistantMessages++

      if (current.role === 'assistant' && next.role === 'user' && next.content.trim().length > 10) {
        qaPairs++
      }
    }

    // Prepare assessment results for caching
    const assessmentResultsForCache = {
      ...assessmentResult,
      processedExchanges: qaPairs,
      analyzedAt: new Date().toISOString()
    }

    // Cache assessment results in database (with graceful failure)
    try {
      // Assessment is considered successful if we have assessment results
      const assessmentStatus = (assessmentResult && assessmentResult.assessmentResults && assessmentResult.assessmentResults.length > 0) ? 'completed' : 'failed'
      console.log(`💾 Saving assessment with status: ${assessmentStatus}`)
      console.log(`💾 Assessment has ${assessmentResult?.assessmentResults?.length || 0} results`)

      const { error: cacheError } = await supabaseAdmin
        .from('training_sessions')
        .update({
          theory_assessment_results: assessmentResultsForCache,
          assessment_completed_at: new Date().toISOString(),
          assessment_status: assessmentStatus
        })
        .eq('id', sessionId)

      if (cacheError) {
        console.error('⚠️ Failed to cache assessment results (columns may not exist yet):', cacheError)
        // Continue execution - caching is optional until migration is run
      } else {
        console.log(`✅ Assessment results cached successfully for session ${sessionId}`)
      }
    } catch (cacheError) {
      console.error('⚠️ Failed to cache assessment results:', cacheError)
      // Continue execution - caching is optional
    }

    return NextResponse.json({
      success: true,
      sessionId,
      transcriptAnalysis: {
        totalMessages: messages.length,
        userMessages,
        assistantMessages,
        qaPairsFound: qaPairs,
        transcript: messages
      },
      assessment: assessmentResultsForCache,
      fromCache: false,
      analyzedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error in session transcript analysis:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}