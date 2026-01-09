'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AssignmentWithDetails } from '@/lib/track-assignments'
import { KnowledgeBaseDocument } from '@/lib/knowledge-base'
import { useAuth } from '@/contexts/AuthContext'
import UserHeader from '@/components/Shared/UserHeader'
import { ElevenLabsAvatarSession } from '@/components/Training/ElevenLabsAvatarSession'
import { RecommendationTTSSession } from '@/components/Training/RecommendationTTSSession'
import TheoryPracticeSession from '@/components/Training/TheoryPracticeSession'
import { SUPPORTED_LANGUAGES, SupportedLanguageCode } from '@/lib/avatar-types'
import { RecordingConsent } from '@/components/Training/RecordingConsent'
import type { RecordingPreference } from '@/lib/training-sessions'
import Link from 'next/link'
import { getEmotionDisplay } from '@/lib/customer-emotions'
import { getVoiceName, resolveVoiceId } from '@/lib/elevenlabs-voices'
import { resolveVoiceForSession, getVoiceNameById, getVoiceDetailsById } from '@/lib/voice-resolver'
import { getDefaultVideoAspectRatio } from '@/lib/device-detection'
import HiddenContent, { HiddenSection } from '@/components/SurpriseMode/HiddenContent'
import SimpleFlipboardChat from '@/components/Training/SimpleFlipboardChat'

interface TrainingQuestion {
  id: string
  question: string
  options?: string[]
  correctAnswer: string
  explanation: string
  type: 'multiple_choice' | 'open_ended'
}

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export default function TrainingSessionPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const t = useTranslations('training')
  const assignmentId = params.assignmentId as string
  const [redirectTimeout, setRedirectTimeout] = useState<NodeJS.Timeout | null>(null)

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
  // Auto-detect device type and set default aspect ratio: portrait (9:16) for mobile, landscape (16:9) for desktop
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16' | '4:3' | '1:1'>(() => {
    // Only run detection on client-side
    if (typeof window !== 'undefined') {
      return getDefaultVideoAspectRatio()
    }
    return '16:9' // SSR fallback
  })
  const [resolvedVoiceId, setResolvedVoiceId] = useState<string | undefined>(undefined)
  const [resolvedVoiceName, setResolvedVoiceName] = useState<string>('Loading...')
  const [resolvedVoiceAvatarUrl, setResolvedVoiceAvatarUrl] = useState<string | null>(null)
  const [scenarioStats, setScenarioStats] = useState<{attemptCount: number; lastAttempt: string | null; completionPercentage: number; isCompleted: boolean} | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [allowedTheoryRecordingOptions, setAllowedTheoryRecordingOptions] = useState<string[]>(['audio', 'audio_video'])
  const [allowedServicePracticeRecordingOptions, setAllowedServicePracticeRecordingOptions] = useState<string[]>(['audio', 'audio_video'])

  // Text chat state (for Flipboard pre-training warm-up)
  const [preChatMessages, setPreChatMessages] = useState<ConversationMessage[]>([])
  const [showTextChat, setShowTextChat] = useState(false)

  // Handle authentication - redirect if not authenticated after timeout
  useEffect(() => {
    if (!authLoading && !user) {
      const timeout = setTimeout(() => {
        console.log('Training page - no user after timeout, redirecting to signin')
        if (typeof window !== 'undefined') {
          window.location.href = '/signin'
        }
      }, 6000) // 6 second delay to allow auth state to stabilize

      setRedirectTimeout(timeout)
      return () => clearTimeout(timeout)
    } else if (user) {
      if (redirectTimeout) {
        clearTimeout(redirectTimeout)
        setRedirectTimeout(null)
      }
    }
  }, [authLoading, user])

  useEffect(() => {
    loadTrainingData()
  }, [assignmentId, user])

  // Load default language and recording options from company settings
  useEffect(() => {
    const loadCompanySettings = async () => {
      if (!user || !user.company_id) return

      const companyId = user.company_id

      try {
        const response = await fetch(`/api/settings/company-settings?company_id=${companyId}`)
        const data = await response.json()
        // API uses createSuccessResponse which wraps data in { success: true, data: {...} }
        const settings = data.success && data.data ? data.data.settings : null
        if (settings) {
          if (settings.default_training_language) {
            console.log('✅ Loaded default training language:', settings.default_training_language)
            setSelectedLanguage(settings.default_training_language as SupportedLanguageCode)
          }
          if (settings.theory_recording_options) {
            console.log('✅ Loaded theory recording options:', settings.theory_recording_options)
            setAllowedTheoryRecordingOptions(settings.theory_recording_options)
          }
          if (settings.service_practice_recording_options) {
            console.log('✅ Loaded service practice recording options:', settings.service_practice_recording_options)
            setAllowedServicePracticeRecordingOptions(settings.service_practice_recording_options)
          }
        }
      } catch (error) {
        console.error('Failed to load company settings:', error)
      }
    }

    loadCompanySettings()
  }, [user])

  // Auto-set recording preference for different scenario types
  useEffect(() => {
    if (currentScenario?.scenario_type === 'recommendations') {
      setRecordingPreference('audio_video')
    } else if (currentScenario?.scenario_type === 'theory') {
      // Set to first available option for theory
      if (allowedTheoryRecordingOptions.length > 0) {
        const currentPrefAllowed = allowedTheoryRecordingOptions.includes(recordingPreference as string)
        if (!currentPrefAllowed || recordingPreference === 'none') {
          setRecordingPreference(allowedTheoryRecordingOptions[0] as RecordingPreference)
        }
      }
    } else if (currentScenario?.scenario_type === 'service_practice') {
      // Set to first available option for service practice
      if (allowedServicePracticeRecordingOptions.length > 0) {
        const currentPrefAllowed = allowedServicePracticeRecordingOptions.includes(recordingPreference as string)
        if (!currentPrefAllowed || recordingPreference === 'none') {
          setRecordingPreference(allowedServicePracticeRecordingOptions[0] as RecordingPreference)
        }
      }
    }
  }, [currentScenario, allowedTheoryRecordingOptions, allowedServicePracticeRecordingOptions])

  // Resolve voice based on scenario's voice_ids and selected language
  useEffect(() => {
    const resolveVoice = async () => {
      if (currentScenario && selectedLanguage) {
        try {
          // Use new voice resolver that considers scenario's voice_ids and session language
          const resolved = await resolveVoiceForSession(
            currentScenario.voice_ids || (currentScenario.voice_id ? [currentScenario.voice_id] : null),
            selectedLanguage
          )

          if (resolved) {
            setResolvedVoiceId(resolved)

            // Fetch full voice details including avatar
            const voiceDetails = await getVoiceDetailsById(resolved)
            if (voiceDetails) {
              setResolvedVoiceName(voiceDetails.voice_name)
              setResolvedVoiceAvatarUrl(voiceDetails.avatar_url)
              console.log(`🎤 Voice resolved for ${selectedLanguage}:`, voiceDetails.voice_name, `(${resolved})`)
              if (voiceDetails.avatar_url) {
                console.log(`🖼️ Avatar URL:`, voiceDetails.avatar_url)
              }
            } else {
              const voiceName = await getVoiceNameById(resolved)
              setResolvedVoiceName(voiceName)
            }
          } else {
            // Fallback to old logic if voice resolver returns null
            const fallback = currentScenario.voice_id ? resolveVoiceId(currentScenario.voice_id) : null
            if (fallback) {
              setResolvedVoiceId(fallback)
              const fallbackName = getVoiceName(fallback)
              setResolvedVoiceName(fallbackName)
              console.log('🎤 Voice resolved (fallback):', fallbackName, `(${fallback})`)
            }
          }
        } catch (error) {
          console.error('❌ Error resolving voice:', error)
          // Fallback to old logic on error
          if (currentScenario.voice_id) {
            const fallback = resolveVoiceId(currentScenario.voice_id)
            setResolvedVoiceId(fallback)
            const fallbackName = getVoiceName(fallback)
            setResolvedVoiceName(fallbackName)
          }
        }
      }
    }

    resolveVoice()
  }, [currentScenario, selectedLanguage])

  // Load scenario stats when scenario changes
  useEffect(() => {
    if (currentScenario?.id && user?.id) {
      loadScenarioStats(currentScenario.id)
    }
  }, [currentScenario?.id, user?.id])

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
      const assignmentResponse = await fetch(`/api/tracks/track-assignments-standalone/${assignmentId}`)
      const assignmentData = await assignmentResponse.json()

      if (assignmentData.success) {
        setAssignment(assignmentData.assignment)

        // Load knowledge base documents for the company
        if (user.company_id) {
          const kbResponse = await fetch(`/api/knowledge-base/documents?company_id=${user.company_id}`)
          const kbData = await kbResponse.json()

          if (kbData.success) {
            setKnowledgeDocuments(kbData.documents)
          }
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

  const loadScenarioStats = async (scenarioId: string) => {
    if (!user?.id) return

    try {
      setStatsLoading(true)
      const response = await fetch(`/api/scenarios/scenario-stats?scenario_id=${scenarioId}&user_id=${user.id}`)
      const data = await response.json()

      if (data.success) {
        setScenarioStats(data.stats)
        console.log('📊 Loaded scenario stats:', data.stats)
      }
    } catch (error) {
      console.error('Failed to load scenario stats:', error)
    } finally {
      setStatsLoading(false)
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
                company_id: user?.company_id,
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
        scenario_id: scenarioId
      })

      if (employeeId) {
        params.append('employee_id', employeeId)
      }

      const response = await fetch(`/api/scenarios/scenario-questions?${params}`)
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
   * Start training session with recording consent
   * ElevenLabs audio is captured via WebRTC (works on all platforms)
   */
  const handleStartSessionWithPreAuth = async () => {
    console.log('🚀 Starting session with cross-platform WebRTC approach')

    // Store pre-chat messages before starting voice session
    if (preChatMessages.length > 0) {
      console.log(`💬 Carrying over ${preChatMessages.length} text chat messages to voice session`)
    }

    // SimpleFlipboardChat doesn't need cleanup (uses REST API, no persistent connection)

    // ElevenLabs audio will be captured via WebRTC (cross-platform compatible)
    console.log('💡 ElevenLabs audio will be captured via WebRTC')
    console.log('   ✅ Works on: Desktop (Chrome/Safari) + Mobile (iOS/Android)')

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
      const response = await fetch('/api/assessment/session-transcript-analysis', {
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
          <p className="text-gray-600">{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (!assignment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">{t('notFound')}</h1>
          <p className="text-gray-600 mb-4">{t('notFoundDescription')}</p>
          <Link href="/employee" className="text-blue-600 hover:text-blue-700">
            ← {t('backToDashboard')}
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
            title={t('complete.title')}
            subtitle={t('complete.subtitle', { trackName: assignment.track.name })}
          />

          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('complete.congratulations')}</h2>
            <p className="text-gray-600 mb-6">
              {t('complete.successMessage')}
            </p>

            {/* Session Statistics */}
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              {sessionData?.sessionType === 'recommendation_tts' ? (
                // TTS Recommendation Session Stats - No scoring, just question count
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{sessionData.questionsCompleted || 0}</div>
                  <div className="text-lg text-gray-600">{t('complete.questionsCompleted')}</div>
                  <p className="text-sm text-gray-500 mt-2">
                    {t('complete.recommendationNote')}
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
                    <div className="text-sm text-gray-600">{t('complete.questionsAnswered')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {Object.values(scores).filter(score => score).length}
                    </div>
                    <div className="text-sm text-gray-600">{t('complete.correctAnswers')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {Object.values(scores).filter(score => !score).length}
                    </div>
                    <div className="text-sm text-gray-600">{t('complete.factualErrors')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {Math.round((Object.values(scores).filter(score => score).length / questions.length) * 100)}%
                    </div>
                    <div className="text-sm text-gray-600">{t('complete.factualScore')}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Transcript Analysis Results */}
            {transcriptAnalysis && (
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 {t('analysis.title')}</h3>

                {/* Transcript Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="text-center bg-white rounded-lg p-4">
                    <div className="text-2xl font-bold text-blue-600">
                      {transcriptAnalysis.transcriptAnalysis?.totalMessages || 0}
                    </div>
                    <div className="text-sm text-gray-600">{t('analysis.totalMessages')}</div>
                  </div>
                  <div className="text-center bg-white rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-600">
                      {transcriptAnalysis.transcriptAnalysis?.qaPairsFound || 0}
                    </div>
                    <div className="text-sm text-gray-600">{t('analysis.qaPairsFound')}</div>
                  </div>
                  <div className="text-center bg-white rounded-lg p-4">
                    <div className="text-2xl font-bold text-purple-600">
                      {transcriptAnalysis.assessment?.summary?.score || 0}%
                    </div>
                    <div className="text-sm text-gray-600">{t('analysis.assessmentScore')}</div>
                  </div>
                </div>

                {/* Assessment Details */}
                {transcriptAnalysis.assessment?.success && (
                  <div className="bg-white rounded-lg p-4 mb-4">
                    <h4 className="font-semibold text-gray-900 mb-3">🎯 {t('analysis.assessmentResults')}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium">{t('analysis.totalQuestions')}:</span> {transcriptAnalysis.assessment.summary?.totalQuestions || 0}
                      </div>
                      <div>
                        <span className="font-medium">{t('complete.correctAnswers')}:</span> {transcriptAnalysis.assessment.summary?.correctAnswers || 0}
                      </div>
                      <div>
                        <span className="font-medium">{t('analysis.successRate')}:</span> {Math.round(((transcriptAnalysis.assessment.summary?.correctAnswers || 0) / Math.max(transcriptAnalysis.assessment.summary?.totalQuestions || 1, 1)) * 100)}%
                      </div>
                    </div>
                  </div>
                )}

                {/* User/Assistant Message Breakdown */}
                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">💬 {t('analysis.conversationBreakdown')}</h4>
                  <div className="flex justify-between text-sm">
                    <span>👤 {t('analysis.yourMessages')}: <strong>{transcriptAnalysis.transcriptAnalysis?.userMessages || 0}</strong></span>
                    <span>🤖 {t('analysis.aiTrainerMessages')}: <strong>{transcriptAnalysis.transcriptAnalysis?.assistantMessages || 0}</strong></span>
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
                      {t('analysis.analyzing')}
                    </>
                  ) : (
                    <>
                      📊 {t('analysis.getAnalysis')}
                    </>
                  )}
                </button>
              )}

              <Link
                href="/employee"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                {t('returnToDashboard')}
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
            title={t('practice.title')}
            subtitle={t('practice.subtitle')}
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
    const companyId = assignment?.track?.company_id || user?.company_id

    return (
      <div className="min-h-screen py-8 bg-[url('/images/training-bg.jpg')] bg-cover bg-center bg-fixed">
        <div className="max-w-6xl mx-auto px-4">
          {/* Header */}
          <div className="mb-8">
            <UserHeader hideProfile={true} />
          </div>

          {/* Unified Configuration and Session Interface */}
          <div className="space-y-8">
            {/* Configuration Section */}
            {showRecordingConsent && (
              <div className="bg-white rounded-lg shadow-lg p-8">
                {/* Go Back Button */}
                <div className="mb-6">
                  <Link
                    href="/employee"
                    className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span className="font-medium">{t('goBack')}</span>
                  </Link>
                </div>

                {/* Session Configuration Header */}
                <div className="mb-8">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    {currentScenario.scenario_type === 'theory'
                      ? `📖 ${t('sessionTypes.theory')}`
                      : currentScenario.scenario_type === 'recommendations'
                      ? `🎯 ${t('sessionTypes.recommendations')}`
                      : currentScenario.scenario_type === 'flipboard'
                      ? `👔 ${t('sessionTypes.flipboard')}`
                      : `🗣️ ${t('sessionTypes.servicePractice')}`
                    }
                  </h1>
                  {currentScenario.scenario_type !== 'service_practice' && currentScenario.scenario_type !== 'flipboard' && (
                    <p className="text-gray-600">
                      {currentScenario.scenario_type === 'theory'
                        ? t('sessionTypes.theoryDescription')
                        : t('sessionTypes.recommendationsDescription')
                      }
                    </p>
                  )}
                  {currentScenario.scenario_type === 'flipboard' && (
                    <p className="text-gray-600">
                      {t('sessionTypes.flipboardDescription')}
                    </p>
                  )}
                </div>

                {/* Session Configuration */}
                <div className="space-y-8">
                  {/* Scenario Goals - Hidden for Surprise Mode */}
                  {currentScenario.scenario_type === 'service_practice' && (
                    <HiddenSection
                      title={t('configuration.scenarioGoals')}
                      icon="🎯"
                      message={t('configuration.goalsHiddenMessage')}
                      className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200"
                    />
                  )}

                  {/* Language Selection - Second for Service Practice */}
                  {currentScenario.scenario_type === 'service_practice' && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">🌍 {t('configuration.languageSelection')}</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        {t('configuration.languageDescription')}
                      </p>

                      <div className="relative inline-block text-left w-full max-w-xs">
                        <select
                          value={selectedLanguage}
                          onChange={(e) => setSelectedLanguage(e.target.value as SupportedLanguageCode)}
                          className="block w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white appearance-none cursor-pointer"
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
                    </div>
                  )}

                  {/* Session Recording - Second for Service Practice */}
                  {currentScenario.scenario_type === 'service_practice' && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">🎥 {t('recording.title')}</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        {t('recording.theoryDescription')}
                      </p>

                      <div className="relative inline-block text-left w-full max-w-xs">
                        <select
                          value={recordingPreference}
                          onChange={(e) => setRecordingPreference(e.target.value as RecordingPreference)}
                          className="block w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white appearance-none cursor-pointer"
                        >
                          {allowedServicePracticeRecordingOptions.includes('audio') && (
                            <option value="audio">🎤 {t('recording.options.audio')}</option>
                          )}
                          {allowedServicePracticeRecordingOptions.includes('audio_video') && (
                            <option value="audio_video">🎬 {t('recording.options.audioVideo')}</option>
                          )}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Video Aspect Ratio - Third for Service Practice (only if video selected) */}
                  {currentScenario.scenario_type === 'service_practice' && recordingPreference === 'audio_video' && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">📐 {t('videoAspectRatio.title')}</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        {t('videoAspectRatio.description')}
                      </p>

                      <div className="relative inline-block text-left w-full max-w-xs">
                        <select
                          value={videoAspectRatio}
                          onChange={(e) => setVideoAspectRatio(e.target.value as '16:9' | '9:16' | '4:3' | '1:1')}
                          className="block w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white appearance-none cursor-pointer"
                        >
                          <option value="16:9">📺 {t('videoAspectRatio.options.widescreen')}</option>
                          <option value="9:16">📱 {t('videoAspectRatio.options.portrait')}</option>
                          <option value="4:3">📺 {t('videoAspectRatio.options.standard')}</option>
                          <option value="1:1">⬛ {t('videoAspectRatio.options.square')}</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Data Security & Privacy - Fourth for Service Practice */}
                  {currentScenario.scenario_type === 'service_practice' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h4 className="text-sm font-medium text-blue-900">{t('privacy.title')}</h4>
                          <div className="mt-1 text-sm text-blue-800">
                            {t('privacy.description')}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Start Session Button - Fifth for Service Practice */}
                  {currentScenario.scenario_type === 'service_practice' && (() => {
                    // Check if attempt limit is reached
                    const isIndividual = assignmentId.startsWith('individual-')
                    let maxAttempts: number | null = null

                    if (isIndividual) {
                      // For individual scenarios, we'd need to fetch from scenario_assignments
                      // For now, no limit check for individual (would need additional API call)
                      maxAttempts = null
                    } else if (assignment) {
                      // For track scenarios, get from scenario_attempts_limits
                      maxAttempts = (assignment as any).scenario_attempts_limits?.[currentScenario.id] || null
                    }

                    const currentAttempts = scenarioStats?.attemptCount || 0
                    const isLimitReached = maxAttempts && currentAttempts >= maxAttempts

                    return (
                      <div className="text-center">
                        <button
                          onClick={handleStartSessionWithPreAuth}
                          disabled={isLimitReached || statsLoading}
                          className={`inline-flex items-center px-8 py-4 text-lg font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-lg transform transition ${
                            isLimitReached
                              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                              : 'text-white bg-green-600 hover:bg-green-700 focus:ring-green-500 hover:scale-105'
                          }`}
                          title={isLimitReached ? `${t('buttons.attemptLimitReached')} (${currentAttempts}/${maxAttempts})` : undefined}
                        >
                          {isLimitReached ? `🚫 ${t('buttons.attemptLimitReached')}` : `🚀 ${t('buttons.startSession')}`}
                        </button>
                        {isLimitReached && (
                          <p className="mt-2 text-sm text-red-600">
                            {t('buttons.attemptLimitMessage', { maxAttempts })}
                          </p>
                        )}
                      </div>
                    )
                  })()}

                  {/* Training Mode Display */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-2">⚙️ Session Configuration</h3>
                    <div className="text-gray-700 text-sm space-y-1">
                      <p><strong>Training Mode:</strong>
                        {currentScenario.scenario_type === 'theory'
                          ? '📖 Theory Assessment'
                          : currentScenario.scenario_type === 'recommendations'
                          ? '🎯 Situationships'
                          : currentScenario.scenario_type === 'flipboard'
                          ? '👔 Flipboard'
                          : '🗣️ Service Practice'
                        }
                      </p>
                      <div className="text-gray-600"><strong>Scenario:</strong> <HiddenContent type="title" customPlaceholder="Mystery Scenario" showIcon={false} className="inline" /></div>
                      {currentScenario.session_time_limit_minutes && (
                        <p><strong>Time Limit:</strong> ⏱️ {currentScenario.session_time_limit_minutes} minutes</p>
                      )}
                      <p><strong>Company:</strong> {companyId}</p>
                    </div>
                  </div>

                  {/* ElevenLabs Settings Preview - Hidden for Situationships (Surprise Mode) */}
                  {currentScenario?.scenario_type !== 'recommendations' && (
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
                                  <strong>Strict Theory Examiner</strong> - Will ask {scenarioQuestions.length} specific questions about this topic.
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
                            ) : currentScenario.scenario_type === 'flipboard' ? (
                              <>
                                <strong>Knowledgeable Employee ({currentScenario.employee_role || 'Staff Member'})</strong> - Will answer your questions as a well-trained employee using company knowledge base.
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
                              <div className="text-gray-600 text-xs">
                                <strong>Training Focus:</strong> <HiddenContent type="title" customPlaceholder="Situationships Training" showIcon={false} className="inline" />
                              </div>
                              {/* Hidden: Instructions for surprise mode */}
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
                          ) : currentScenario.scenario_type === 'flipboard' ? (
                            <div className="text-gray-600 text-xs">
                              <p className="mb-2">
                                <strong>Employee Role:</strong> {currentScenario.employee_role || 'General Staff'}
                              </p>
                              <p>
                                The AI will use the company knowledge base to professionally answer your questions about the business.
                              </p>
                            </div>
                          ) : (
                            <div className="text-gray-600 text-xs">
                              <HiddenContent type="title" customPlaceholder="Mystery Training Scenario" showIcon={false} className="inline" />
                            </div>
                          )}
                        </div>
                      </div>

                      {currentScenario.scenario_type === 'service_practice' && (
                        <>
                          {/* Customer Emotion Level Display */}
                          {currentScenario.customer_emotion_level && (
                            <div className={`rounded-lg p-4 border-2 ${
                              currentScenario.customer_emotion_level === 'normal' ? 'bg-blue-50 border-blue-200' :
                              currentScenario.customer_emotion_level === 'cold' ? 'bg-gray-50 border-gray-200' :
                              currentScenario.customer_emotion_level === 'in_a_hurry' ? 'bg-yellow-50 border-yellow-200' :
                              currentScenario.customer_emotion_level === 'angry' ? 'bg-orange-50 border-orange-200' :
                              'bg-red-50 border-red-200'
                            }`}>
                              <p className="font-semibold text-gray-900 mb-2">
                                {getEmotionDisplay(currentScenario.customer_emotion_level).icon} Customer Emotion Level
                              </p>
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                  currentScenario.customer_emotion_level === 'normal' ? 'bg-blue-100 text-blue-800' :
                                  currentScenario.customer_emotion_level === 'cold' ? 'bg-gray-100 text-gray-800' :
                                  currentScenario.customer_emotion_level === 'in_a_hurry' ? 'bg-yellow-100 text-yellow-800' :
                                  currentScenario.customer_emotion_level === 'angry' ? 'bg-orange-100 text-orange-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {getEmotionDisplay(currentScenario.customer_emotion_level).icon} {getEmotionDisplay(currentScenario.customer_emotion_level).label}
                                </span>
                              </div>
                              <p className="text-gray-600 text-xs mt-2">
                                {currentScenario.customer_emotion_level === 'normal' && 'Everyday customer with reasonable expectations. Respectful but has boundaries - will escalate if treated poorly.'}
                                {currentScenario.customer_emotion_level === 'cold' && 'Neutral, skeptical urban customer. Tests authenticity - responds to competence and genuine service.'}
                                {currentScenario.customer_emotion_level === 'in_a_hurry' && 'Time-pressured customer needing quick resolution. Show efficiency and acknowledge their time constraints.'}
                                {currentScenario.customer_emotion_level === 'angry' && 'Very upset and demanding customer. Use de-escalation techniques, show genuine empathy, and provide concrete solutions.'}
                                {currentScenario.customer_emotion_level === 'extremely_angry' && 'Furious and confrontational. Advanced de-escalation training - stay calm, show exceptional empathy, and demonstrate accountability.'}
                              </p>
                            </div>
                          )}

                          {/* Voice Display */}
                          <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                            <p className="font-semibold text-gray-900 mb-3">
                              🎤 AI Voice
                            </p>
                            <div className="flex items-center gap-3">
                              {/* Avatar */}
                              {resolvedVoiceAvatarUrl ? (
                                <div className="w-12 h-12 rounded-full overflow-hidden bg-white border-2 border-blue-200 flex-shrink-0">
                                  <img
                                    src={resolvedVoiceAvatarUrl}
                                    alt={`${resolvedVoiceName} avatar`}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-white border-2 border-blue-200 flex items-center justify-center flex-shrink-0">
                                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </div>
                              )}

                              {/* Voice name and badges */}
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                  {resolvedVoiceName}
                                </span>
                                {((currentScenario.voice_ids && currentScenario.voice_ids.includes('random')) ||
                                  (currentScenario.voice_ids && currentScenario.voice_ids.length > 1) ||
                                  currentScenario.voice_id === 'random') && (
                                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700">
                                    Randomly Selected
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-gray-600 text-xs mt-2">
                              {((currentScenario.voice_ids && currentScenario.voice_ids.includes('random')) || currentScenario.voice_id === 'random')
                                ? `The system randomly selected ${resolvedVoiceName} for this session. Reload to try a different voice.`
                                : (currentScenario.voice_ids && currentScenario.voice_ids.length > 1)
                                ? `The system selected ${resolvedVoiceName} from ${currentScenario.voice_ids.length} available voices for this language.`
                                : `The AI will use the ${resolvedVoiceName} voice for this session.`
                              }
                            </p>
                          </div>

                          {/* Hidden: Customer Behavior, Expected Response, and Milestones for Surprise Mode */}
                        </>
                      )}
                    </div>
                  </div>
                  )}

                  {/* Language Selection - Hide for recommendations and service_practice (shown at top for service_practice) */}
                  {(currentScenario?.scenario_type === 'theory' || currentScenario?.scenario_type === 'flipboard') && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">🌍 {t('configuration.languageSelection')}</h3>
                      <p className="text-gray-600 mb-4">
                        {t('configuration.languageDescription')}
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
                          <strong>{t('configuration.selected')}:</strong> {SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage)?.flag} {SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage)?.name}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Recording Preferences - Only show for Theory and Recommendations (Service Practice has it at top) */}
                  {currentScenario?.scenario_type !== 'service_practice' && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">🎥 {t('recording.title')}</h3>
                      <p className="text-gray-600 mb-4">
                        {currentScenario?.scenario_type === 'recommendations'
                          ? t('recording.recommendationsDescription')
                          : (currentScenario?.scenario_type === 'theory' || currentScenario?.scenario_type === 'flipboard')
                          ? t('recording.theoryDescription')
                          : t('recording.defaultDescription')
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
                            <option value="audio_video">🎬 {t('recording.options.videoRequired')}</option>
                          ) : (currentScenario?.scenario_type === 'theory' || currentScenario?.scenario_type === 'flipboard') ? (
                            <>
                              {allowedTheoryRecordingOptions.includes('audio') && (
                                <option value="audio">🎤 {t('recording.options.audio')}</option>
                              )}
                              {allowedTheoryRecordingOptions.includes('audio_video') && (
                                <option value="audio_video">🎬 {t('recording.options.audioVideo')}</option>
                              )}
                            </>
                          ) : (
                            <>
                              <option value="none">🚫 {t('recording.options.none')}</option>
                              <option value="audio">🎤 {t('recording.options.audio')}</option>
                              <option value="audio_video">🎬 {t('recording.options.audioVideo')}</option>
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
                            <><strong>{t('configuration.selected')}:</strong> 🚫 {t('recording.selectedDescriptions.none')}</>
                          )}
                          {recordingPreference === 'audio' && (
                            <><strong>{t('configuration.selected')}:</strong> 🎤 {t('recording.selectedDescriptions.audio')}</>
                          )}
                          {recordingPreference === 'audio_video' && (
                            <><strong>{t('configuration.selected')}:</strong> 🎬 {t('recording.selectedDescriptions.audioVideo')}</>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Video Aspect Ratio Selection - Only show for Theory and Recommendations if video enabled (Service Practice has it at top) */}
                  {currentScenario?.scenario_type !== 'service_practice' && recordingPreference === 'audio_video' && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">📐 {t('videoAspectRatio.title')}</h3>
                      <p className="text-gray-600 mb-4">
                        {t('videoAspectRatio.description')}
                      </p>

                      <div className="relative inline-block text-left w-full max-w-xs">
                        <select
                          value={videoAspectRatio}
                          onChange={(e) => setVideoAspectRatio(e.target.value as '16:9' | '9:16' | '4:3' | '1:1')}
                          className="block w-full px-4 py-3 pr-10 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white appearance-none cursor-pointer"
                        >
                          <option value="16:9">📺 {t('videoAspectRatio.options.widescreen')}</option>
                          <option value="9:16">📱 {t('videoAspectRatio.options.portrait')}</option>
                          <option value="4:3">📺 {t('videoAspectRatio.options.standard')}</option>
                          <option value="1:1">⬛ {t('videoAspectRatio.options.square')}</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">
                          <strong>{t('configuration.selected')}:</strong> {videoAspectRatio === '16:9' && `📺 ${t('videoAspectRatio.selectedDescriptions.widescreen')}`}
                          {videoAspectRatio === '9:16' && `📱 ${t('videoAspectRatio.selectedDescriptions.portrait')}`}
                          {videoAspectRatio === '4:3' && `📺 ${t('videoAspectRatio.selectedDescriptions.standard')}`}
                          {videoAspectRatio === '1:1' && `⬛ ${t('videoAspectRatio.selectedDescriptions.square')}`}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Privacy Notice - Only show for Theory and Recommendations (Service Practice has it at top) */}
                  {currentScenario?.scenario_type !== 'service_practice' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h4 className="text-sm font-medium text-blue-900">{t('privacy.title')}</h4>
                          <div className="mt-1 text-sm text-blue-800">
                            {t('privacy.description')}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Text Chat Warm-up - Only for Flipboard scenarios */}
                  {currentScenario?.scenario_type === 'flipboard' && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">💬 Text Chat Warm-up (Optional)</h3>
                      <p className="text-gray-600 mb-4">
                        Practice asking questions in text mode before starting the voice session. Your chat history will be preserved.
                      </p>

                      {!showTextChat ? (
                        <button
                          onClick={() => setShowTextChat(true)}
                          className="w-full py-3 px-4 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors flex items-center justify-center gap-2 font-medium"
                        >
                          💬 Start Text Chat Warm-up
                          <span className="text-xs text-indigo-600">(Optional)</span>
                        </button>
                      ) : (
                        <div className="space-y-4">
                          <SimpleFlipboardChat
                            scenarioId={currentScenario.id}
                            language={selectedLanguage}
                            scenarioContext={{
                              establishment_type: currentScenario.establishment_type,
                              title: currentScenario.title,
                              description: currentScenario.description
                            }}
                            onMessagesChange={(messages) => {
                              setPreChatMessages(messages)
                            }}
                            initialMessages={preChatMessages}
                          />

                          <button
                            onClick={() => setShowTextChat(false)}
                            className="text-sm text-gray-600 hover:text-gray-800 underline"
                          >
                            ← Back to configuration
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Start Session Button - Only show for Theory and Recommendations (Service Practice button is at top) */}
                {currentScenario.scenario_type !== 'service_practice' && (() => {
                  // Check if attempt limit is reached
                  const isIndividual = assignmentId.startsWith('individual-')
                  let maxAttempts: number | null = null

                  if (isIndividual) {
                    // For individual scenarios, we'd need to fetch from scenario_assignments
                    // For now, no limit check for individual (would need additional API call)
                    maxAttempts = null
                  } else if (assignment) {
                    // For track scenarios, get from scenario_attempts_limits
                    maxAttempts = (assignment as any).scenario_attempts_limits?.[currentScenario.id] || null
                  }

                  const currentAttempts = scenarioStats?.attemptCount || 0
                  const isLimitReached = maxAttempts && currentAttempts >= maxAttempts

                  return (
                    <div className="mt-8 text-center">
                      <button
                        onClick={handleStartSessionWithPreAuth}
                        disabled={isLimitReached || statsLoading}
                        className={`inline-flex items-center px-8 py-4 text-lg font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-lg transform transition ${
                          isLimitReached
                            ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                            : 'text-white bg-green-600 hover:bg-green-700 focus:ring-green-500 hover:scale-105'
                        }`}
                        title={isLimitReached ? `${t('buttons.attemptLimitReached')} (${currentAttempts}/${maxAttempts})` : undefined}
                      >
                        {isLimitReached ? `🚫 ${t('buttons.attemptLimitReached')}` : `🚀 ${t('buttons.startSession')}`}
                      </button>
                      {isLimitReached && (
                        <p className="mt-2 text-sm text-red-600">
                          {t('buttons.attemptLimitMessage', { maxAttempts })}
                        </p>
                      )}
                    </div>
                  )
                })()}
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
                  videoAspectRatio={videoAspectRatio}
                  voiceIds={currentScenario.voice_ids || (currentScenario.voice_id ? [currentScenario.voice_id] : undefined)}
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
                    description: currentScenario.description,
                    type: currentScenario.scenario_type,
                    client_behavior: currentScenario.client_behavior,
                    expected_response: currentScenario.expected_response,
                    customer_emotion_level: currentScenario.customer_emotion_level,
                    first_message: currentScenario.first_message,
                    milestones: currentScenario.milestones,
                    employee_role: currentScenario.employee_role,
                    establishment_type: currentScenario.establishment_type
                  }}
                  scenarioQuestions={scenarioQuestions}
                  language={selectedLanguage}
                  agentId="agent_9301k5efjt1sf81vhzc3pjmw0fy9"
                  voiceId={resolvedVoiceId || currentScenario.voice_id}
                  avatarUrl={resolvedVoiceAvatarUrl}
                  recordingPreference={recordingPreference}
                  videoAspectRatio={videoAspectRatio}
                  preAuthorizedTabAudio={preAuthorizedTabAudio}
                  sessionTimeLimit={currentScenario.session_time_limit_minutes}
                  preChatMessages={preChatMessages}
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