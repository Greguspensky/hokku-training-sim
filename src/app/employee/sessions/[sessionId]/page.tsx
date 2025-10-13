'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Clock, User, Bot, Calendar, Globe, Brain, Play, Pause, Volume2, Video, CheckCircle, XCircle, AlertCircle, Target } from 'lucide-react'
import { trainingSessionsService, type TrainingSession } from '@/lib/training-sessions'
import { useAuth } from '@/contexts/AuthContext'
import UserHeader from '@/components/UserHeader'
import { getEmotionDisplay } from '@/lib/customer-emotions'
import { getVoiceName } from '@/lib/elevenlabs-voices'

export default function SessionTranscriptPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [session, setSession] = useState<TrainingSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [isAnalyzingTranscript, setIsAnalyzingTranscript] = useState(false)
  const [isFetchingTranscript, setIsFetchingTranscript] = useState(false)
  const [transcriptAnalysis, setTranscriptAnalysis] = useState<any>(null)
  const [scenarioDetails, setScenarioDetails] = useState<any>(null)
  const [loadingScenario, setLoadingScenario] = useState(false)

  const sessionId = params.sessionId as string

  useEffect(() => {
    console.log('🔄 Session page useEffect - sessionId:', sessionId, 'user:', !!user)
    if (!sessionId || !user) {
      console.log('⏸️ Waiting for sessionId and user...')
      return
    }

    loadSession()
  }, [sessionId, user])

  const loadSession = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('📖 Loading training session transcript:', sessionId)
      const sessionData = await trainingSessionsService.getSessionById(sessionId)

      if (!sessionData) {
        setError('Training session not found')
        return
      }

      // Verify user has access to this session (always use auth user ID for consistency)
      const employeeId = user?.id
      console.log('🔐 Access check - Session employee_id:', sessionData.employee_id, 'User ID:', employeeId)

      if (sessionData.employee_id !== employeeId) {
        console.error('❌ Access denied - IDs do not match')
        setError('Access denied: This session belongs to another user')
        return
      }

      console.log('✅ Access granted')

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
        console.log('✅ Cached assessment results loaded successfully:', cachedResults)
      } else {
        console.log('🔍 No cached results found:')
        console.log('  - assessment_status:', sessionData.assessment_status)
        console.log('  - theory_assessment_results:', !!sessionData.theory_assessment_results)
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
        setScenarioDetails(data)
        console.log('✅ Scenario details loaded:', data)
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
      const response = await fetch('/api/elevenlabs-conversation-audio', {
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
      const response = await fetch('/api/elevenlabs-conversation-transcript', {
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
        console.log('✅ Analysis completed successfully')

        // Refresh the session to get the updated transcript
        await loadSession()
      } else {
        console.error('❌ Analysis failed:', result.error)
        alert(`Failed to run analysis: ${result.error}`)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading transcript...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Session</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/employee')}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Back to Dashboard
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Session Not Found</h2>
          <p className="text-gray-600 mb-4">The requested training session could not be found.</p>
          <button
            onClick={() => router.push('/employee')}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <UserHeader
          title="Training Session Transcript"
          subtitle={session.session_name}
        />

        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/employee')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>
        </div>

        {/* Session Metadata */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Session Details</h2>

          {/* Session and Attempt IDs */}
          <div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="font-medium text-gray-700">Session ID:</span>
                <div className="mt-1 font-mono text-gray-600 break-all">{session.id}</div>
              </div>
              {session.scenario_id && (
                <div>
                  <span className="font-medium text-gray-700">Attempt ID:</span>
                  <div className="mt-1 font-mono text-gray-600 break-all">{session.scenario_id}</div>
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
                <div className="text-xs text-gray-500">Duration</div>
              </div>
            </div>
            <div className="flex items-center">
              <Brain className="w-5 h-5 text-gray-400 mr-3" />
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {session.training_mode === 'theory' ? 'Theory Q&A' : 'Service Practice'}
                </div>
                <div className="text-xs text-gray-500">Training Mode</div>
              </div>
            </div>
            <div className="flex items-center">
              <Globe className="w-5 h-5 text-gray-400 mr-3" />
              <div>
                <div className="text-sm font-medium text-gray-900">{session.language.toUpperCase()}</div>
                <div className="text-xs text-gray-500">Language</div>
              </div>
            </div>
          </div>
        </div>

        {/* ElevenLabs AI Agent Settings */}
        {session.training_mode === 'service_practice' && scenarioDetails && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg shadow mb-6 border border-purple-200">
            <div className="p-6 border-b border-purple-200 bg-white bg-opacity-60">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                🤖 ElevenLabs AI Agent Settings
              </h2>
              <p className="text-sm text-gray-600 mt-1">Configuration used for this training session</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Character Role */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-start mb-2">
                  <span className="text-lg mr-2">🎭</span>
                  <h3 className="font-semibold text-gray-900">Character Role</h3>
                </div>
                <p className="text-sm text-gray-700">
                  Customer in Roleplay - Will act according to scenario behavior
                </p>
              </div>

              {/* Two-column layout for Scenario Context and AI Voice */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Scenario Context */}
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start mb-2">
                    <span className="text-lg mr-2">📋</span>
                    <h3 className="font-semibold text-gray-900">Scenario Context</h3>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {scenarioDetails.title || 'No scenario context available'}
                  </p>
                </div>

                {/* AI Voice */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-start mb-2">
                    <span className="text-lg mr-2">🎤</span>
                    <h3 className="font-semibold text-gray-900">AI Voice</h3>
                  </div>
                  <div>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium text-blue-700">
                        {scenarioDetails.voice_id ? getVoiceName(scenarioDetails.voice_id) : 'Unknown Voice'}
                      </span>
                      {scenarioDetails.voice_id === 'random' && (
                        <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                          Randomly Selected
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {scenarioDetails.voice_id === 'random'
                        ? `The system has randomly selected ${getVoiceName(scenarioDetails.voice_id)} for this session. Reload the page to try a different voice.`
                        : `The AI used the ${getVoiceName(scenarioDetails.voice_id)} voice for this session`
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
                    <h3 className="font-semibold text-gray-900">Customer Emotion Level</h3>
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
                        ? 'The customer is polite and patient. Maintain professionalism and friendly service.'
                        : scenarioDetails.customer_emotion_level === 'frustrated'
                        ? 'The customer is impatient and needs quick resolution. Show efficiency and acknowledge their time pressure.'
                        : scenarioDetails.customer_emotion_level === 'angry'
                        ? 'The customer is very upset and demanding. Provide genuine empathy and concrete solutions.'
                        : 'The customer is furious and confrontational. Requires exceptional empathy and above-and-beyond service.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Customer Behavior */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-start mb-2">
                  <span className="text-lg mr-2">😤</span>
                  <h3 className="font-semibold text-gray-900">Customer Behavior</h3>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {scenarioDetails.client_behavior || 'No customer behavior defined'}
                </p>
              </div>

              {/* Expected Employee Response */}
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-start mb-2">
                  <span className="text-lg mr-2">✅</span>
                  <h3 className="font-semibold text-gray-900">Expected Employee Response</h3>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {scenarioDetails.expected_response || 'No expected response defined'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Session Recordings */}
        {(session.audio_recording_url || session.video_recording_url || audioLoading || audioError) && (
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Session Recordings</h2>
              <p className="text-sm text-gray-500 mt-1">
                {session.recording_preference === 'audio' && 'Audio recording of this training session'}
                {session.recording_preference === 'audio_video' && 'Audio and screen recording of this training session'}
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Audio Loading State */}
              {audioLoading && (
                <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                  <div className="flex items-center mb-3">
                    <Volume2 className="w-5 h-5 text-blue-600 mr-2" />
                    <h3 className="font-medium text-gray-900">Audio Recording</h3>
                    <div className="ml-2 flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span className="text-sm text-blue-600 ml-2">Loading audio...</span>
                    </div>
                  </div>
                  <p className="text-sm text-blue-700">
                    Fetching conversation audio from ElevenLabs. This may take a moment.
                  </p>
                </div>
              )}

              {/* Audio Error State */}
              {audioError && !audioLoading && (
                <div className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
                  <div className="flex items-center mb-3">
                    <Volume2 className="w-5 h-5 text-yellow-600 mr-2" />
                    <h3 className="font-medium text-gray-900">Audio Recording</h3>
                    <span className="text-sm text-yellow-600 ml-2">Not available yet</span>
                  </div>
                  <p className="text-sm text-yellow-700 mb-2">{audioError}</p>
                  <button
                    onClick={() => tryLoadMissingAudio(session)}
                    className="text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-3 py-1 rounded"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Audio Recording */}
              {session.audio_recording_url && (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <Volume2 className="w-5 h-5 text-blue-600 mr-2" />
                    <h3 className="font-medium text-gray-900">Audio Recording</h3>
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
                    <h3 className="font-medium text-gray-900">Screen Recording</h3>
                    {session.video_file_size && (
                      <span className="text-xs text-gray-500 ml-2">
                        ({Math.round(session.video_file_size / (1024 * 1024))} MB)
                      </span>
                    )}
                  </div>
                  <div className="flex justify-center">
                    <video
                      controls
                      className="rounded max-h-[600px]"
                      style={{ maxWidth: '100%', height: 'auto' }}
                      preload="metadata"
                    >
                      <source src={session.video_recording_url} type="video/webm" />
                      <source src={session.video_recording_url} type="video/mp4" />
                      Your browser does not support the video element.
                    </video>
                  </div>
                </div>
              )}

              {/* Recording Info */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center text-sm text-gray-600">
                  <Clock className="w-4 h-4 mr-2" />
                  <span>Recording duration: {trainingSessionsService.formatDuration(session.recording_duration_seconds || 0)}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Recorded on {formatDate(session.recording_consent_timestamp || session.started_at)} at {formatTime(session.recording_consent_timestamp || session.started_at)}
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
              <h3 className="text-sm font-medium text-gray-900 mb-1">No Recording</h3>
              <p className="text-xs text-gray-500">
                No recording was made for this session as per your privacy preference.
              </p>
            </div>
          </div>
        )}


        {/* Conversation Transcript */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Conversation Transcript</h2>
            <p className="text-sm text-gray-500 mt-1">
              {session.conversation_transcript.length} messages exchanged during this session
            </p>
          </div>

          <div className="p-6">
            {session.conversation_transcript.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 text-4xl mb-4">💬</div>
                <p className="text-gray-500">No conversation was recorded in this session.</p>
              </div>
            ) : session.conversation_transcript.length === 1 &&
                session.conversation_transcript[0].content.includes('Get Transcript and Analysis') &&
                !transcriptAnalysis ? (
              /* Show buttons when transcript contains placeholder message and no cached results */
              <div className="text-center py-8">
                <div className="text-blue-600 text-4xl mb-4">📊</div>
                <p className="text-gray-600 mb-4">
                  This session transcript needs to be fetched from ElevenLabs.
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
                        Fetching Transcript...
                      </>
                    ) : (
                      <>
                        📝 Get Transcript
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
                        Running Analysis...
                      </>
                    ) : (
                      <>
                        🧪 Get Analysis
                      </>
                    )}
                  </button>
                </div>
                {!session.elevenlabs_conversation_id && (
                  <p className="text-red-500 text-sm mt-2">
                    No ElevenLabs conversation ID found for this session.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {session.conversation_transcript.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div className="flex items-center mb-1">
                        {message.role === 'user' ? (
                          <User className="w-4 h-4 mr-2" />
                        ) : (
                          <Bot className="w-4 h-4 mr-2" />
                        )}
                        <span className="text-xs font-medium">
                          {message.role === 'user' ? 'You' : 'AI Trainer'}
                        </span>
                        <span className="text-xs opacity-70 ml-2">
                          {formatTimestamp(message.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm">{message.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Analysis Actions for existing transcripts */}
          {session.conversation_transcript.length > 1 &&
           session.training_mode === 'theory' &&
           !transcriptAnalysis && (
            <div className="mt-6 p-4 bg-gray-50 border-t">
              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  Run analysis on this theory session to get detailed assessment results.
                </p>
                <button
                  onClick={() => handleRunAnalysis(false)}
                  disabled={isAnalyzingTranscript}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isAnalyzingTranscript ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Running Analysis...
                    </>
                  ) : (
                    <>
                      🧪 Run Analysis
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Theory Assessment Results */}
        {transcriptAnalysis && session.training_mode === 'theory' && (
          <div className="space-y-6 mt-6">
            {/* Assessment Summary */}
            {transcriptAnalysis.assessment?.summary && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <Brain className="w-6 h-6 text-blue-600 mr-3" />
                    <h3 className="text-lg font-semibold text-gray-900">Theory Assessment Results</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    {transcriptAnalysis.fromCache && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        📋 Cached
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
                          Analyzing...
                        </>
                      ) : (
                        <>
                          🔄 Redo Analysis
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{transcriptAnalysis.assessment.summary.totalQuestions}</div>
                    <div className="text-sm text-gray-600">Questions Assessed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{transcriptAnalysis.assessment.summary.correctAnswers}</div>
                    <div className="text-sm text-gray-600">Correct</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{transcriptAnalysis.assessment.summary.incorrectAnswers}</div>
                    <div className="text-sm text-gray-600">Incorrect</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${
                      transcriptAnalysis.assessment.summary.score >= 80 ? 'text-green-600' :
                      transcriptAnalysis.assessment.summary.score >= 60 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {transcriptAnalysis.assessment.summary.score}%
                    </div>
                    <div className="text-sm text-gray-600">Overall Score</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">Accuracy</span>
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
                        {transcriptAnalysis.assessment.summary.score >= 80 ? 'Excellent Performance' :
                         transcriptAnalysis.assessment.summary.score >= 60 ? 'Good Performance' :
                         'Needs Improvement'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {transcriptAnalysis.assessment.summary.score >= 80
                          ? 'Great job! You demonstrated strong knowledge.'
                          : transcriptAnalysis.assessment.summary.score >= 60
                          ? 'Good work! Review the incorrect answers for improvement.'
                          : 'Consider reviewing the material and practicing more questions.'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Detailed Question Results */}
            {transcriptAnalysis.assessment?.assessmentResults && transcriptAnalysis.assessment.assessmentResults.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Question-by-Question Results</h4>

                <div className="space-y-4">
                  {transcriptAnalysis.assessment.assessmentResults.map((result, index) => (
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
                              Question {index + 1}
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
                                Level {result.difficultyLevel}/3
                              </span>
                            )}
                          </div>

                          <div className="mb-2">
                            <div className="text-sm text-gray-600 mb-1">Question:</div>
                            <div className="text-gray-900">{result.questionAsked}</div>
                          </div>

                          <div className="mb-2">
                            <div className="text-sm text-gray-600 mb-1">Your Answer:</div>
                            <div className={`${result.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                              {result.userAnswer}
                            </div>
                          </div>

                          <div className="mb-2">
                            <div className="text-sm text-gray-600 mb-1">Correct Answer:</div>
                            <div className="text-gray-900">{result.correctAnswer}</div>
                          </div>

                          {result.feedback && (
                            <div className="mb-2">
                              <div className="text-sm text-gray-600 mb-1">Feedback:</div>
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
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Conversation Analysis</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {transcriptAnalysis.transcriptAnalysis?.totalMessages || 0}
                  </div>
                  <div className="text-sm text-gray-600">Total Messages</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {transcriptAnalysis.transcriptAnalysis?.qaPairsFound || 0}
                  </div>
                  <div className="text-sm text-gray-600">Q&A Pairs Found</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round(((transcriptAnalysis.transcriptAnalysis?.userMessages || 0) + (transcriptAnalysis.transcriptAnalysis?.assistantMessages || 0)) / 2 * 10) / 10}
                  </div>
                  <div className="text-sm text-gray-600">Avg Messages/Turn</div>
                </div>
              </div>

              {/* User/Assistant Message Breakdown */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">💬 Message Breakdown</h4>
                <div className="flex justify-between text-sm">
                  <span>👤 Your messages: <strong>{transcriptAnalysis.transcriptAnalysis?.userMessages || 0}</strong></span>
                  <span>🤖 AI Trainer messages: <strong>{transcriptAnalysis.transcriptAnalysis?.assistantMessages || 0}</strong></span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-center space-x-4">
          <button
            onClick={() => router.push('/employee')}
            className="bg-gray-100 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-200"
          >
            Back to Dashboard
          </button>
          <button
            onClick={() => router.push('/employee/history')}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            View All Sessions
          </button>
        </div>
      </div>
    </div>
  )
}