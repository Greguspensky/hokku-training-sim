'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AssignmentWithDetails } from '@/lib/track-assignments'
import { KnowledgeBaseDocument } from '@/lib/knowledge-base'
import { useAuth } from '@/contexts/AuthContext'
import UserHeader from '@/components/UserHeader'
import { ElevenLabsAvatarSession } from '@/components/ElevenLabsAvatarSession'
import { RecommendationTTSSession } from '@/components/RecommendationTTSSession'
import TheoryPracticeSession from '@/components/TheoryPracticeSession'
import { SUPPORTED_LANGUAGES, SupportedLanguageCode } from '@/lib/avatar-types'
import { RecordingConsent } from '@/components/RecordingConsent'
import type { RecordingPreference } from '@/lib/training-sessions'
import Link from 'next/link'

interface TrainingQuestion {
  id: string
  question: string
  options?: string[]
  correctAnswer: string
  explanation: string
  type: 'multiple_choice' | 'open_ended'
}

export default function TrainingSessionPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const assignmentId = params.assignmentId as string

  const [assignment, setAssignment] = useState<AssignmentWithDetails | null>(null)
  const [knowledgeDocuments, setKnowledgeDocuments] = useState<KnowledgeBaseDocument[]>([])
  const [currentScenarioIndex, setCurrentScenarioIndex] = useState(0)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [questions, setQuestions] = useState<TrainingQuestion[]>([])
  const [userAnswer, setUserAnswer] = useState('')
  const [showExplanation, setShowExplanation] = useState(false)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<{[key: string]: string}>({})
  const [scores, setScores] = useState<{[key: string]: boolean}>({})
  const [isAvatarMode, setIsAvatarMode] = useState(false)
  const [isTheoryPracticeMode, setIsTheoryPracticeMode] = useState(false)
  const [currentScenario, setCurrentScenario] = useState<any>(null)
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguageCode>('en')
  const [recordingPreference, setRecordingPreference] = useState<RecordingPreference>('none')
  const [showRecordingConsent, setShowRecordingConsent] = useState(true)
  const [showAvatarSession, setShowAvatarSession] = useState(false)
  const [sessionData, setSessionData] = useState<any>(null)
  const [isAnalyzingTranscript, setIsAnalyzingTranscript] = useState(false)
  const [transcriptAnalysis, setTranscriptAnalysis] = useState<any>(null)
  const [scenarioQuestions, setScenarioQuestions] = useState<any[]>([])
  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [recommendationQuestions, setRecommendationQuestions] = useState<any[]>([])
  const [recommendationQuestionsLoading, setRecommendationQuestionsLoading] = useState(false)
  const [preAuthorizedTabAudio, setPreAuthorizedTabAudio] = useState<MediaStream | null>(null)

  useEffect(() => {
    loadTrainingData()
  }, [assignmentId, user])

  // Auto-set recording preference for recommendations scenarios
  useEffect(() => {
    if (currentScenario?.scenario_type === 'recommendations') {
      setRecordingPreference('audio_video')
    }
  }, [currentScenario])

  const loadTrainingData = async () => {
    if (!user) return

    try {
      // Check URL parameters for theory practice mode and scenario-specific routing
      const urlParams = new URLSearchParams(window.location.search)
      const practiceMode = urlParams.get('mode') === 'theory-practice'
      const scenarioId = urlParams.get('scenario')

      if (practiceMode) {
        // Theory practice mode - use the special assignment ID for practice
        setIsTheoryPracticeMode(true)
        console.log('🎯 Theory practice mode activated')
        setLoading(false)
        return
      }

      // Load assignment details
      const assignmentResponse = await fetch(`/api/track-assignments-standalone/${assignmentId}`)
      const assignmentData = await assignmentResponse.json()

      if (assignmentData.success) {
        setAssignment(assignmentData.assignment)

        // Load knowledge base documents for the company
        const kbResponse = await fetch(`/api/knowledge-base/documents?company_id=${user.company_id || '01f773e2-1027-490e-8d36-279136700bbf'}`)
        const kbData = await kbResponse.json()

        if (kbData.success) {
          setKnowledgeDocuments(kbData.documents)
        }

        // Handle scenario-specific routing
        if (scenarioId) {
          // Find the specific scenario requested
          const selectedScenario = assignmentData.assignment.track.scenarios?.find(
            (scenario: any) => scenario.id === scenarioId
          )

          if (selectedScenario) {
            // Always use avatar mode for specific scenario selection
            setCurrentScenario(selectedScenario)
            setIsAvatarMode(true)
            console.log(`🎭 Avatar mode activated for ${selectedScenario.scenario_type} scenario:`, selectedScenario.title)

            // Load scenario questions if it's a theory scenario
            if (selectedScenario.scenario_type === 'theory') {
              loadScenarioQuestions(selectedScenario.id, user?.id)
            }

            // Load recommendation questions if it's a recommendations scenario
            if (selectedScenario.scenario_type === 'recommendations' && selectedScenario.recommendation_question_ids?.length > 0) {
              loadRecommendationQuestions(selectedScenario.recommendation_question_ids)
            }
          } else {
            console.error('❌ Scenario not found:', scenarioId)
            // Fall back to default behavior
            const firstScenario = assignmentData.assignment.track.scenarios?.[0]
            if (firstScenario) {
              setCurrentScenario(firstScenario)
              setIsAvatarMode(true)
            }
          }
        } else {
          // Default behavior: Always use avatar mode for ALL scenario types
          const firstScenario = assignmentData.assignment.track.scenarios?.[0]

          if (firstScenario) {
            // Always use avatar mode for all scenarios (both theory and service_practice)
            setCurrentScenario(firstScenario)
            setIsAvatarMode(true)
            console.log(`🎭 Avatar mode activated for ${firstScenario.scenario_type} scenario:`, firstScenario.title)

            // Load scenario questions if it's a theory scenario
            if (firstScenario.scenario_type === 'theory') {
              loadScenarioQuestions(firstScenario.id, user?.id)
            }

            // Load recommendation questions if it's a recommendations scenario
            if (firstScenario.scenario_type === 'recommendations' && firstScenario.recommendation_question_ids?.length > 0) {
              loadRecommendationQuestions(firstScenario.recommendation_question_ids)
            }
          } else {
            console.error('❌ No scenarios found in assignment')
          }
        }
      }
    } catch (error) {
      console.error('Failed to load training data:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateTrainingQuestions = async (assignment: AssignmentWithDetails, documents: KnowledgeBaseDocument[]) => {
    const generatedQuestions: TrainingQuestion[] = []

    // Generate questions for each scenario
    for (const [scenarioIndex, scenario] of (assignment.track.scenarios || []).entries()) {
      if (scenario.scenario_type === 'theory') {
        // Use AI to generate theory questions based on knowledge base documents
        try {
          // Determine which documents to use for this scenario
          let scenarioDocuments = documents

          // If scenario has specific knowledge base associations, use those
          if (scenario.knowledge_document_ids && scenario.knowledge_document_ids.length > 0) {
            scenarioDocuments = documents.filter(doc =>
              scenario.knowledge_document_ids?.includes(doc.id)
            )
          } else if (scenario.knowledge_category_ids && scenario.knowledge_category_ids.length > 0) {
            scenarioDocuments = documents.filter(doc =>
              scenario.knowledge_category_ids?.includes(doc.category_id)
            )
          }

          if (scenarioDocuments.length > 0) {
            // Generate AI questions using the API
            const response = await fetch('/api/ai/generate-questions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                company_id: user?.company_id || '01f773e2-1027-490e-8d36-279136700bbf',
                document_ids: scenarioDocuments.map(doc => doc.id),
                question_count: 2,
                difficulty: scenario.difficulty || 'beginner',
                question_type: 'mixed'
              })
            })

            if (response.ok) {
              const data = await response.json()
              if (data.success && data.questions) {
                // Convert AI questions to training questions format
                data.questions.forEach((aiQuestion: any, qIndex: number) => {
                  generatedQuestions.push({
                    id: `ai_theory_${scenarioIndex}_${qIndex}`,
                    question: aiQuestion.question,
                    options: aiQuestion.options,
                    type: aiQuestion.type,
                    correctAnswer: aiQuestion.correctAnswer,
                    explanation: aiQuestion.explanation
                  })
                })
              }
            }
          }

          // Fallback to default question if AI generation fails
          if (generatedQuestions.filter(q => q.id.includes(`theory_${scenarioIndex}`)).length === 0) {
            generatedQuestions.push({
              id: `theory_${scenarioIndex}_default`,
              question: 'What is the most important aspect of customer service?',
              options: ['Being fast', 'Being friendly and helpful', 'Being quiet', 'Being expensive'],
              type: 'multiple_choice',
              correctAnswer: 'Being friendly and helpful',
              explanation: 'Customer service is fundamentally about being friendly, helpful, and ensuring customer satisfaction.'
            })
          }
        } catch (error) {
          console.error('Error generating AI questions:', error)

          // Fallback to default question
          generatedQuestions.push({
            id: `theory_${scenarioIndex}_fallback`,
            question: 'What is the most important aspect of customer service?',
            options: ['Being fast', 'Being friendly and helpful', 'Being quiet', 'Being expensive'],
            type: 'multiple_choice',
            correctAnswer: 'Being friendly and helpful',
            explanation: 'Customer service is fundamentally about being friendly, helpful, and ensuring customer satisfaction.'
          })
        }
      } else {
        // Service practice scenario
        generatedQuestions.push({
          id: `practice_${scenarioIndex}_1`,
          question: `How would you handle this situation: ${scenario.client_behavior}`,
          type: 'open_ended',
          correctAnswer: scenario.expected_response,
          explanation: `Expected approach: ${scenario.expected_response}`
        })
      }
    }

    setQuestions(generatedQuestions)
  }

  const handleAnswerSubmit = () => {
    const currentQuestion = questions[currentQuestionIndex]

    // Calculate factual score (binary: correct = true, incorrect = false)
    let isCorrect = false

    if (currentQuestion.type === 'multiple_choice') {
      // Exact match for multiple choice
      isCorrect = userAnswer.trim() === currentQuestion.correctAnswer.trim()
    } else {
      // For open-ended, check if answer contains key factual elements
      const userAnswerLower = userAnswer.toLowerCase().trim()
      const correctAnswerLower = currentQuestion.correctAnswer.toLowerCase().trim()

      // Simple keyword matching for factual accuracy
      // This could be enhanced with more sophisticated NLP
      isCorrect = userAnswerLower.includes(correctAnswerLower) ||
                 correctAnswerLower.includes(userAnswerLower)
    }

    // Store answer and score
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: userAnswer
    }))

    setScores(prev => ({
      ...prev,
      [currentQuestion.id]: isCorrect
    }))

    setShowExplanation(true)
  }

  const handleNextQuestion = () => {
    setShowExplanation(false)
    setUserAnswer('')

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    } else {
      setSessionComplete(true)
      updateProgress()
    }
  }

  const updateProgress = async () => {
    try {
      // Calculate factual score: number of correct answers / total questions
      const correctAnswers = Object.values(scores).filter(score => score).length
      const factualScore = Math.round((correctAnswers / questions.length) * 100)

      await fetch(`/api/track-assignments/${assignmentId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario_id: assignment?.track.scenarios?.[currentScenarioIndex]?.id,
          status: 'completed',
          score: factualScore
        })
      })
    } catch (error) {
      console.error('Failed to update progress:', error)
    }
  }

  const loadScenarioQuestions = async (scenarioId: string, employeeId?: string) => {
    setQuestionsLoading(true)

    try {
      const params = new URLSearchParams({
        scenario_id: scenarioId,
        limit: '8'
      })

      if (employeeId) {
        params.append('employee_id', employeeId)
      }

      const response = await fetch(`/api/scenario-questions?${params}`)
      const result = await response.json()

      if (result.success) {
        setScenarioQuestions(result.questions || [])
        console.log(`✅ Loaded ${result.questions?.length || 0} questions for scenario:`, scenarioId)

        if (result.statusBreakdown) {
          console.log('📊 Question status breakdown:', result.statusBreakdown)
        }
      } else {
        console.error('❌ Failed to load scenario questions:', result.error)
        setScenarioQuestions([])
      }
    } catch (error) {
      console.error('❌ Error loading scenario questions:', error)
      setScenarioQuestions([])
    } finally {
      setQuestionsLoading(false)
    }
  }

  const loadRecommendationQuestions = async (questionIds: string[]) => {
    setRecommendationQuestionsLoading(true)

    try {
      const response = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_ids: questionIds })
      })

      const result = await response.json()

      if (result.success) {
        setRecommendationQuestions(result.questions || [])
        console.log(`✅ Loaded ${result.questions?.length || 0} recommendation questions`)
      } else {
        console.error('❌ Failed to load recommendation questions:', result.error)
        setRecommendationQuestions([])
      }
    } catch (error) {
      console.error('❌ Error loading recommendation questions:', error)
      setRecommendationQuestions([])
    } finally {
      setRecommendationQuestionsLoading(false)
    }
  }

  /**
   * Pre-authorize tab audio capture for Safari compatibility
   * This must be called from a direct user gesture (button click)
   */
  const handleStartSessionWithPreAuth = async () => {
    console.log('🚀 Starting session with pre-authorization approach')

    // Only try to pre-auth tab audio if video recording is enabled
    if (recordingPreference === 'audio_video') {
      try {
        console.log('🔊 Pre-authorizing tab audio capture (Safari-compatible)...')
        const tabAudioStream = await navigator.mediaDevices.getDisplayMedia({
          video: false,
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            suppressLocalAudioPlayback: false
          }
        } as any)

        if (tabAudioStream.getAudioTracks().length > 0) {
          console.log('✅ Tab audio pre-authorized successfully!')
          console.log('💡 This stream will be reused when recording starts')
          setPreAuthorizedTabAudio(tabAudioStream)
        } else {
          console.warn('⚠️ No audio tracks in pre-authorized stream')
        }
      } catch (error) {
        console.warn('⚠️ Tab audio pre-authorization failed:', error)
        console.log('💡 Will continue without tab audio (microphone only)')
        // Don't block - continue without tab audio
      }
    }

    // Start the session
    setShowRecordingConsent(false)
    setShowAvatarSession(true)
  }

  const handleGetTranscriptAnalysis = async () => {
    if (!sessionData?.sessionId) {
      alert('No session data available for analysis')
      return
    }

    setIsAnalyzingTranscript(true)

    try {
      const response = await fetch('/api/session-transcript-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionData.sessionId
        })
      })

      const result = await response.json()

      if (result.success) {
        setTranscriptAnalysis(result)
        console.log('✅ Transcript analysis completed:', result)
      } else {
        console.error('❌ Transcript analysis failed:', result.error)
        alert(`Failed to analyze transcript: ${result.error}`)
      }
    } catch (error) {
      console.error('❌ Error fetching transcript analysis:', error)
      alert('Failed to fetch transcript analysis')
    } finally {
      setIsAnalyzingTranscript(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading training session...</p>
        </div>
      </div>
    )
  }

  if (!assignment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Training Assignment Not Found</h1>
          <p className="text-gray-600 mb-4">The training assignment you're looking for doesn't exist.</p>
          <Link href="/employee" className="text-blue-600 hover:text-blue-700">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (sessionComplete) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <UserHeader
            title="Training Complete!"
            subtitle={`You've completed: ${assignment.track.name}`}
          />

          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-4">Congratulations!</h2>
            <p className="text-gray-600 mb-6">
              You've successfully completed the training session. Your progress has been recorded.
            </p>

            {/* Session Statistics */}
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              {sessionData?.sessionType === 'recommendation_tts' ? (
                // TTS Recommendation Session Stats - No scoring, just question count
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{sessionData.questionsCompleted || 0}</div>
                  <div className="text-lg text-gray-600">Questions Completed</div>
                  <p className="text-sm text-gray-500 mt-2">
                    Recommendation training focuses on practical skills - no right or wrong answers
                  </p>
                  {sessionData.savedSessionId && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Session ID for debugging:</p>
                      <p className="text-sm font-mono text-gray-700">{sessionData.savedSessionId}</p>
                    </div>
                  )}
                </div>
              ) : (
                // Theory Session Stats - Traditional scoring
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{questions.length}</div>
                    <div className="text-sm text-gray-600">Questions Answered</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {Object.values(scores).filter(score => score).length}
                    </div>
                    <div className="text-sm text-gray-600">Correct Answers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {Object.values(scores).filter(score => !score).length}
                    </div>
                    <div className="text-sm text-gray-600">Factual Errors</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {Math.round((Object.values(scores).filter(score => score).length / questions.length) * 100)}%
                    </div>
                    <div className="text-sm text-gray-600">Factual Score</div>
                  </div>
                </div>
              )}
            </div>

            {/* Transcript Analysis Results */}
            {transcriptAnalysis && (
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Transcript Analysis Results</h3>

                {/* Transcript Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="text-center bg-white rounded-lg p-4">
                    <div className="text-2xl font-bold text-blue-600">
                      {transcriptAnalysis.transcriptAnalysis?.totalMessages || 0}
                    </div>
                    <div className="text-sm text-gray-600">Total Messages</div>
                  </div>
                  <div className="text-center bg-white rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-600">
                      {transcriptAnalysis.transcriptAnalysis?.qaPairsFound || 0}
                    </div>
                    <div className="text-sm text-gray-600">Q&A Pairs Found</div>
                  </div>
                  <div className="text-center bg-white rounded-lg p-4">
                    <div className="text-2xl font-bold text-purple-600">
                      {transcriptAnalysis.assessment?.summary?.score || 0}%
                    </div>
                    <div className="text-sm text-gray-600">Assessment Score</div>
                  </div>
                </div>

                {/* Assessment Details */}
                {transcriptAnalysis.assessment?.success && (
                  <div className="bg-white rounded-lg p-4 mb-4">
                    <h4 className="font-semibold text-gray-900 mb-3">🎯 Assessment Results</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Total Questions:</span> {transcriptAnalysis.assessment.summary?.totalQuestions || 0}
                      </div>
                      <div>
                        <span className="font-medium">Correct Answers:</span> {transcriptAnalysis.assessment.summary?.correctAnswers || 0}
                      </div>
                      <div>
                        <span className="font-medium">Success Rate:</span> {Math.round(((transcriptAnalysis.assessment.summary?.correctAnswers || 0) / Math.max(transcriptAnalysis.assessment.summary?.totalQuestions || 1, 1)) * 100)}%
                      </div>
                    </div>
                  </div>
                )}

                {/* User/Assistant Message Breakdown */}
                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">💬 Conversation Breakdown</h4>
                  <div className="flex justify-between text-sm">
                    <span>👤 Your messages: <strong>{transcriptAnalysis.transcriptAnalysis?.userMessages || 0}</strong></span>
                    <span>🤖 AI Trainer messages: <strong>{transcriptAnalysis.transcriptAnalysis?.assistantMessages || 0}</strong></span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {/* Only show transcript analysis for non-TTS sessions */}
              {sessionData && sessionData.sessionType !== 'recommendation_tts' && !transcriptAnalysis && (
                <button
                  onClick={handleGetTranscriptAnalysis}
                  disabled={isAnalyzingTranscript}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isAnalyzingTranscript ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Analyzing Transcript...
                    </>
                  ) : (
                    <>
                      📊 Get Transcript & Analysis
                    </>
                  )}
                </button>
              )}

              <Link
                href="/employee"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // If theory practice mode is enabled, render TheoryPracticeSession component
  if (isTheoryPracticeMode) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <UserHeader
            title="Theory Practice Session"
            subtitle="Practice questions that need work"
          />

          <TheoryPracticeSession
            userId={user?.id}
            assignmentId={assignmentId}
            onSessionComplete={() => {
              console.log('✅ Theory practice session completed')
              router.push('/employee')
            }}
          />
        </div>
      </div>
    )
  }

  // If avatar mode is enabled, render unified single-screen interface
  if (isAvatarMode && currentScenario) {
    // Use the company ID to get the appropriate agent
    const companyId = assignment.company_id || '01f773e2-1027-490e-8d36-279136700bbf' // Default to demo company

    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          {/* Header */}
          <div className="mb-8">
            <UserHeader />
          </div>

          {/* Unified Configuration and Session Interface */}
          <div className="space-y-8">
            {/* Configuration Section */}
            {showRecordingConsent && (
              <div className="bg-white rounded-lg shadow-lg p-8">
                {/* Session Configuration Header */}
                <div className="mb-8">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    {currentScenario.scenario_type === 'theory'
                      ? '📖 Theory Q&A Session'
                      : currentScenario.scenario_type === 'recommendations'
                      ? '🎯 Product Recommendations Session'
                      : '🗣️ Service Practice Session'
                    }
                  </h1>
                  <p className="text-gray-600">
                    {currentScenario.scenario_type === 'theory'
                      ? 'Structured knowledge assessment - Answer questions accurately and concisely'
                      : currentScenario.scenario_type === 'recommendations'
                      ? 'Product recommendation training - Learn to suggest appropriate products and services'
                      : 'Interactive roleplay scenario - Practice real customer service situations'
                    }
                  </p>
                </div>

                {/* Session Configuration */}
                <div className="space-y-8">
                  {/* Training Mode Display */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-2">⚙️ Session Configuration</h3>
                    <div className="text-gray-700 text-sm space-y-1">
                      <p><strong>Training Mode:</strong>
                        {currentScenario.scenario_type === 'theory'
                          ? '📖 Theory Assessment'
                          : currentScenario.scenario_type === 'recommendations'
                          ? '🎯 Product Recommendations'
                          : '🗣️ Service Practice'
                        }
                      </p>
                      <p><strong>Scenario:</strong> {currentScenario.title}</p>
                      <p><strong>Company:</strong> {companyId}</p>
                    </div>
                  </div>

                  {/* ElevenLabs Settings Preview */}
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-4">🤖 ElevenLabs AI Agent Settings</h3>
                    <div className="text-sm space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <p className="font-medium text-gray-900 mb-2">🎭 Character Role</p>
                          <p className="text-gray-600">
                            {currentScenario.scenario_type === 'theory' ? (
                              scenarioQuestions.length > 0 ? (
                                <>
                                  <strong>Strict Theory Examiner</strong> - Will ask {scenarioQuestions.length} specific questions about {currentScenario.title}.
                                  Questions prioritized as: unanswered → incorrect → correct answers.
                                </>
                              ) : (
                                'Strict Theory Examiner - Will ask knowledge-based questions'
                              )
                            ) : currentScenario.scenario_type === 'recommendations' ? (
                              <>
                                <strong>Product Recommendation Specialist</strong> - Will engage in interactive training focused on product recommendations.
                                {currentScenario.recommendation_question_ids?.length > 0 && (
                                  <> Covers {currentScenario.recommendation_question_ids.length} specific recommendation scenarios.</>
                                )}
                              </>
                            ) : (
                              'Customer in Roleplay - Will act according to scenario behavior'
                            )}
                          </p>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <p className="font-medium text-gray-900 mb-2">📋 Scenario Context</p>
                          {currentScenario.scenario_type === 'theory' ? (
                            <div className="space-y-2">
                              {questionsLoading ? (
                                <div className="text-xs text-gray-500 flex items-center">
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                                  Loading questions...
                                </div>
                              ) : scenarioQuestions.length > 0 ? (
                                <div>
                                  <p className="text-gray-600 text-xs mb-2">
                                    Will ask {scenarioQuestions.length} questions from this scenario:
                                  </p>
                                  <div className="max-h-32 overflow-y-auto space-y-1">
                                    {scenarioQuestions.slice(0, 5).map((question, index) => (
                                      <div key={question.id} className="text-xs">
                                        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                                          question.status === 'unanswered' ? 'bg-gray-400' :
                                          question.status === 'incorrect' ? 'bg-red-400' : 'bg-green-400'
                                        }`}></span>
                                        <span className="text-gray-700">
                                          {index + 1}. {question.question.substring(0, 60)}
                                          {question.question.length > 60 ? '...' : ''}
                                        </span>
                                      </div>
                                    ))}
                                    {scenarioQuestions.length > 5 && (
                                      <p className="text-xs text-gray-500 italic">
                                        + {scenarioQuestions.length - 5} more questions
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-gray-600 text-xs">
                                  Will ask questions based on company knowledge base
                                </p>
                              )}
                            </div>
                          ) : currentScenario.scenario_type === 'recommendations' ? (
                            <div className="space-y-2">
                              <p className="text-gray-600 text-xs">
                                <strong>Training Focus:</strong> {currentScenario.title}
                              </p>
                              {currentScenario.instructions && (
                                <p className="text-gray-600 text-xs">
                                  <strong>Instructions:</strong> {currentScenario.instructions}
                                </p>
                              )}
                              {recommendationQuestionsLoading ? (
                                <div className="flex items-center space-x-2">
                                  <div className="animate-spin rounded-full h-3 w-3 border-b border-purple-500"></div>
                                  <span className="text-gray-600 text-xs">Loading recommendation questions...</span>
                                </div>
                              ) : recommendationQuestions.length > 0 ? (
                                <div>
                                  <p className="text-gray-600 text-xs mb-2">
                                    Will cover {recommendationQuestions.length} specific recommendation questions:
                                  </p>
                                  <div className="max-h-32 overflow-y-auto space-y-1">
                                    {recommendationQuestions.slice(0, 3).map((question, index) => (
                                      <div key={question.id} className="text-xs">
                                        <span className="inline-block w-2 h-2 rounded-full mr-2 bg-purple-400"></span>
                                        <span className="text-gray-700">
                                          {index + 1}. {question.question_text?.slice(0, 60) || question.title?.slice(0, 60) || 'Question'}
                                          {((question.question_text?.length || 0) > 60 || (question.title?.length || 0) > 60) && '...'}
                                        </span>
                                      </div>
                                    ))}
                                    {recommendationQuestions.length > 3 && (
                                      <p className="text-xs text-gray-500 italic">
                                        + {recommendationQuestions.length - 3} more questions
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ) : currentScenario.recommendation_question_ids && currentScenario.recommendation_question_ids.length > 0 ? (
                                <div>
                                  <p className="text-gray-600 text-xs mb-2">
                                    Will cover {currentScenario.recommendation_question_ids.length} specific recommendation scenarios:
                                  </p>
                                  <div className="max-h-32 overflow-y-auto space-y-1">
                                    {currentScenario.recommendation_question_ids.slice(0, 3).map((questionId, index) => (
                                      <div key={questionId} className="text-xs">
                                        <span className="inline-block w-2 h-2 rounded-full mr-2 bg-purple-400"></span>
                                        <span className="text-gray-700">
                                          {index + 1}. Recommendation scenario #{questionId.slice(-8)}
                                        </span>
                                      </div>
                                    ))}
                                    {currentScenario.recommendation_question_ids.length > 3 && (
                                      <p className="text-xs text-gray-500 italic">
                                        + {currentScenario.recommendation_question_ids.length - 3} more scenarios
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-gray-600 text-xs">
                                  Interactive product recommendation training session with AI specialist
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-gray-600 text-xs">
                              {currentScenario.title}
                            </p>
                          )}
                        </div>
                      </div>

                      {currentScenario.scenario_type === 'service_practice' && (
                        <>
                          <div className="bg-white rounded-lg p-4 border border-gray-200">
                            <p className="font-medium text-gray-900 mb-2">😤 Customer Behavior</p>
                            <p className="text-gray-600 text-xs max-h-20 overflow-y-auto">
                              {currentScenario.client_behavior || 'Act as typical customer seeking help'}
                            </p>
                          </div>
                          <div className="bg-white rounded-lg p-4 border border-gray-200">
                            <p className="font-medium text-gray-900 mb-2">✅ Expected Employee Response</p>
                            <p className="text-gray-600 text-xs max-h-20 overflow-y-auto">
                              {currentScenario.expected_response || 'Employee should be helpful and knowledgeable'}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Language Selection */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">🌍 Language Selection</h3>
                    <p className="text-gray-600 mb-4">
                      Choose the language for your conversation with the AI trainer. The agent will respond in the selected language.
                    </p>

                    <div className="relative inline-block text-left w-full max-w-xs">
                      <select
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value as SupportedLanguageCode)}
                        className="block w-full px-4 py-3 pr-10 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white appearance-none cursor-pointer"
                      >
                        {SUPPORTED_LANGUAGES.map((language) => (
                          <option key={language.code} value={language.code}>
                            {language.flag} {language.name}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">
                        <strong>Selected:</strong> {SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage)?.flag} {SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage)?.name}
                      </p>
                    </div>
                  </div>

                  {/* Recording Preferences - Simplified Dropdown */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">🎥 Session Recording</h3>
                    <p className="text-gray-600 mb-4">
                      {currentScenario?.scenario_type === 'recommendations'
                        ? 'This recommendation training requires video recording to capture your responses to spoken questions.'
                        : 'Choose your recording preference for this training session.'
                      }
                    </p>

                    <div className="relative inline-block text-left w-full max-w-xs">
                      <select
                        value={recordingPreference}
                        onChange={(e) => setRecordingPreference(e.target.value as RecordingPreference)}
                        className="block w-full px-4 py-3 pr-10 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white appearance-none cursor-pointer"
                        disabled={currentScenario?.scenario_type === 'recommendations'}
                      >
                        {currentScenario?.scenario_type === 'recommendations' ? (
                          <option value="audio_video">🎬 Video Recording (Required)</option>
                        ) : (
                          <>
                            <option value="none">🚫 No Recording</option>
                            <option value="audio">🎤 Audio Recording</option>
                            <option value="audio_video">🎬 Audio + Video Recording</option>
                          </>
                        )}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">
                        {recordingPreference === 'none' && (
                          <><strong>Selected:</strong> 🚫 No Recording - Only text transcript will be saved</>
                        )}
                        {recordingPreference === 'audio' && (
                          <><strong>Selected:</strong> 🎤 Audio Recording - Your voice will be captured for review</>
                        )}
                        {recordingPreference === 'audio_video' && (
                          <><strong>Selected:</strong> 🎬 Audio + Video Recording - Full session recording for detailed analysis</>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Privacy Notice */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h4 className="text-sm font-medium text-blue-900">Data Security & Privacy</h4>
                        <div className="mt-1 text-sm text-blue-800">
                          All recordings are stored securely and are only accessible by you and authorized training managers. You can request deletion of your recordings at any time.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Start Session Button */}
                <div className="mt-8 text-center">
                  <button
                    onClick={handleStartSessionWithPreAuth}
                    className="inline-flex items-center px-8 py-4 text-lg font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-lg transform transition hover:scale-105"
                  >
                    🚀 Start Training Session
                  </button>
                </div>
              </div>
            )}

            {/* Question Preview Section for Theory Sessions */}
            {showAvatarSession && currentScenario.scenario_type === 'theory' && scenarioQuestions.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 Question Preview</h3>
                <p className="text-gray-600 text-sm mb-4">
                  Here are the questions the AI trainer will ask you during this session, prioritized by your learning needs:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {scenarioQuestions.map((question, index) => (
                    <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start space-x-2">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                          question.status === 'unanswered' ? 'bg-gray-100 text-gray-600' :
                          question.status === 'incorrect' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                        }`}>
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 mb-1">
                            {question.question}
                          </p>
                          <div className="flex items-center space-x-2 text-xs">
                            <span className={`px-2 py-1 rounded-full ${
                              question.status === 'unanswered' ? 'bg-gray-100 text-gray-700' :
                              question.status === 'incorrect' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {question.status === 'unanswered' ? 'New' :
                               question.status === 'incorrect' ? 'Needs Practice' : 'Mastered'}
                            </span>
                            <span className="text-gray-500">
                              {question.topic.name}
                            </span>
                            <span className="text-gray-500">
                              Level {question.difficultyLevel}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-blue-900">Smart Question Ordering</h4>
                      <div className="mt-1 text-sm text-blue-800">
                        Questions are ordered by priority: <strong>New questions</strong> first, then <strong>questions you got wrong</strong>,
                        and finally <strong>questions you've mastered</strong>. This helps you focus on areas that need the most attention.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Training Sessions - Conditional Rendering */}
            {showAvatarSession && currentScenario.scenario_type === 'recommendations' && (
              <div className="bg-white rounded-lg shadow-lg">
                <RecommendationTTSSession
                  companyId={companyId}
                  scenarioId={currentScenario.id}
                  scenario={currentScenario}
                  questions={recommendationQuestions}
                  language={selectedLanguage}
                  assignmentId={assignmentId}
                  onSessionEnd={(completedSessionData) => {
                    console.log('✅ TTS recommendation session completed:', completedSessionData)
                    setSessionData(completedSessionData)
                    updateProgress()
                    setSessionComplete(true)
                  }}
                />
              </div>
            )}

            {/* Avatar Session - For Theory and Service Practice */}
            {showAvatarSession && currentScenario.scenario_type !== 'recommendations' && (
              <div className="bg-white rounded-lg shadow-lg">
                <ElevenLabsAvatarSession
                  companyId={companyId}
                  scenarioId={currentScenario.id}
                  scenarioContext={{
                    title: currentScenario.title,
                    type: currentScenario.scenario_type,
                    client_behavior: currentScenario.client_behavior,
                    expected_response: currentScenario.expected_response
                  }}
                  scenarioQuestions={scenarioQuestions}
                  language={selectedLanguage}
                  agentId="agent_9301k5efjt1sf81vhzc3pjmw0fy9"
                  recordingPreference={recordingPreference}
                  preAuthorizedTabAudio={preAuthorizedTabAudio}
                  onSessionEnd={(completedSessionData) => {
                    console.log('✅ Avatar session completed:', completedSessionData)
                    setSessionData(completedSessionData)
                    updateProgress()
                    setSessionComplete(true)
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">No Training Questions Available</h1>
          <p className="text-gray-600 mb-4">Unable to generate training questions for this assignment.</p>
          <Link href="/employee" className="text-blue-600 hover:text-blue-700">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <UserHeader
          title={assignment.track.name}
          subtitle={`Training Session - Question ${currentQuestionIndex + 1} of ${questions.length}`}
        />

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span>{Math.round(((currentQuestionIndex) / questions.length) * 100)}% Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestionIndex) / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Training Question Card */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            {currentQuestion.question}
          </h2>

          {currentQuestion.type === 'multiple_choice' ? (
            <div className="space-y-3 mb-6">
              {currentQuestion.options?.map((option, index) => (
                <label key={index} className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="answer"
                    value={option}
                    checked={userAnswer === option}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-3 text-gray-900">{option}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="mb-6">
              <textarea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Type your answer here..."
                className="w-full p-4 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                rows={4}
              />
            </div>
          )}

          {showExplanation && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-blue-900 mb-2">Explanation:</h3>
              <p className="text-blue-800">{currentQuestion.explanation}</p>
              {currentQuestion.type === 'multiple_choice' && (
                <p className="text-blue-800 mt-2">
                  <strong>Correct Answer:</strong> {currentQuestion.correctAnswer}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-between">
            <Link
              href="/employee"
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Exit Training
            </Link>

            {!showExplanation ? (
              <button
                onClick={handleAnswerSubmit}
                disabled={!userAnswer.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Submit Answer
              </button>
            ) : (
              <button
                onClick={handleNextQuestion}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Complete Training'}
              </button>
            )}
          </div>
        </div>

        {/* Knowledge Base Reference */}
        {knowledgeDocuments.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">📚 Knowledge Base Reference</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {knowledgeDocuments.slice(0, 4).map((doc) => (
                <div key={doc.id} className="border border-gray-200 rounded-lg p-3">
                  <h4 className="font-medium text-gray-900 text-sm">{doc.title}</h4>
                  <p className="text-gray-600 text-xs mt-1">
                    {doc.content.substring(0, 100)}...
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}