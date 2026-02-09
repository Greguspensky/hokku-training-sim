'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Clock, User, Bot, Calendar, Globe, Brain, Play, Pause, Volume2, Video, CheckCircle, XCircle, AlertCircle, Target } from 'lucide-react'
import { trainingSessionsService, type TrainingSession } from '@/lib/training-sessions'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslations, useLocale } from 'next-intl'
import UserHeader from '@/components/Shared/UserHeader'
import { getEmotionDisplay } from '@/lib/customer-emotions'
import { getVoiceName } from '@/lib/elevenlabs-voices'
import PerformanceScoreCard from '@/components/Analytics/PerformanceScoreCard'
import MilestoneChecklist from '@/components/Analytics/MilestoneChecklist'
import FeedbackSection from '@/components/Analytics/FeedbackSection'
import UnacceptablePhrases from '@/components/Analytics/UnacceptablePhrases'
import ManagerSummary from '@/components/Analytics/ManagerSummary'
import { SUPPORTED_LANGUAGES, type LanguageCode } from '@/lib/languages'
import { VideoPlayerWithDuration } from '@/components/VideoPlayerWithDuration'

// Helper function to get training mode display name - now uses translations
function getTrainingModeDisplay(trainingMode: string, t: any): string {
  const modeKey = trainingMode === 'recommendation_tts' ? 'recommendationTts' :
                  trainingMode === 'service_practice' ? 'servicePractice' : trainingMode
  return t(`trainingModes.${modeKey}`, trainingMode)
}

export default function SessionTranscriptPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const locale = useLocale()
  const t = useTranslations('sessionHistory')
  const [session, setSession] = useState<TrainingSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [isAnalyzingTranscript, setIsAnalyzingTranscript] = useState(false)
  const [isFetchingTranscript, setIsFetchingTranscript] = useState(false)
  const [transcriptAnalysis, setTranscriptAnalysis] = useState<any>(null)
  const [servicePracticeAssessment, setServicePracticeAssessment] = useState<any>(null)
  const [scenarioDetails, setScenarioDetails] = useState<any>(null)
  const [loadingScenario, setLoadingScenario] = useState(false)
  const [activeTab, setActiveTab] = useState<'transcript' | 'analysis'>('transcript')
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(() => {
    // Default to current interface language
    return locale as LanguageCode
  })

  const sessionId = params.sessionId as string
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    console.log('🔄 Session page useEffect - sessionId:', sessionId, 'user:', !!user)
    if (!sessionId || !user?.id) {
      console.log('⏸️ Waiting for sessionId and user...')
      return
    }

    // Prevent duplicate loads when tab becomes visible again
    const sessionKey = `${sessionId}-${user.id}`
    if (hasLoadedRef.current === sessionKey) {
      console.log('⏭️ Session already loaded - skipping duplicate fetch')
      return
    }

    hasLoadedRef.current = sessionKey
    loadSession()
  }, [sessionId, user?.id])

  const loadSession = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('📖 Loading training session transcript:', sessionId)

      // Use API endpoint with admin client to bypass RLS
      const response = await fetch(`/api/training/training-session/${sessionId}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'Training session not found')
        return
      }

      const sessionData = data.session

      // Verify user has access to this session
      const userId = user?.id
      const userRole = user?.role
      const userCompanyId = user?.company_id

      console.log('🔐 Access check - Session employee_id:', sessionData.employee_id, 'User ID:', userId, 'Role:', userRole)

      // Allow access if:
      // 1. User is viewing their own session
      // 2. User is a manager viewing a session from their company
      const isOwnSession = sessionData.employee_id === userId
      const isManagerViewingCompanySession = userRole === 'manager' && sessionData.company_id === userCompanyId

      if (!isOwnSession && !isManagerViewingCompanySession) {
        console.error('❌ Access denied - User cannot view this session')
        setError('Access denied: You do not have permission to view this session')
        return
      }

      console.log('✅ Access granted:', isOwnSession ? 'Own session' : 'Manager viewing company session')

      setSession(sessionData)
      console.log('✅ Session transcript loaded successfully')

      // Check for cached assessment results and load them immediately
      if (sessionData.assessment_status === 'completed' && sessionData.theory_assessment_results) {
        console.log('📊 Loading cached assessment results from database')
        console.log('🔍 Assessment status:', sessionData.assessment_status)
        console.log('🔍 Theory assessment results:', sessionData.theory_assessment_results)

        const cachedResults = {
          success: true,
          sessionId: sessionData.id,
          transcriptAnalysis: {
            totalMessages: sessionData.conversation_transcript?.length || 0,
            userMessages: sessionData.conversation_transcript?.filter((m: any) => m.role === 'user').length || 0,
            assistantMessages: sessionData.conversation_transcript?.filter((m: any) => m.role === 'assistant').length || 0,
            qaPairsFound: sessionData.theory_assessment_results?.processedExchanges || 0,
            transcript: sessionData.conversation_transcript || []
          },
          assessment: sessionData.theory_assessment_results,
          fromCache: true,
          cachedAt: sessionData.assessment_completed_at
        }

        setTranscriptAnalysis(cachedResults)
        setActiveTab('analysis') // Auto-switch to analysis tab to show cached results
        console.log('✅ Cached assessment results loaded successfully:', cachedResults)
      } else {
        console.log('🔍 No cached results found:')
        console.log('  - assessment_status:', sessionData.assessment_status)
        console.log('  - theory_assessment_results:', !!sessionData.theory_assessment_results)
      }

      // Check for cached Service Practice assessment results and load them immediately
      if (sessionData.training_mode === 'service_practice' &&
          sessionData.service_assessment_status === 'completed' &&
          sessionData.service_practice_assessment_results) {
        console.log('📊 Loading cached Service Practice assessment results from database')
        console.log('🔍 Service assessment status:', sessionData.service_assessment_status)
        console.log('🔍 Service Practice assessment results:', sessionData.service_practice_assessment_results)

        const cachedResults = {
          success: true,
          sessionId: sessionData.id,
          assessment: sessionData.service_practice_assessment_results,
          fromCache: true,
          cachedAt: sessionData.service_assessment_completed_at
        }

        setServicePracticeAssessment(cachedResults.assessment)
        setActiveTab('analysis') // Auto-switch to analysis tab to show cached results
        console.log('✅ Cached Service Practice assessment results loaded successfully')
      } else if (sessionData.training_mode === 'service_practice') {
        console.log('🔍 No cached Service Practice results found:')
        console.log('  - service_assessment_status:', sessionData.service_assessment_status)
        console.log('  - service_practice_assessment_results:', !!sessionData.service_practice_assessment_results)
      }

      // Check if we need to lazy load audio
      await tryLoadMissingAudio(sessionData)

      // Load scenario details if available
      if (sessionData.scenario_id) {
        await loadScenarioDetails(sessionData.scenario_id)
      }

    } catch (err) {
      console.error('❌ Failed to load session transcript:', err)
      setError('Failed to load training session transcript')
    } finally {
      setLoading(false)
    }
  }

  const loadScenarioDetails = async (scenarioId: string) => {
    try {
      setLoadingScenario(true)
      console.log('📋 Loading scenario details for:', scenarioId)

      const response = await fetch(`/api/scenarios/${scenarioId}`)
      if (response.ok) {
        const data = await response.json()
        setScenarioDetails(data.scenario)
        console.log('✅ Scenario details loaded:', data.scenario)
      } else {
        console.warn('⚠️ Could not load scenario details')
      }
    } catch (error) {
      console.error('❌ Error loading scenario details:', error)
    } finally {
      setLoadingScenario(false)
    }
  }

  const tryLoadMissingAudio = async (sessionData: TrainingSession) => {
    // Only try to load audio if:
    // 1. Session has ElevenLabs conversation ID
    // 2. Session doesn't have audio URL yet
    // 3. Recording preference was not 'none'
    if (!sessionData.elevenlabs_conversation_id ||
        sessionData.audio_recording_url ||
        sessionData.recording_preference === 'none') {
      return
    }

    console.log('🎵 Attempting to lazy load missing audio for conversation:', sessionData.elevenlabs_conversation_id)
    setAudioLoading(true)
    setAudioError(null)

    try {
      const response = await fetch('/api/elevenlabs/elevenlabs-conversation-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: sessionData.elevenlabs_conversation_id,
          sessionId: sessionData.id
        })
      })

      if (response.ok) {
        const audioResult = await response.json()
        console.log('✅ Audio lazy loaded successfully:', audioResult.audioUrl)

        // Reload the session to get the updated audio URL
        const updatedSession = await trainingSessionsService.getSessionById(sessionId)
        if (updatedSession) {
          setSession(updatedSession)
        }
      } else {
        const errorData = await response.json()
        console.log('⚠️ Audio not yet available:', errorData.error)
        setAudioError(errorData.error || 'Audio not available yet')
      }
    } catch (error) {
      console.error('❌ Error lazy loading audio:', error)
      setAudioError('Failed to load audio recording')
    } finally {
      setAudioLoading(false)
    }
  }

  const handleGetTranscript = async () => {
    if (!session?.id || !session.elevenlabs_conversation_id) {
      alert('No conversation ID available for transcript fetch')
      return
    }

    setIsFetchingTranscript(true)

    try {
      const response = await fetch('/api/elevenlabs/elevenlabs-conversation-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: session.elevenlabs_conversation_id
        })
      })

      const result = await response.json()

      if (result.success) {
        console.log('✅ Transcript fetched successfully')
        // Refresh the session to get the updated transcript
        await loadSession()
      } else {
        console.error('❌ Transcript fetch failed:', result.error || result.details)
        alert(`Failed to fetch transcript: ${result.error || result.details}`)
      }
    } catch (error) {
      console.error('❌ Error fetching transcript:', error)
      alert('Failed to fetch transcript')
    } finally {
      setIsFetchingTranscript(false)
    }
  }

  const handleRunAnalysis = async (forceReAnalysis = false) => {
    console.log('🔘 Redo Analysis button clicked!', { forceReAnalysis, sessionId: session?.id, selectedLanguage })

    if (!session?.id) {
      console.error('❌ No session data available')
      alert('No session data available for analysis')
      return
    }

    setIsAnalyzingTranscript(true)

    try {
      // Determine which endpoint to call based on training mode
      if (session.training_mode === 'service_practice') {
        // Call Service Practice assessment endpoint
        const response = await fetch('/api/assessment/assess-service-practice-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: String(sessionId),
            forceReAnalysis: Boolean(forceReAnalysis),
            language: selectedLanguage  // Use selected language from dropdown
          })
        })

        const result = await response.json()

        if (result.success) {
          setServicePracticeAssessment(result.assessment)
          console.log('✅ Service Practice assessment completed successfully')
          console.log('📋 From cache:', result.fromCache)

          // Switch to analysis tab automatically
          setActiveTab('analysis')

          // Refresh the session to get the updated cached results
          await loadSession()
        } else {
          console.error('❌ Service Practice assessment failed:', result.error)
          alert(`Failed to assess Service Practice session: ${result.error}`)
        }
      } else {
        // Call Theory Q&A assessment endpoint (existing)
        const response = await fetch('/api/assessment/session-transcript-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: String(sessionId),
            forceReAnalysis: Boolean(forceReAnalysis)
          })
        })

        const result = await response.json()

        if (result.success) {
          setTranscriptAnalysis(result)
          console.log('✅ Analysis completed successfully')

          // Refresh the session to get the updated transcript
          await loadSession()
        } else {
          console.error('❌ Analysis failed:', result.error)
          alert(`Failed to run analysis: ${result.error}`)
        }
      }
    } catch (error) {
      console.error('❌ Error running analysis:', error)
      alert('Failed to run analysis')
    } finally {
      setIsAnalyzingTranscript(false)
    }
  }

  const handleGetTranscriptAnalysis = async (forceReAnalysis = false) => {
    if (!session?.id) {
      alert('No session data available for analysis')
      return
    }

    setIsAnalyzingTranscript(true)

    try {
      const response = await fetch('/api/session-transcript-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: String(sessionId),
          forceReAnalysis: Boolean(forceReAnalysis)
        })
      })

      const result = await response.json()

      if (result.success) {
        setTranscriptAnalysis(result)
        console.log('✅ Transcript analysis completed successfully')

        // Refresh the session to get the updated transcript
        await loadSession()
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  // Format timestamp as MM:SS for conversation transcript (like ElevenLabs UI)
  const formatConversationTimestamp = (timestamp: number) => {
    // Timestamp is in milliseconds, convert to seconds
    const totalSeconds = Math.floor(timestamp / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('errorLoading')}</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/employee')}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            {t('backToDashboard')}
          </button>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-5xl mb-4">📝</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('sessionNotFound')}</h2>
          <p className="text-gray-600 mb-4">{t('sessionNotFoundDescription')}</p>
          <button
            onClick={() => router.push('/employee')}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            {t('backToDashboard')}
          </button>
        </div>
      </div>
    )
  }

  // Construct a better subtitle using scenario title if available
  const constructSubtitle = () => {
    const trainingModeLabel = getTrainingModeDisplay(session.training_mode, t)

    // If we have scenario details with a title, use it
    if (scenarioDetails?.title) {
      return `${trainingModeLabel} - ${scenarioDetails.title}`
    }

    // Otherwise, just use the training mode
    return trainingModeLabel
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <UserHeader
          title={t('pageTitle')}
          subtitle={constructSubtitle()}
        />

        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/employee')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('backToDashboard')}
          </button>
        </div>

        {/* Session Metadata */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('sessionDetails')}</h2>

          {/* Session and Attempt IDs */}
          <div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="font-medium text-gray-700">{t('sessionId')}:</span>
                <div className="mt-1 font-mono text-gray-600 break-all">{session.id}</div>
              </div>
              {session.scenario_id && (
                <div>
                  <span className="font-medium text-gray-700">{t('attemptId')}:</span>
                  <div className="mt-1 font-mono text-gray-600 break-all">{session.scenario_id}</div>
                </div>
              )}
              {session.elevenlabs_conversation_id && (
                <div>
                  <span className="font-medium text-gray-700">{t('elevenLabsConvId')}:</span>
                  <div className="mt-1 font-mono text-gray-600 break-all">{session.elevenlabs_conversation_id}</div>
                </div>
              )}
              {session.video_recording_url && (
                <div>
                  <span className="font-medium text-gray-700">{t('videoId')}:</span>
                  <div className="mt-1 font-mono text-gray-600 break-all">{session.video_recording_url.split('/').pop()}</div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center">
              <Calendar className="w-5 h-5 text-gray-400 mr-3" />
              <div>
                <div className="text-sm font-medium text-gray-900">{formatDate(session.started_at)}</div>
                <div className="text-xs text-gray-500">{formatTime(session.started_at)} - {formatTime(session.ended_at)}</div>
              </div>
            </div>
            <div className="flex items-center">
              <Clock className="w-5 h-5 text-gray-400 mr-3" />
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {trainingSessionsService.formatDuration(session.session_duration_seconds)}
                </div>
                <div className="text-xs text-gray-500">{t('duration')}</div>
              </div>
            </div>
            <div className="flex items-center">
              <Brain className="w-5 h-5 text-gray-400 mr-3" />
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {getTrainingModeDisplay(session.training_mode, t)}
                </div>
                <div className="text-xs text-gray-500">{t('trainingMode')}</div>
              </div>
            </div>
            <div className="flex items-center">
              <Globe className="w-5 h-5 text-gray-400 mr-3" />
              <div>
                <div className="text-sm font-medium text-gray-900">{session.language.toUpperCase()}</div>
                <div className="text-xs text-gray-500">{t('language')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ElevenLabs AI Agent Settings - Hidden as requested */}
        {false && session.training_mode === 'service_practice' && scenarioDetails && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg shadow mb-6 border border-purple-200">
            <div className="p-6 border-b border-purple-200 bg-white bg-opacity-60">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                🤖 {t('elevenLabsSettings')}
              </h2>
              <p className="text-sm text-gray-600 mt-1">{t('configurationUsed')}</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Character Role */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-start mb-2">
                  <span className="text-lg mr-2">🎭</span>
                  <h3 className="font-semibold text-gray-900">{t('characterRole')}</h3>
                </div>
                <p className="text-sm text-gray-700">
                  {t('customerInRoleplay')}
                </p>
              </div>

              {/* Two-column layout for Scenario Context and AI Voice */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Scenario Context */}
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start mb-2">
                    <span className="text-lg mr-2">📋</span>
                    <h3 className="font-semibold text-gray-900">{t('scenarioContext')}</h3>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {scenarioDetails.title || t('noScenarioContext')}
                  </p>
                </div>

                {/* AI Voice */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-start mb-2">
                    <span className="text-lg mr-2">🎤</span>
                    <h3 className="font-semibold text-gray-900">{t('aiVoice')}</h3>
                  </div>
                  <div>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium text-blue-700">
                        {scenarioDetails.voice_id ? getVoiceName(scenarioDetails.voice_id) : t('unknownVoice')}
                      </span>
                      {scenarioDetails.voice_id === 'random' && (
                        <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                          {t('randomlySelected')}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {scenarioDetails.voice_id === 'random'
                        ? t('randomVoiceDescription', { voiceName: getVoiceName(scenarioDetails.voice_id) })
                        : t('voiceDescription', { voiceName: getVoiceName(scenarioDetails.voice_id) })
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Customer Emotion Level */}
              {scenarioDetails.customer_emotion_level && (
                <div className={`rounded-lg p-4 border-2 ${
                  scenarioDetails.customer_emotion_level === 'calm' ? 'bg-green-50 border-green-200' :
                  scenarioDetails.customer_emotion_level === 'frustrated' ? 'bg-yellow-50 border-yellow-200' :
                  scenarioDetails.customer_emotion_level === 'angry' ? 'bg-orange-50 border-orange-200' :
                  'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start mb-2">
                    <span className="text-lg mr-2">
                      {getEmotionDisplay(scenarioDetails.customer_emotion_level).icon}
                    </span>
                    <h3 className="font-semibold text-gray-900">{t('customerEmotionLevel')}</h3>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        scenarioDetails.customer_emotion_level === 'calm' ? 'bg-green-100 text-green-800' :
                        scenarioDetails.customer_emotion_level === 'frustrated' ? 'bg-yellow-100 text-yellow-800' :
                        scenarioDetails.customer_emotion_level === 'angry' ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {getEmotionDisplay(scenarioDetails.customer_emotion_level).icon} {getEmotionDisplay(scenarioDetails.customer_emotion_level).label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">
                      {scenarioDetails.customer_emotion_level === 'calm'
                        ? t('normalDescription')
                        : scenarioDetails.customer_emotion_level === 'cold'
                        ? t('coldDescription')
                        : scenarioDetails.customer_emotion_level === 'frustrated'
                        ? t('frustratedDescription')
                        : scenarioDetails.customer_emotion_level === 'angry'
                        ? t('angryDescription')
                        : t('extremelyAngryDescription')}
                    </p>
                  </div>
                </div>
              )}

              {/* Expected Employee Response */}
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-start mb-2">
                  <span className="text-lg mr-2">✅</span>
                  <h3 className="font-semibold text-gray-900">{t('expectedResponse')}</h3>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {scenarioDetails.expected_response || t('noExpectedResponse')}
                </p>
              </div>

              {/* Key Milestones */}
              {scenarioDetails.milestones && scenarioDetails.milestones.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start mb-3">
                    <span className="text-lg mr-2">🎯</span>
                    <h3 className="font-semibold text-gray-900">{t('keyMilestones')}</h3>
                  </div>
                  <ul className="space-y-2">
                    {scenarioDetails.milestones.map((milestone: string, index: number) => (
                      <li key={index} className="flex items-start text-sm text-gray-700">
                        <span className="inline-block w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold mr-2 mt-0.5 flex-shrink-0">
                          {index + 1}
                        </span>
                        <span className="leading-relaxed">{milestone}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Session Recordings */}
        {(session.audio_recording_url || session.video_recording_url || audioLoading || audioError) && (
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{t('sessionRecordings')}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {session.recording_preference === 'audio' && t('audioOnly')}
                {session.recording_preference === 'audio_video' && t('audioVideoRecording')}
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Audio Loading State */}
              {audioLoading && (
                <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                  <div className="flex items-center mb-3">
                    <Volume2 className="w-5 h-5 text-blue-600 mr-2" />
                    <h3 className="font-medium text-gray-900">{t('audioRecording')}</h3>
                    <div className="ml-2 flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span className="text-sm text-blue-600 ml-2">{t('loadingAudio')}</span>
                    </div>
                  </div>
                  <p className="text-sm text-blue-700">
                    {t('fetchingAudio')}
                  </p>
                </div>
              )}

              {/* Audio Error State */}
              {audioError && !audioLoading && (
                <div className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
                  <div className="flex items-center mb-3">
                    <Volume2 className="w-5 h-5 text-yellow-600 mr-2" />
                    <h3 className="font-medium text-gray-900">{t('audioRecording')}</h3>
                    <span className="text-sm text-yellow-600 ml-2">{t('audioNotYet')}</span>
                  </div>
                  <p className="text-sm text-yellow-700 mb-2">{audioError}</p>
                  <button
                    onClick={() => tryLoadMissingAudio(session)}
                    className="text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-3 py-1 rounded"
                  >
                    {t('tryAgain')}
                  </button>
                </div>
              )}

              {/* Audio Recording */}
              {session.audio_recording_url && (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <Volume2 className="w-5 h-5 text-blue-600 mr-2" />
                    <h3 className="font-medium text-gray-900">{t('audioRecording')}</h3>
                    {session.audio_file_size && (
                      <span className="text-xs text-gray-500 ml-2">
                        ({Math.round(session.audio_file_size / 1024)} KB)
                      </span>
                    )}
                  </div>
                  <audio
                    controls
                    className="w-full"
                    preload="metadata"
                  >
                    <source src={session.audio_recording_url} type="audio/webm" />
                    <source src={session.audio_recording_url} type="audio/mp4" />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}

              {/* Video Recording */}
              {session.video_recording_url && (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <Video className="w-5 h-5 text-blue-600 mr-2" />
                    <h3 className="font-medium text-gray-900">{t('videoRecording')}</h3>
                    {session.video_file_size && (
                      <span className="text-xs text-gray-500 ml-2">
                        ({Math.round(session.video_file_size / (1024 * 1024))} MB)
                      </span>
                    )}
                  </div>
                  <div className="flex justify-center">
                    <VideoPlayerWithDuration
                      videoUrl={session.video_recording_url}
                      durationSeconds={session.recording_duration_seconds || session.session_duration_seconds || 0}
                      className="rounded max-h-[600px]"
                    />
                  </div>
                </div>
              )}

              {/* Recording Info */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center text-sm text-gray-600">
                  <Clock className="w-4 h-4 mr-2" />
                  <span>{t('recordingDuration')}: {trainingSessionsService.formatDuration(session.recording_duration_seconds || 0)}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {t('recordedOn', {
                    date: formatDate(session.recording_consent_timestamp || session.started_at),
                    time: formatTime(session.recording_consent_timestamp || session.started_at)
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No Recording Message */}
        {session.recording_preference === 'none' && (
          <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 mb-6">
            <div className="p-6 text-center">
              <div className="text-gray-400 text-3xl mb-2">🚫</div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">{t('noRecording')}</h3>
              <p className="text-xs text-gray-500">
                {t('noRecordingDescription')}
              </p>
            </div>
          </div>
        )}


        {/* Tabbed Interface for Sessions with Analysis (Service Practice or Theory) */}
        {((servicePracticeAssessment && session.training_mode === 'service_practice') ||
          (transcriptAnalysis && session.training_mode === 'theory')) ? (
          <div className="bg-white rounded-lg shadow">
            {/* Tab Headers */}
            <div className="border-b border-gray-200">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('transcript')}
                  className={`flex-1 px-6 py-4 text-sm transition-colors ${
                    activeTab === 'transcript'
                      ? 'text-gray-900 font-bold border-b-2 border-gray-900 bg-white'
                      : 'text-gray-500 font-normal bg-gray-50 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  📝 {t('tabTranscript')} ({t('messagesCount', { count: session.conversation_transcript.length })})
                </button>
                <button
                  onClick={() => setActiveTab('analysis')}
                  className={`flex-1 px-6 py-4 text-sm transition-colors ${
                    activeTab === 'analysis'
                      ? 'text-gray-900 font-bold border-b-2 border-gray-900 bg-white'
                      : 'text-gray-500 font-normal bg-gray-50 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  📊 {session.training_mode === 'theory' ? t('tabTheoryAssessment') : t('tabAnalysis')}
                </button>
              </div>
            </div>

            {/* Tab Content: Transcript */}
            {activeTab === 'transcript' && (
              <div>
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">{t('conversationTranscript')}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {t('messagesExchanged', { count: session.conversation_transcript.length })}
                  </p>
                </div>

          <div className="p-6">
            {session.conversation_transcript.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 text-4xl mb-4">💬</div>
                <p className="text-gray-500">{t('noConversation')}</p>
              </div>
            ) : session.conversation_transcript.length === 1 &&
                session.conversation_transcript[0].content.includes('Get Transcript and Analysis') &&
                !transcriptAnalysis ? (
              /* Show buttons when transcript contains placeholder message and no cached results */
              <div className="text-center py-8">
                <div className="text-blue-600 text-4xl mb-4">📊</div>
                <p className="text-gray-600 mb-4">
                  {t('analysisActions.fetchPrompt')}
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <button
                    onClick={handleGetTranscript}
                    disabled={isFetchingTranscript || !session.elevenlabs_conversation_id}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isFetchingTranscript ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {t('analysisActions.fetchingTranscript')}
                      </>
                    ) : (
                      <>
                        📝 {t('analysisActions.getTranscript')}
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleRunAnalysis}
                    disabled={isAnalyzingTranscript || !session.elevenlabs_conversation_id}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isAnalyzingTranscript ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {t('analysisActions.runningAnalysis')}
                      </>
                    ) : (
                      <>
                        🧪 {t('analysisActions.getAnalysis')}
                      </>
                    )}
                  </button>
                </div>
                {!session.elevenlabs_conversation_id && (
                  <p className="text-red-500 text-sm mt-2">
                    {t('analysisActions.noConversationId')}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {session.conversation_transcript.map((message: any, index) => {
                  const isAssistant = message.role === 'assistant'
                  const isSystem = message.role === 'system'
                  // Support both 'content' and 'message' field names
                  const messageText = message.content || message.message || ''
                  const hasTimestamp = message.timestamp !== undefined && message.timestamp !== null

                  return (
                    <div
                      key={index}
                      className={`flex ${isAssistant ? 'justify-start' : isSystem ? 'justify-center' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-lg px-4 py-3 ${
                          isAssistant
                            ? 'bg-gray-100 text-gray-900'
                            : isSystem
                            ? 'bg-blue-50 text-blue-900 border border-blue-200'
                            : 'bg-green-100 text-gray-900'
                        }`}
                      >
                        <p className="text-sm leading-relaxed">
                          {messageText}
                        </p>
                        {hasTimestamp && (
                          <p className="text-xs text-gray-500 mt-1">
                            {formatConversationTimestamp(message.timestamp)}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Analysis Actions for existing transcripts */}
          {session.conversation_transcript.length > 1 &&
           (session.training_mode === 'theory' || session.training_mode === 'service_practice') &&
           !transcriptAnalysis && !servicePracticeAssessment && (
            <div className="mt-6 p-4 bg-gray-50 border-t">
              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  {t('analysisActions.runAnalysisPrompt', { mode: getTrainingModeDisplay(session.training_mode).toLowerCase() })}
                </p>
                <button
                  onClick={() => handleRunAnalysis(false)}
                  disabled={isAnalyzingTranscript}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isAnalyzingTranscript ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {t('analysisActions.runningAnalysis')}
                    </>
                  ) : (
                    <>
                      🧪 {t('analysisActions.runAnalysis')}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
              </div>
            )}

            {/* Tab Content: Analysis */}
            {activeTab === 'analysis' && (
              <div className="p-6 space-y-6">
                {/* Service Practice Assessment */}
                {session.training_mode === 'service_practice' && servicePracticeAssessment && (
                  <>
                    {/* Header with Language Selector and Redo Analysis button */}
                    <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900">{t('servicePractice.title')}</h3>
                      <div className="flex items-center gap-3">
                        {session?.service_assessment_status === 'completed' && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            📋 {t('servicePractice.cached')}
                          </span>
                        )}
                        {/* Language Selector */}
                        <select
                          value={selectedLanguage}
                          onChange={(e) => setSelectedLanguage(e.target.value as LanguageCode)}
                          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {SUPPORTED_LANGUAGES.map((lang) => (
                            <option key={lang.code} value={lang.code}>
                              {lang.flag} {lang.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleRunAnalysis(true)}
                          disabled={isAnalyzingTranscript}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          {isAnalyzingTranscript ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-600 mr-2"></div>
                              {t('servicePractice.analyzing')}
                            </>
                          ) : (
                            <>
                              🔄 {t('servicePractice.redoAnalysis')}
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {servicePracticeAssessment.manager_summary && (
                      <ManagerSummary
                        summary={servicePracticeAssessment.manager_summary}
                        overallScore={servicePracticeAssessment.overall_score}
                      />
                    )}

                    <PerformanceScoreCard
                      overallScore={servicePracticeAssessment.overall_score}
                      metrics={servicePracticeAssessment.metrics}
                      behavioralMetrics={servicePracticeAssessment.behavioral_metrics}
                    />

                    <MilestoneChecklist
                      milestones={servicePracticeAssessment.milestones_achieved}
                      completionRate={servicePracticeAssessment.metrics.milestone_completion_rate.score}
                    />

                    <FeedbackSection
                      strengths={servicePracticeAssessment.strengths}
                      improvements={servicePracticeAssessment.improvements}
                    />

                    <UnacceptablePhrases
                      phrases={servicePracticeAssessment.unacceptable_phrases || []}
                    />
                  </>
                )}

                {/* Theory Assessment Results */}
                {session.training_mode === 'theory' && transcriptAnalysis && (
                  <>
                    {/* Assessment Summary */}
                    {transcriptAnalysis.assessment?.summary && (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center">
                            <Brain className="w-6 h-6 text-blue-600 mr-3" />
                            <h3 className="text-lg font-semibold text-gray-900">{t('theoryAssessment.title')}</h3>
                          </div>
                          <div className="flex items-center gap-3">
                            {transcriptAnalysis.fromCache && (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                📋 {t('theoryAssessment.cached')}
                              </span>
                            )}
                            <button
                              onClick={() => handleRunAnalysis(true)}
                              disabled={isAnalyzingTranscript}
                              className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            >
                              {isAnalyzingTranscript ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-600 mr-2"></div>
                                  {t('theoryAssessment.analyzing')}
                                </>
                              ) : (
                                <>
                                  🔄 {t('theoryAssessment.redoAnalysis')}
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900">{transcriptAnalysis.assessment.summary.totalQuestions}</div>
                            <div className="text-sm text-gray-600">{t('theoryAssessment.questionsAssessed')}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">{transcriptAnalysis.assessment.summary.correctAnswers}</div>
                            <div className="text-sm text-gray-600">{t('theoryAssessment.correct')}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">{transcriptAnalysis.assessment.summary.incorrectAnswers}</div>
                            <div className="text-sm text-gray-600">{t('theoryAssessment.incorrect')}</div>
                          </div>
                          <div className="text-center">
                            <div className={`text-2xl font-bold ${
                              transcriptAnalysis.assessment.summary.score >= 80 ? 'text-green-600' :
                              transcriptAnalysis.assessment.summary.score >= 60 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {transcriptAnalysis.assessment.summary.score}%
                            </div>
                            <div className="text-sm text-gray-600">{t('theoryAssessment.overallScore')}</div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="font-medium">{t('theoryAssessment.accuracy')}</span>
                            <span>{transcriptAnalysis.assessment.summary.accuracy}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                transcriptAnalysis.assessment.summary.accuracy >= 80 ? 'bg-green-500' :
                                transcriptAnalysis.assessment.summary.accuracy >= 60 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${transcriptAnalysis.assessment.summary.accuracy}%` }}
                            />
                          </div>
                        </div>

                        {/* Performance Indicator */}
                        <div className={`p-3 rounded-lg border-2 ${
                          transcriptAnalysis.assessment.summary.score >= 80 ? 'bg-green-50 border-green-200' :
                          transcriptAnalysis.assessment.summary.score >= 60 ? 'bg-yellow-50 border-yellow-200' :
                          'bg-red-50 border-red-200'
                        }`}>
                          <div className="flex items-center">
                            {transcriptAnalysis.assessment.summary.score >= 80 ? (
                              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                            ) : transcriptAnalysis.assessment.summary.score >= 60 ? (
                              <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600 mr-2" />
                            )}
                            <div>
                              <div className={`font-medium ${
                                transcriptAnalysis.assessment.summary.score >= 80 ? 'text-green-600' :
                                transcriptAnalysis.assessment.summary.score >= 60 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {transcriptAnalysis.assessment.summary.score >= 80 ? t('theoryAssessment.excellentPerformance') :
                                 transcriptAnalysis.assessment.summary.score >= 60 ? t('theoryAssessment.goodPerformance') :
                                 t('theoryAssessment.needsImprovement')}
                              </div>
                              <div className="text-sm text-gray-600">
                                {transcriptAnalysis.assessment.summary.score >= 80
                                  ? t('theoryAssessment.excellentMessage')
                                  : transcriptAnalysis.assessment.summary.score >= 60
                                  ? t('theoryAssessment.goodMessage')
                                  : t('theoryAssessment.needsImprovementMessage')}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Detailed Question Results */}
                    {transcriptAnalysis.assessment?.assessmentResults && transcriptAnalysis.assessment.assessmentResults.length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">{t('theoryAssessment.questionResults')}</h4>

                        <div className="space-y-4">
                          {transcriptAnalysis.assessment.assessmentResults.map((result: any, index: number) => (
                            <div
                              key={`${result.questionId || 'q'}-${index}`}
                              className={`border-2 rounded-lg p-4 ${
                                result.score >= 80 ? 'bg-green-50 border-green-200' :
                                result.score >= 60 ? 'bg-yellow-50 border-yellow-200' :
                                'bg-red-50 border-red-200'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center mb-2">
                                    {result.isCorrect ? (
                                      <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                                    ) : (
                                      <XCircle className="w-5 h-5 text-red-600 mr-2" />
                                    )}
                                    <span className="font-medium text-gray-900">
                                      {t('theoryAssessment.question')} {index + 1}
                                    </span>
                                    {result.topicName && (
                                      <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                                        result.topicCategory === 'prices' ? 'bg-green-100 text-green-800' :
                                        result.topicCategory === 'drinks_info' ? 'bg-blue-100 text-blue-800' :
                                        result.topicCategory === 'manual' ? 'bg-yellow-100 text-yellow-800' :
                                        result.topicCategory === 'menu' ? 'bg-purple-100 text-purple-800' :
                                        result.topicCategory === 'procedures' ? 'bg-indigo-100 text-indigo-800' :
                                        result.topicCategory === 'policies' ? 'bg-red-100 text-red-800' :
                                        'bg-gray-100 text-gray-800'
                                      }`}>
                                        {result.topicName}
                                      </span>
                                    )}
                                    {result.difficultyLevel && (
                                      <span className="ml-2 flex items-center text-sm text-gray-600">
                                        <Target className="w-4 h-4 mr-1" />
                                        {t('theoryAssessment.level')} {result.difficultyLevel}/3
                                      </span>
                                    )}
                                  </div>

                                  <div className="mb-2">
                                    <div className="text-sm text-gray-600 mb-1">{t('theoryAssessment.questionPrompt')}</div>
                                    <div className="text-gray-900">{result.questionAsked}</div>
                                  </div>

                                  <div className="mb-2">
                                    <div className="text-sm text-gray-600 mb-1">{t('theoryAssessment.yourAnswer')}</div>
                                    <div className={`${result.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                                      {result.userAnswer}
                                    </div>
                                  </div>

                                  <div className="mb-2">
                                    <div className="text-sm text-gray-600 mb-1">{t('theoryAssessment.correctAnswer')}</div>
                                    <div className="text-gray-900">{result.correctAnswer}</div>
                                  </div>

                                  {result.feedback && (
                                    <div className="mb-2">
                                      <div className="text-sm text-gray-600 mb-1">{t('theoryAssessment.feedback')}</div>
                                      <div className="text-gray-700">{result.feedback}</div>
                                    </div>
                                  )}
                                </div>

                                <div className="ml-4 text-right">
                                  <div className={`text-lg font-bold ${
                                    result.score >= 80 ? 'text-green-600' :
                                    result.score >= 60 ? 'text-yellow-600' :
                                    'text-red-600'
                                  }`}>
                                    {result.score}%
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Transcript Stats */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 {t('theoryAssessment.conversationAnalysis')}</h3>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {transcriptAnalysis.transcriptAnalysis?.totalMessages || 0}
                          </div>
                          <div className="text-sm text-gray-600">{t('theoryAssessment.totalMessages')}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {transcriptAnalysis.transcriptAnalysis?.qaPairsFound || 0}
                          </div>
                          <div className="text-sm text-gray-600">{t('theoryAssessment.qaPairsFound')}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">
                            {Math.round(((transcriptAnalysis.transcriptAnalysis?.userMessages || 0) + (transcriptAnalysis.transcriptAnalysis?.assistantMessages || 0)) / 2 * 10) / 10}
                          </div>
                          <div className="text-sm text-gray-600">{t('theoryAssessment.avgMessagesPerTurn')}</div>
                        </div>
                      </div>

                      {/* User/Assistant Message Breakdown */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-3">💬 {t('theoryAssessment.messageBreakdown')}</h4>
                        <div className="flex justify-between text-sm">
                          <span>{t('theoryAssessment.yourMessages')} <strong>{transcriptAnalysis.transcriptAnalysis?.userMessages || 0}</strong></span>
                          <span>{t('theoryAssessment.aiTrainerMessages')} <strong>{transcriptAnalysis.transcriptAnalysis?.assistantMessages || 0}</strong></span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Regular Transcript View (no analysis or not Service Practice) */
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{t('conversationTranscript')}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {t('messagesExchanged', { count: session.conversation_transcript.length })}
              </p>
            </div>

            <div className="p-6">
              {session.conversation_transcript.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-4xl mb-4">💬</div>
                  <p className="text-gray-500">{t('noConversation')}</p>
                </div>
              ) : session.conversation_transcript.length === 1 &&
                  session.conversation_transcript[0].content.includes('Get Transcript and Analysis') &&
                  !transcriptAnalysis && !servicePracticeAssessment ? (
                /* Show buttons when transcript contains placeholder message and no cached results */
                <div className="text-center py-8">
                  <div className="text-blue-600 text-4xl mb-4">📊</div>
                  <p className="text-gray-600 mb-4">
                    {t('analysisActions.fetchPrompt')}
                  </p>
                  <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <button
                      onClick={handleGetTranscript}
                      disabled={isFetchingTranscript || !session.elevenlabs_conversation_id}
                      className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isFetchingTranscript ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          {t('analysisActions.fetchingTranscript')}
                        </>
                      ) : (
                        <>
                          📝 {t('analysisActions.getTranscript')}
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleRunAnalysis}
                      disabled={isAnalyzingTranscript || !session.elevenlabs_conversation_id}
                      className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isAnalyzingTranscript ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          {t('analysisActions.runningAnalysis')}
                        </>
                      ) : (
                        <>
                          🧪 {t('analysisActions.getAnalysis')}
                        </>
                      )}
                    </button>
                  </div>
                  {!session.elevenlabs_conversation_id && (
                    <p className="text-red-500 text-sm mt-2">
                      {t('analysisActions.noConversationId')}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {session.conversation_transcript.map((message: any, index) => {
                    const isAssistant = message.role === 'assistant'
                    const isSystem = message.role === 'system'
                    // Support both 'content' and 'message' field names
                    const messageText = message.content || message.message || ''
                    const hasTimestamp = message.timestamp !== undefined && message.timestamp !== null

                    return (
                      <div
                        key={index}
                        className={`flex ${isAssistant ? 'justify-start' : isSystem ? 'justify-center' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-lg px-4 py-3 ${
                            isAssistant
                              ? 'bg-gray-100 text-gray-900'
                              : isSystem
                              ? 'bg-blue-50 text-blue-900 border border-blue-200'
                              : 'bg-green-100 text-gray-900'
                          }`}
                        >
                          <p className="text-sm leading-relaxed">
                            {messageText}
                          </p>
                          {hasTimestamp && (
                            <p className="text-xs text-gray-500 mt-1">
                              {formatConversationTimestamp(message.timestamp)}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Analysis Actions for existing transcripts */}
            {session.conversation_transcript.length > 1 &&
             (session.training_mode === 'theory' || session.training_mode === 'service_practice') &&
             !transcriptAnalysis && !servicePracticeAssessment && (
              <div className="mt-6 p-4 bg-gray-50 border-t">
                <div className="text-center">
                  <p className="text-gray-600 mb-4">
                    {t('analysisActions.runAnalysisPrompt', { mode: getTrainingModeDisplay(session.training_mode, t).toLowerCase() })}
                  </p>
                  <button
                    onClick={() => handleRunAnalysis(false)}
                    disabled={isAnalyzingTranscript}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isAnalyzingTranscript ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {t('analysisActions.runningAnalysis')}
                      </>
                    ) : (
                      <>
                        🧪 {t('analysisActions.runAnalysis')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-center space-x-4">
          <button
            onClick={() => router.push('/employee')}
            className="bg-gray-100 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-200"
          >
            {t('backToDashboard')}
          </button>
          <button
            onClick={() => router.push('/employee/history')}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            {t('viewAllSessions')}
          </button>
        </div>
      </div>
    </div>
  )
}
