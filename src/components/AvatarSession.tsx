'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  AvatarSession as AvatarSessionType,
  GeneratedQuestion,
  TranscriptEntry,
  SupportedLanguageCode,
  SUPPORTED_LANGUAGES
} from '@/lib/avatar-types'

interface AvatarSessionProps {
  assignmentId: string
  scenarioId: string
  employeeId: string
  companyId: string
  onExit: () => void
}

export default function AvatarSession({
  assignmentId,
  scenarioId,
  employeeId,
  companyId,
  onExit
}: AvatarSessionProps) {
  const router = useRouter()

  // Session state
  const [session, setSession] = useState<AvatarSessionType | null>(null)
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [language, setLanguage] = useState<SupportedLanguageCode>('en')

  // UI state
  const [isLoading, setIsLoading] = useState(true)
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Recording state
  const [isRecordingVideo, setIsRecordingVideo] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [enableCamera, setEnableCamera] = useState(false)

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  // Session stats
  const [sessionStats, setSessionStats] = useState({
    questionsAsked: 0,
    responsesReceived: 0,
    sessionDuration: 0
  })

  const startTime = useRef<Date | null>(null)

  useEffect(() => {
    initializeSession()
    return () => {
      cleanup()
    }
  }, [])

  const initializeSession = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Generate questions for the session
      console.log('🤖 Generating questions for avatar session...')
      const questionsResponse = await fetch('/api/ai/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          scenario_id: scenarioId,
          question_count: 8, // Generate more questions for avatar sessions
          difficulty: 'mixed',
          language: language
        })
      })

      if (!questionsResponse.ok) {
        throw new Error('Failed to generate questions')
      }

      const questionsData = await questionsResponse.json()
      if (!questionsData.success || !questionsData.questions) {
        throw new Error('No questions generated')
      }

      setQuestions(questionsData.questions)

      // Create avatar session
      const sessionResponse = await fetch('/api/avatar-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignmentId,
          scenario_id: scenarioId,
          employee_id: employeeId,
          language: language
        })
      })

      if (!sessionResponse.ok) {
        throw new Error('Failed to create avatar session')
      }

      const sessionData = await sessionResponse.json()
      if (!sessionData.success) {
        throw new Error('Avatar session creation failed')
      }

      setSession(sessionData.session)
      startTime.current = new Date()

      console.log('✅ Avatar session initialized:', sessionData.session.id)

    } catch (error) {
      console.error('❌ Session initialization failed:', error)
      setError(error instanceof Error ? error.message : 'Failed to initialize session')
    } finally {
      setIsLoading(false)
    }
  }

  const startSession = async () => {
    try {
      setError(null)

      // Setup recording - this is required for proper avatar interaction
      console.log('🎥 Setting up microphone for avatar training...')
      try {
        await setupRecording()
        console.log('✅ Recording setup successful')
      } catch (recordingError) {
        console.error('❌ Recording setup failed:', recordingError)
        const errorMessage = recordingError instanceof Error ? recordingError.message : 'Failed to access microphone'
        if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
          setError('🎤 Microphone access is required for avatar training. Please allow microphone permissions and reload the page.')
        } else {
          setError(`🎤 Unable to access microphone: ${errorMessage}`)
        }
        return // Don't start session without microphone
      }

      // Start with the first question
      console.log('🚀 Setting session active and asking first question')
      setIsSessionActive(true)

      // Call askQuestion directly but modify the function to check
      await askQuestionDirect(0)

    } catch (error) {
      console.error('❌ Failed to start session:', error)
      setError(error instanceof Error ? error.message : 'Failed to start session')
    }
  }

  const setupRecording = async () => {
    try {
      const recordingType = enableCamera ? 'video' : 'audio'
      console.log(`🎥 Setting up ${recordingType} recording...`)

      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      }

      // Only request video if camera is enabled
      if (enableCamera) {
        constraints.video = {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      // Setup video preview only if camera is enabled
      if (enableCamera && videoRef.current) {
        videoRef.current.srcObject = stream
      }

      // Setup MediaRecorder
      const mimeType = enableCamera
        ? (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4')
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4')

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType })

      const chunks: Blob[] = []

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType })
        const url = URL.createObjectURL(blob)
        setVideoUrl(url)
        console.log(`📹 ${recordingType} recording completed`)
      }

      setIsRecordingVideo(true)
      mediaRecorderRef.current.start()

      console.log(`✅ ${recordingType} recording started`)

    } catch (error) {
      console.error(`❌ ${enableCamera ? 'Video' : 'Audio'} setup failed:`, error)
      const fallbackMessage = enableCamera
        ? 'Camera access required for video recording. Try audio-only mode if camera is not available.'
        : 'Microphone access required for avatar training'
      throw new Error(fallbackMessage)
    }
  }

  const speakWithBrowserTTS = async (text: string, language: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Browser TTS not supported'))
        return
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel()

      // Wait for voices to be loaded if needed
      const speak = () => {
        const utterance = new SpeechSynthesisUtterance(text)

        // Set language
        utterance.lang = language === 'en' ? 'en-US' :
                        language === 'es' ? 'es-ES' :
                        language === 'fr' ? 'fr-FR' :
                        language === 'de' ? 'de-DE' :
                        language === 'it' ? 'it-IT' :
                        language === 'pt' ? 'pt-PT' :
                        language === 'nl' ? 'nl-NL' :
                        language === 'pl' ? 'pl-PL' :
                        language === 'ru' ? 'ru-RU' :
                        language === 'ka' ? 'ka-GE' :
                        language === 'ja' ? 'ja-JP' :
                        language === 'ko' ? 'ko-KR' :
                        language === 'zh' ? 'zh-CN' : 'en-US'

        // Configure voice settings
        utterance.rate = 0.9
        utterance.pitch = 1.0
        utterance.volume = 0.8

        // Try to find a voice that matches the language
        const voices = window.speechSynthesis.getVoices()
        console.log(`🎤 Found ${voices.length} voices available`)
        const matchingVoice = voices.find(voice => voice.lang.startsWith(language))
        if (matchingVoice) {
          utterance.voice = matchingVoice
          console.log(`✅ Using voice: ${matchingVoice.name} (${matchingVoice.lang})`)
        } else {
          console.log(`⚠️ No matching voice found for ${language}, using default`)
        }

        utterance.onend = () => {
          console.log('🗣️ Browser TTS finished speaking - onend triggered')
          setIsSpeaking(false)
          // Check if session is still active before continuing
          if (isSessionActive) {
            console.log('✅ Session active, starting to listen...')
            setTimeout(() => startListening(), 100) // Small delay to ensure state updates
          } else {
            console.log('⚠️ Session not active, skipping listen')
          }
          resolve()
        }

        utterance.onerror = (event) => {
          console.error('Browser TTS error:', event)
          setIsSpeaking(false)
          reject(new Error(`Browser TTS failed: ${event.error}`))
        }

        utterance.onstart = () => {
          console.log('🗣️ Browser TTS started speaking')
        }

        window.speechSynthesis.speak(utterance)
        console.log(`🗣️ Browser TTS speaking: "${text.substring(0, 50)}..." in ${language}`)
      }

      // Check if voices are loaded
      const voices = window.speechSynthesis.getVoices()
      if (voices.length === 0) {
        console.log('⏳ Waiting for voices to load...')
        window.speechSynthesis.onvoiceschanged = () => {
          console.log('🎤 Voices loaded, starting speech')
          speak()
        }
      } else {
        speak()
      }
    })
  }

  const askQuestionDirect = async (questionIndex: number) => {
    // Direct version that skips session check - used for initial question
    console.log(`🎯 Direct question call for index ${questionIndex}`)

    if (questionIndex >= questions.length) {
      await completeSession()
      return
    }

    const question = questions[questionIndex]
    setCurrentQuestionIndex(questionIndex)
    setIsSpeaking(true)

    try {
      // Add question to transcript
      const questionEntry: TranscriptEntry = {
        speaker: 'avatar',
        text: question.text,
        timestamp: new Date().toISOString()
      }

      await addTranscriptEntry(questionEntry)

      // Synthesize speech
      console.log(`🎤 Synthesizing question ${questionIndex + 1}: "${question.text.substring(0, 50)}..."`)

      const ttsResponse = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: question.text,
          language: language
        })
      })

      if (ttsResponse.ok) {
        const ttsData = await ttsResponse.json()
        if (ttsData.success && ttsData.audioData) {
          // Play the audio
          const audioBlob = new Blob([
            Uint8Array.from(atob(ttsData.audioData), c => c.charCodeAt(0))
          ], { type: 'audio/mpeg' })

          const audioUrl = URL.createObjectURL(audioBlob)
          const audio = new Audio(audioUrl)

          audio.onended = () => {
            URL.revokeObjectURL(audioUrl)
            setIsSpeaking(false)
            // Check if session is still active before continuing
            if (isSessionActive) {
              startListening()
            }
          }

          await audio.play()
        } else {
          throw new Error('TTS failed')
        }
      } else {
        console.warn('⚠️ ElevenLabs TTS failed, using browser TTS fallback')
        await speakWithBrowserTTS(question.text, language)
      }

      // Update stats
      setSessionStats(prev => ({
        ...prev,
        questionsAsked: prev.questionsAsked + 1
      }))

    } catch (error) {
      console.error('❌ Question synthesis failed:', error)
      console.warn('⚠️ Using browser TTS fallback')
      try {
        await speakWithBrowserTTS(question.text, language)
      } catch (fallbackError) {
        console.error('❌ Browser TTS also failed:', fallbackError)
        setIsSpeaking(false)
        startListening()
      }
    }
  }

  const askQuestion = async (questionIndex: number) => {
    // Check if session is still active
    if (!isSessionActive) {
      console.log('🛑 Session stopped, not asking question')
      return
    }

    if (questionIndex >= questions.length) {
      await completeSession()
      return
    }

    const question = questions[questionIndex]
    setCurrentQuestionIndex(questionIndex)
    setIsSpeaking(true)

    try {
      // Add question to transcript
      const questionEntry: TranscriptEntry = {
        speaker: 'avatar',
        text: question.text,
        timestamp: new Date().toISOString()
      }

      await addTranscriptEntry(questionEntry)

      // Synthesize speech
      console.log(`🎤 Synthesizing question ${questionIndex + 1}: "${question.text.substring(0, 50)}..."`)

      const ttsResponse = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: question.text,
          language: language
        })
      })

      if (ttsResponse.ok) {
        const ttsData = await ttsResponse.json()
        if (ttsData.success && ttsData.audioData) {
          // Play the audio
          const audioBlob = new Blob([
            Uint8Array.from(atob(ttsData.audioData), c => c.charCodeAt(0))
          ], { type: 'audio/mpeg' })

          const audioUrl = URL.createObjectURL(audioBlob)
          const audio = new Audio(audioUrl)

          audio.onended = () => {
            URL.revokeObjectURL(audioUrl)
            setIsSpeaking(false)
            // Check if session is still active before continuing
            if (isSessionActive) {
              startListening()
            }
          }

          await audio.play()
        } else {
          throw new Error('TTS failed')
        }
      } else {
        console.warn('⚠️ ElevenLabs TTS failed, using browser TTS fallback')
        await speakWithBrowserTTS(question.text, language)
      }

      // Update stats
      setSessionStats(prev => ({
        ...prev,
        questionsAsked: prev.questionsAsked + 1
      }))

    } catch (error) {
      console.error('❌ Question synthesis failed:', error)
      console.warn('⚠️ Using browser TTS fallback')
      try {
        await speakWithBrowserTTS(question.text, language)
      } catch (fallbackError) {
        console.error('❌ Browser TTS also failed:', fallbackError)
        setIsSpeaking(false)
        startListening()
      }
    }
  }

  const startListening = async () => {
    try {
      setIsListening(true)
      console.log('👂 Starting to listen for user response...')

      // Check if we have a media stream for recording
      if (!streamRef.current) {
        console.log('⚠️ No media stream available, simulating user response pause')
        // Simulate a pause for user response when recording isn't available
        setTimeout(() => {
          setIsListening(false)
          if (isSessionActive) {
            console.log('⏭️ Proceeding to next question (no recording available)')
            askQuestion(currentQuestionIndex + 1)
          }
        }, 5000) // Give user 5 seconds to "respond"
        return
      }

      // Record user audio for 10 seconds or until silence
      const audioResponse = await recordUserAudio()

      if (audioResponse && audioResponse.size > 0) {
        // Transcribe the audio
        const formData = new FormData()
        formData.append('audio', audioResponse, 'response.webm')
        formData.append('language', language)

        const sttResponse = await fetch('/api/stt', {
          method: 'POST',
          body: formData
        })

        if (sttResponse.ok) {
          const sttData = await sttResponse.json()
          if (sttData.success && sttData.transcription.text) {
            // Add user response to transcript
            const userEntry: TranscriptEntry = {
              speaker: 'user',
              text: sttData.transcription.text,
              timestamp: new Date().toISOString(),
              duration_ms: sttData.transcription.duration_ms
            }

            await addTranscriptEntry(userEntry)

            // Update stats
            setSessionStats(prev => ({
              ...prev,
              responsesReceived: prev.responsesReceived + 1
            }))

            console.log(`✅ User response: "${sttData.transcription.text}"`)

            // Move to next question after a brief pause
            setTimeout(() => {
              if (isSessionActive) {
                askQuestion(currentQuestionIndex + 1)
              }
            }, 1500)
          } else {
            console.log('⚠️ No speech detected, moving to next question')
            setTimeout(() => {
              if (isSessionActive) {
                askQuestion(currentQuestionIndex + 1)
              }
            }, 2000)
          }
        } else {
          throw new Error('STT API error')
        }
      } else {
        console.log('⚠️ No audio recorded, moving to next question')
        setTimeout(() => {
          if (isSessionActive) {
            askQuestion(currentQuestionIndex + 1)
          }
        }, 2000)
      }

    } catch (error) {
      console.error('❌ Listening failed:', error)
      // Continue to next question even if listening fails
      setTimeout(() => {
        if (isSessionActive) {
          askQuestion(currentQuestionIndex + 1)
        }
      }, 3000)
    } finally {
      setIsListening(false)
    }
  }

  const recordUserAudio = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!streamRef.current) {
        resolve(null)
        return
      }

      const audioTracks = streamRef.current.getAudioTracks()
      if (audioTracks.length === 0) {
        resolve(null)
        return
      }

      const audioStream = new MediaStream(audioTracks)
      const audioRecorder = new MediaRecorder(audioStream)
      const audioChunks: Blob[] = []

      audioRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)
        }
      }

      audioRecorder.onstop = () => {
        const audioBlob = audioChunks.length > 0
          ? new Blob(audioChunks, { type: 'audio/webm' })
          : null
        resolve(audioBlob)
      }

      // Record for 10 seconds max
      audioRecorder.start()

      setTimeout(() => {
        if (audioRecorder.state === 'recording') {
          audioRecorder.stop()
        }
      }, 10000)
    })
  }

  const addTranscriptEntry = async (entry: TranscriptEntry) => {
    if (!session) return

    try {
      setTranscript(prev => [...prev, entry])

      await fetch(`/api/avatar-sessions/${session.id}/transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      })

    } catch (error) {
      console.error('❌ Failed to add transcript entry:', error)
    }
  }

  const completeSession = async () => {
    try {
      console.log('🏁 Completing avatar session...')

      setIsSessionActive(false)
      setSessionComplete(true)

      // Stop video recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }

      // Calculate session duration
      const duration = startTime.current
        ? Math.round((Date.now() - startTime.current.getTime()) / 1000 / 60)
        : 0

      // Update session in database
      if (session) {
        await fetch(`/api/avatar-sessions/${session.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ended_at: new Date().toISOString(),
            duration_minutes: duration,
            questions_asked: sessionStats.questionsAsked,
            total_responses: sessionStats.responsesReceived,
            transcript: transcript,
            video_url: videoUrl,
            status: 'completed'
          })
        })
      }

      setSessionStats(prev => ({ ...prev, sessionDuration: duration }))

    } catch (error) {
      console.error('❌ Failed to complete session:', error)
    }
  }

  const stopSession = async () => {
    try {
      console.log('🛑 Stopping avatar session...')
      setIsSessionActive(false)
      setIsSpeaking(false)
      setIsListening(false)

      // Cancel any ongoing browser TTS
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }

      if (session) {
        await fetch(`/api/avatar-sessions/${session.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'stopped',
            ended_at: new Date().toISOString()
          })
        })
      }

      onExit()

    } catch (error) {
      console.error('❌ Failed to stop session:', error)
      onExit()
    }
  }

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing avatar session...</p>
          <p className="text-sm text-gray-500">Generating questions and setting up audio</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Session Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={onExit}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  if (sessionComplete) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-4">Avatar Session Complete!</h2>
            <p className="text-gray-600 mb-6">
              You've successfully completed the avatar training session.
            </p>

            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{sessionStats.questionsAsked}</div>
                  <div className="text-sm text-gray-600">Questions Asked</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{sessionStats.responsesReceived}</div>
                  <div className="text-sm text-gray-600">Responses Given</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{sessionStats.sessionDuration}m</div>
                  <div className="text-sm text-gray-600">Session Duration</div>
                </div>
              </div>
            </div>

            <button
              onClick={onExit}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Return to Training
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!isSessionActive) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-8">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
                <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Avatar Training Session</h1>
              <p className="text-gray-600">
                Ready to start your interactive voice training with {questions.length} questions
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Camera Preview / Audio Recording */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">
                  {enableCamera ? 'Camera Preview' : 'Audio Recording'}
                </h3>
                {enableCamera ? (
                  <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      </div>
                      <p className="text-gray-600 font-medium">Audio-Only Mode</p>
                      <p className="text-sm text-gray-500 mt-1">Your voice will be recorded without video</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Session Info */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Session Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as SupportedLanguageCode)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    >
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.flag} {lang.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={enableCamera}
                        onChange={(e) => setEnableCamera(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        disabled={isSessionActive}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-700">Enable Camera</span>
                        <span className="text-xs text-gray-500">
                          {enableCamera ? 'Record video + audio' : 'Record audio only'}
                        </span>
                      </div>
                    </label>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">How it works:</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Avatar will ask you questions using voice</li>
                      <li>• Speak your answers naturally</li>
                      <li>• Session will be recorded for review</li>
                      <li>• Questions continue automatically</li>
                      <li>• You can exit anytime</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <button
                onClick={stopSession}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={startSession}
                className="px-8 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 text-lg font-medium"
              >
                🎤 Start Avatar Session
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Progress Header */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-xl font-semibold text-gray-900">Avatar Training Session</h1>
            <span className="text-sm text-gray-600">
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Video and Status */}
          <div>
            <div className="bg-white rounded-lg shadow p-6 mb-4">
              <h3 className="font-medium text-gray-900 mb-4">Live Recording</h3>
              <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden mb-4">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Status Indicators */}
              <div className="flex justify-center space-x-4">
                <div className={`flex items-center px-3 py-2 rounded-full text-sm ${
                  isSpeaking
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    isSpeaking ? 'bg-blue-600 animate-pulse' : 'bg-gray-400'
                  }`} />
                  Avatar Speaking
                </div>

                <div className={`flex items-center px-3 py-2 rounded-full text-sm ${
                  isListening
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    isListening ? 'bg-green-600 animate-pulse' : 'bg-gray-400'
                  }`} />
                  Listening
                </div>
              </div>
            </div>

            {/* Session Stats */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-medium text-gray-900 mb-4">Session Progress</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{sessionStats.questionsAsked}</div>
                  <div className="text-sm text-gray-600">Questions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{sessionStats.responsesReceived}</div>
                  <div className="text-sm text-gray-600">Responses</div>
                </div>
              </div>
            </div>
          </div>

          {/* Current Question and Transcript */}
          <div>
            {/* Current Question */}
            {currentQuestion && (
              <div className="bg-white rounded-lg shadow p-6 mb-4">
                <h3 className="font-medium text-gray-900 mb-4">Current Question</h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-900 font-medium">{currentQuestion.text}</p>
                  {currentQuestion.category && (
                    <span className="inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      {currentQuestion.category}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Live Transcript */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-gray-900">Live Transcript</h3>
                <button
                  onClick={stopSession}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                >
                  Stop Session
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-3">
                {transcript.map((entry, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg ${
                      entry.speaker === 'avatar'
                        ? 'bg-blue-50 border-l-4 border-blue-400'
                        : 'bg-green-50 border-l-4 border-green-400'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-xs font-medium ${
                        entry.speaker === 'avatar' ? 'text-blue-600' : 'text-green-600'
                      }`}>
                        {entry.speaker === 'avatar' ? '🤖 Avatar' : '👤 You'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800">{entry.text}</p>
                  </div>
                ))}

                {transcript.length === 0 && (
                  <p className="text-gray-500 text-center py-8">
                    Session transcript will appear here...
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}