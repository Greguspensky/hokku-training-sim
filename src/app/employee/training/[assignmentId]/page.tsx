'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AssignmentWithDetails } from '@/lib/track-assignments'
import { KnowledgeBaseDocument } from '@/lib/knowledge-base'
import { useAuth } from '@/contexts/AuthContext'
import UserHeader from '@/components/UserHeader'
import { ElevenLabsAvatarSession } from '@/components/ElevenLabsAvatarSession'
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
  const [sessionData, setSessionData] = useState<any>(null)
  const [isAnalyzingTranscript, setIsAnalyzingTranscript] = useState(false)
  const [transcriptAnalysis, setTranscriptAnalysis] = useState<any>(null)

  useEffect(() => {
    loadTrainingData()
  }, [assignmentId, user])

  const loadTrainingData = async () => {
    if (!user) return

    try {
      // Check URL parameters for theory practice mode
      const urlParams = new URLSearchParams(window.location.search)
      const practiceMode = urlParams.get('mode') === 'theory-practice'

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

        // Check if any scenario is theory type (always use avatar mode for theory)
        const theoryScenario = assignmentData.assignment.track.scenarios?.find(
          (scenario: any) => scenario.scenario_type === 'theory'
        )

        if (theoryScenario) {
          // Always use avatar mode for theory scenarios
          setCurrentScenario(theoryScenario)
          setIsAvatarMode(true)
          console.log('🎭 Avatar mode activated for theory scenario:', theoryScenario.title)
        } else {
          // Generate training questions for non-theory scenarios (service practice)
          await generateTrainingQuestions(assignmentData.assignment, kbData.documents || [])
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

            <div className="bg-gray-50 rounded-lg p-6 mb-6">
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
              {sessionData && !transcriptAnalysis && (
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

  // If avatar mode is enabled, render language selection and ElevenLabsAvatarSession component
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

          {/* Recording Consent - Show first */}
          {showRecordingConsent && (
            <RecordingConsent
              selectedPreference={recordingPreference}
              onSelectionChange={setRecordingPreference}
              className="mb-6"
            />
          )}

          {/* Language Selection */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">🌍 Language Selection</h2>
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

          {/* Start Training Button */}
          {!showRecordingConsent && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Start Training?</h3>
                <p className="text-gray-600 mb-4">
                  You've configured your preferences. Click below to begin your training session.
                </p>
                <button
                  onClick={() => setShowRecordingConsent(false)}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  🚀 Start Training Session
                </button>
              </div>
            </div>
          )}

          {showRecordingConsent && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Continue?</h3>
                <p className="text-gray-600 mb-4">
                  Please review your recording preferences above, then click continue to proceed with language selection.
                </p>
                <button
                  onClick={() => setShowRecordingConsent(false)}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  ✅ Continue to Language Selection
                </button>
              </div>
            </div>
          )}

          {/* ElevenLabs Avatar Session - Only show when recording consent is complete */}
          {!showRecordingConsent && (
            <ElevenLabsAvatarSession
              companyId={companyId}
              scenarioId={currentScenario.id}
              scenarioContext={{
                title: currentScenario.title,
                type: currentScenario.scenario_type,
                difficulty: currentScenario.difficulty || 'beginner'
              }}
              language={selectedLanguage}
              agentId="agent_9301k5efjt1sf81vhzc3pjmw0fy9"
              recordingPreference={recordingPreference}
              onSessionEnd={(completedSessionData) => {
                console.log('✅ Avatar session completed:', completedSessionData)
                setSessionData(completedSessionData)
                updateProgress()
                setSessionComplete(true)
              }}
              className="mb-8"
            />
          )}
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