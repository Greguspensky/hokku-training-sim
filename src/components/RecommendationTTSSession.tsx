'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Play, Square, Volume2, VolumeX, SkipForward, StopCircle } from 'lucide-react'
import { trainingSessionsService } from '@/lib/training-sessions'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface RecommendationQuestion {
  id: string
  question_text: string
  category: string
  difficulty_level: number
}

interface RecommendationTTSSessionProps {
  companyId: string
  scenarioId: string
  scenario: any
  questions: RecommendationQuestion[]
  language?: string
  assignmentId?: string
  videoAspectRatio?: '16:9' | '9:16' | '4:3' | '1:1'
  onSessionEnd?: (sessionData: any) => void
  className?: string
}

export function RecommendationTTSSession({
  companyId,
  scenarioId,
  scenario,
  questions,
  language = 'en',
  assignmentId,
  videoAspectRatio = '16:9',
  onSessionEnd,
  className = ''
}: RecommendationTTSSessionProps) {
  const router = useRouter()
  const { user } = useAuth()

  // Session state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null)
  const [questionStartTime, setQuestionStartTime] = useState<Date | null>(null)
  const [completedQuestions, setCompletedQuestions] = useState<number[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // TTS and Audio state
  const [isLoadingTTS, setIsLoadingTTS] = useState(false)
  const [ttsError, setTtsError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Video recording state
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([])
  const [isSavingVideo, setIsSavingVideo] = useState(false)
  const [videoNeedsRotation, setVideoNeedsRotation] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Audio mixing for recording TTS + microphone
  const audioContextRef = useRef<AudioContext | null>(null)
  const mixedStreamRef = useRef<MediaStream | null>(null)
  const recordingDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null)
  const ttsAudioSourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const recordingAudioRef = useRef<HTMLAudioElement | null>(null)
  const videoChunksRef = useRef<Blob[]>([])
  const recordingMimeTypeRef = useRef<string>('video/webm')

  // Current question
  const currentQuestion = questions[currentQuestionIndex]
  const isLastQuestion = currentQuestionIndex === questions.length - 1

  // Get duration for current question from scenario settings (in seconds)
  const questionDurationSeconds = currentQuestion
    ? (scenario?.recommendation_question_durations?.[currentQuestion.id] || 30)
    : 30

  // Initialize session
  useEffect(() => {
    if (questions.length > 0 && !sessionId) {
      initializeSession()
    }
  }, [questions])

  // Load TTS for current question
  useEffect(() => {
    if (currentQuestion && isSessionActive) {
      // Clear previous audio URL to prevent wrong audio playback
      setAudioUrl(null)
      setIsPlaying(false)

      console.log('🔄 Question effect running - loading TTS and starting timer')
      loadQuestionTTS()
      startQuestionTimer()

      // Video recording is now started in startSession() from user gesture
      // No automatic video start here (iOS requires user gesture)
    }
  }, [currentQuestionIndex, isSessionActive])

  // Timer effect
  useEffect(() => {
    if (timerActive && timeRemaining > 0) {
      timerRef.current = setTimeout(() => {
        setTimeRemaining(prev => prev - 1)
      }, 1000)
    } else if (timeRemaining === 0 && timerActive) {
      setTimerActive(false)
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [timeRemaining, timerActive])

  const initializeSession = async () => {
    try {
      const newSessionId = `rec_tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      setSessionId(newSessionId)
      setSessionStartTime(new Date())
      console.log('✅ Initialized TTS recommendation session:', newSessionId)
    } catch (error) {
      console.error('❌ Error initializing session:', error)
    }
  }

  const loadQuestionTTS = async () => {
    if (!currentQuestion) return

    setIsLoadingTTS(true)
    setTtsError(null)

    try {
      console.log('🔊 Loading TTS for question:', currentQuestion.question_text)

      const response = await fetch('/api/elevenlabs-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: currentQuestion.question_text,
          language: language
        })
      })

      if (response.ok) {
        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        setAudioUrl(audioUrl)

        // Auto-play the TTS
        setTimeout(() => playTTS(), 500)

        console.log('✅ TTS loaded and playing automatically')
      } else {
        throw new Error('TTS generation failed')
      }
    } catch (error) {
      console.error('❌ TTS error:', error)
      setTtsError('TTS failed - continuing with video recording only')
    } finally {
      setIsLoadingTTS(false)
    }
  }

  const playTTS = async () => {
    if (audioUrl && audioRef.current) {
      // Set up main audio for user playback
      audioRef.current.src = audioUrl
      audioRef.current.volume = volume

      // If recording is active, use AudioBuffer approach for TTS audio mixing
      if (isRecording && audioContextRef.current && recordingDestinationRef.current) {
        try {
          console.log('🎵 Fetching TTS audio for AudioBuffer mixing approach')

          // Fetch the audio data as ArrayBuffer
          const response = await fetch(audioUrl)
          const arrayBuffer = await response.arrayBuffer()
          console.log(`🎵 Fetched audio data: ${arrayBuffer.byteLength} bytes`)

          // Decode audio data to AudioBuffer
          const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer)
          console.log(`🎵 Decoded audio buffer: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.sampleRate}Hz`)

          // Create AudioBufferSourceNode for recording mixing
          const bufferSource = audioContextRef.current.createBufferSource()
          bufferSource.buffer = audioBuffer
          bufferSource.connect(recordingDestinationRef.current)

          // Start playing the buffer for recording
          bufferSource.start()
          console.log('🎵 Started AudioBuffer playback - TTS should now be mixed into recording')

        } catch (error) {
          console.warn('⚠️ Error with AudioBuffer TTS mixing:', error)
        }
      }

      // Play main audio for user
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(error => console.error('Audio play error:', error))
    }
  }

  const startQuestionTimer = () => {
    setTimeRemaining(questionDurationSeconds)
    setTimerActive(true)
    setQuestionStartTime(new Date())
    console.log(`⏱️ Started timer for ${questionDurationSeconds} seconds`)
  }

  const startVideoRecording = async () => {
    console.log('🎬 startVideoRecording called')
    try {
      // Detect if mobile device
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      console.log('📱 Device type:', isMobile ? 'Mobile' : 'Desktop')

      // Calculate video dimensions based on aspect ratio
      const getVideoDimensions = (ratio: string) => {
        switch (ratio) {
          case '16:9':
            return { width: 1280, height: 720 }
          case '9:16':
            return { width: 720, height: 1280 }
          case '4:3':
            return { width: 640, height: 480 }
          case '1:1':
            return { width: 720, height: 720 }
          default:
            return { width: 1280, height: 720 }
        }
      }

      const dimensions = getVideoDimensions(videoAspectRatio)
      console.log('📐 Requested dimensions:', `${dimensions.width}x${dimensions.height}`)

      // Build video constraints with mobile-specific handling
      const videoConstraints: MediaTrackConstraints = {
        facingMode: 'user', // Front camera for selfie mode
        aspectRatio: { ideal: dimensions.width / dimensions.height }
      }

      // For mobile, use exact constraints to force the aspect ratio
      // For desktop, use ideal to allow fallback
      if (isMobile) {
        videoConstraints.width = { exact: dimensions.width }
        videoConstraints.height = { exact: dimensions.height }
        console.log('📱 Mobile: Using exact constraints to force aspect ratio')
      } else {
        videoConstraints.width = { ideal: dimensions.width }
        videoConstraints.height = { ideal: dimensions.height }
        console.log('💻 Desktop: Using ideal constraints for flexibility')
      }

      // Get microphone and camera stream with specified aspect ratio
      let micStream: MediaStream
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: true
        })
      } catch (exactError) {
        // If exact constraints fail on mobile, fallback to ideal
        if (isMobile && (videoConstraints.width as any)?.exact) {
          console.warn('⚠️ Exact constraints failed, retrying with ideal constraints:', exactError)
          videoConstraints.width = { ideal: dimensions.width }
          videoConstraints.height = { ideal: dimensions.height }

          micStream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: true
          })
          console.log('✅ Fallback to ideal constraints succeeded')
        } else {
          throw exactError
        }
      }

      // Log actual stream dimensions
      const videoTrack = micStream.getVideoTracks()[0]
      const settings = videoTrack.getSettings()
      console.log('✅ Actual stream dimensions:')
      console.log(`   Width: ${settings.width}`)
      console.log(`   Height: ${settings.height}`)
      console.log(`   Aspect Ratio: ${settings.aspectRatio}`)
      console.log(`   Facing Mode: ${settings.facingMode}`)

      // Check if stream dimensions match requested aspect ratio
      const actualAspectRatio = settings.width! / settings.height!
      const requestedAspectRatio = dimensions.width / dimensions.height
      const aspectRatioDiff = Math.abs(actualAspectRatio - requestedAspectRatio)

      // Detect if video needs rotation (e.g., portrait mode requested but got landscape)
      const isPortraitRequested = dimensions.height > dimensions.width
      const isLandscapeStream = settings.width! > settings.height!

      if (isPortraitRequested && isLandscapeStream) {
        console.warn('🔄 Portrait mode requested but camera provided landscape - will apply CSS rotation')
        setVideoNeedsRotation(true)
      } else {
        setVideoNeedsRotation(false)
      }

      if (aspectRatioDiff > 0.1) {
        console.warn(`⚠️ Aspect ratio mismatch: requested ${requestedAspectRatio.toFixed(2)}, got ${actualAspectRatio.toFixed(2)}`)
        console.warn('📱 Mobile camera may not support this exact aspect ratio. Recording will continue with available dimensions.')
      } else {
        console.log('✅ Aspect ratio matches request')
      }

      if (videoRef.current) {
        videoRef.current.srcObject = micStream

        // Wait for video metadata to load and log actual video dimensions
        videoRef.current.onloadedmetadata = () => {
          const video = videoRef.current!
          console.log('📹 Video element dimensions after metadata loaded:')
          console.log(`  - videoWidth: ${video.videoWidth}`)
          console.log(`  - videoHeight: ${video.videoHeight}`)
          console.log(`  - Calculated aspect ratio: ${(video.videoWidth / video.videoHeight).toFixed(2)}`)
          console.log(`  - Expected for portrait (9:16): ${(9/16).toFixed(2)} = 0.56`)
          console.log(`  - Expected for landscape (16:9): ${(16/9).toFixed(2)} = 1.78`)
        }
      }

      // Create audio context for mixing
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext

      // Ensure AudioContext is in running state (required for recording)
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
        console.log('🎵 AudioContext resumed from suspended state')
      }
      console.log(`🎵 AudioContext state: ${audioContext.state}`)

      // Create sources and destination
      const micSource = audioContext.createMediaStreamSource(micStream)
      const destination = audioContext.createMediaStreamDestination()
      recordingDestinationRef.current = destination

      // Connect microphone to destination
      micSource.connect(destination)

      console.log('🎧 Using AudioBuffer approach for TTS audio mixing (no MediaElement needed)')

      // For TTS audio mixing - we'll connect TTS audio when it plays
      // The TTS audio will be mixed into the recording stream

      // Create combined stream with video from camera and mixed audio
      // Note: videoTrack already obtained above when checking stream settings (line 295)
      const mixedAudioTrack = destination.stream.getAudioTracks()[0]

      console.log('🎬 Stream debug info:')
      console.log(`  - Video track: ${videoTrack ? 'available' : 'missing'}`)
      console.log(`  - Mixed audio track: ${mixedAudioTrack ? 'available' : 'missing'}`)
      console.log(`  - Mixed audio track enabled: ${mixedAudioTrack?.enabled}`)
      console.log(`  - Mixed audio track muted: ${mixedAudioTrack?.muted}`)
      console.log(`  - Mixed audio track readyState: ${mixedAudioTrack?.readyState}`)

      const combinedStream = new MediaStream([videoTrack, mixedAudioTrack])
      mixedStreamRef.current = combinedStream

      console.log(`🎬 Combined stream created with ${combinedStream.getTracks().length} tracks (${combinedStream.getVideoTracks().length} video, ${combinedStream.getAudioTracks().length} audio)`)

      // Choose appropriate MIME type for the device
      const getSupportedMimeType = () => {
        const types = [
          'video/mp4',           // iOS Safari requirement
          'video/webm;codecs=vp8',
          'video/webm'
        ]

        for (const type of types) {
          if (MediaRecorder.isTypeSupported(type)) {
            console.log(`📹 Using supported MIME type: ${type}`)
            return type
          }
        }
        console.warn('⚠️ No supported video MIME type found, falling back to video/webm')
        return 'video/webm'
      }

      const mimeType = getSupportedMimeType()
      recordingMimeTypeRef.current = mimeType

      // Configure MediaRecorder with video bitrate to reduce file size
      // Mobile: 1 Mbps, Desktop: 2.5 Mbps (isMobile already declared at function start)
      const videoBitsPerSecond = isMobile ? 1000000 : 2500000 // 1 Mbps or 2.5 Mbps

      console.log(`📹 Configuring MediaRecorder: ${isMobile ? 'Mobile' : 'Desktop'} mode, bitrate: ${videoBitsPerSecond / 1000000} Mbps`)

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond
      })
      setMediaRecorder(recorder)

      // Clear any existing chunks
      videoChunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunksRef.current.push(event.data)
          console.log(`📹 Video chunk recorded: ${event.data.size} bytes, total chunks: ${videoChunksRef.current.length}`)
        } else {
          console.log('⚠️ Video chunk is empty')
        }
      }

      recorder.onstop = () => {
        console.log(`🔄 Recording stopped, transferring ${videoChunksRef.current.length} chunks to state`)
        setRecordedChunks([...videoChunksRef.current])
        micStream.getTracks().forEach(track => track.stop())
        combinedStream.getTracks().forEach(track => track.stop())
        // Clean up audio references
        ttsAudioSourceRef.current = null
        recordingAudioRef.current = null
        if (audioContext.state !== 'closed') {
          audioContext.close()
        }
        console.log('📹 Video recording stopped with mixed audio')
      }

      recorder.onerror = (event: any) => {
        console.error('❌ MediaRecorder error:', event)
        console.error('❌ MediaRecorder error details:', {
          error: event.error,
          name: event.error?.name,
          message: event.error?.message
        })
      }

      recorder.onstart = () => {
        console.log('✅ MediaRecorder started successfully')
      }

      console.log('📹 Calling recorder.start()...')
      recorder.start()
      setIsRecording(true)
      console.log('📹 Started video recording with audio mixing capability')

    } catch (error) {
      console.error('❌ Video recording error:', error)
      if (error instanceof Error) {
        console.error('❌ Error name:', error.name)
        console.error('❌ Error message:', error.message)
        console.error('❌ Error stack:', error.stack)
      }
      alert(`Failed to start video recording: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const stopVideoRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop()
      setIsRecording(false)
    }
  }

  const handleNextQuestion = () => {
    // Stop and clear current audio
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      setIsPlaying(false)
    }

    // Clear audio URL to prevent reuse
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }

    // Mark current question as completed
    setCompletedQuestions(prev => [...prev, currentQuestionIndex])

    // Move to next question
    if (!isLastQuestion) {
      setCurrentQuestionIndex(prev => prev + 1)
      setTimerActive(false)
    }
  }

  const handleEndSession = async () => {
    console.log('🛑 handleEndSession called, stopping recording...')
    stopVideoRecording()

    // Wait for MediaRecorder to finish and chunks to be ready
    console.log('⏳ Waiting 1 second for recording to fully stop and chunks to be ready...')
    await new Promise(resolve => setTimeout(resolve, 1000))

    setIsSessionActive(false)
    setTimerActive(false)
    setIsSavingVideo(true) // Show saving state

    // Stop and clean up audio
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      setIsPlaying(false)
    }

    // Clean up audio URL
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }

    const sessionEndTime = new Date()
    const totalSessionTime = sessionStartTime
      ? Math.round((sessionEndTime.getTime() - sessionStartTime.getTime()) / 1000)
      : 0

    const questionsCompleted = completedQuestions.length + (isLastQuestion ? 1 : 0)

    // Create questions data for the transcript (simplified version)
    const questionTranscript = questions.slice(0, questionsCompleted).map((q, index) => ({
      role: 'system',
      message: `Question ${index + 1}: ${q.question_text}`,
      timestamp: sessionStartTime ? new Date(sessionStartTime.getTime() + (index * 60000)).toISOString() : new Date().toISOString()
    }))

    // NEW APPROACH: Upload video FIRST, then save session with video URL
    // This prevents losing video if database save times out
    let videoUploadResult = null

    try {
      // Check if we have video to upload
      const chunks = videoChunksRef.current
      console.log(`📹 Pre-upload video check: ${chunks.length} chunks available`)

      if (chunks.length > 0) {
        console.log('📹 Uploading video recording BEFORE saving session...')

        // Create temporary session ID for upload
        const tempSessionId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`

        const videoBlob = new Blob(chunks, {
          type: recordingMimeTypeRef.current
        })

        console.log(`📹 Created video blob: ${videoBlob.size} bytes, type: ${videoBlob.type}`)

        const formData = new FormData()
        formData.append('recording', videoBlob)
        formData.append('sessionId', tempSessionId)
        formData.append('recordingType', 'video')

        console.log('📹 Starting video upload with 60s timeout...')

        // Add timeout for video upload (60 seconds)
        const uploadPromise = fetch('/api/upload-recording', {
          method: 'POST',
          body: formData
        })

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Video upload timeout after 60 seconds')), 60000)
        )

        const uploadResponse = await Promise.race([uploadPromise, timeoutPromise]) as Response

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text()
          console.error('❌ Upload response not OK:', uploadResponse.status, errorText)
          throw new Error(`Video upload failed: ${uploadResponse.status} ${errorText}`)
        }

        videoUploadResult = await uploadResponse.json()
        console.log('✅ Video uploaded successfully:', videoUploadResult.path)
      } else {
        console.warn('⚠️ No video chunks to upload')
      }
    } catch (error) {
      console.error('❌ Failed to upload video:', error)
      // Continue anyway - we'll save session without video
    }

    try {
      console.log('🔄 About to save session with data:', {
        employee_id: user?.employee_record_id || user?.id || 'unknown',
        assignment_id: assignmentId || 'unknown',
        company_id: companyId,
        training_mode: 'recommendation_tts',
        has_video: !!videoUploadResult
      })

      // Save session to database WITH video URL if available
      const savedSession = await trainingSessionsService.saveSession({
        employee_id: user?.employee_record_id || user?.id || 'unknown',
        assignment_id: assignmentId || 'unknown',
        company_id: companyId,
        scenario_id: scenarioId,
        training_mode: 'recommendation_tts',
        language: language,
        agent_id: sessionId || 'tts-session',
        knowledge_context: {
          documents: [],
          totalCharacters: 0,
          processedAt: new Date().toISOString()
        },
        conversation_transcript: questionTranscript,
        session_duration_seconds: totalSessionTime,
        started_at: sessionStartTime || new Date(),
        ended_at: sessionEndTime,
        recording_preference: 'audio_video',
        recording_consent_timestamp: sessionStartTime,
        // Include video data if upload succeeded
        video_recording_url: videoUploadResult?.url || null,
        video_file_size: videoUploadResult?.size || null,
        recording_duration_seconds: Math.round(totalSessionTime)
      })

      console.log('💾 Session saved to database:', savedSession, 'with video:', !!videoUploadResult)

      const sessionData = {
        id: savedSession,
        sessionId,
        scenarioId,
        sessionType: 'recommendation_tts',
        startTime: sessionStartTime,
        endTime: sessionEndTime,
        totalDurationSeconds: totalSessionTime,
        questionsCompleted: questionsCompleted,
        totalQuestions: questions.length,
        completionRate: Math.round((questionsCompleted / questions.length) * 100),
        savedSessionId: savedSession
      }

      console.log('📊 TTS Session completed:', sessionData)

      // Always turn off saving state before calling onSessionEnd
      setIsSavingVideo(false)

      if (onSessionEnd) {
        onSessionEnd(sessionData)
      }
    } catch (error) {
      console.error('❌ Failed to save session:', error)
      console.error('❌ Full error details:', JSON.stringify(error, null, 2))

      // Turn off saving state on error too
      setIsSavingVideo(false)

      // Fallback - still call onSessionEnd with basic data
      const sessionData = {
        sessionId,
        scenarioId,
        sessionType: 'recommendation_tts',
        startTime: sessionStartTime,
        endTime: sessionEndTime,
        totalDurationSeconds: totalSessionTime,
        questionsCompleted: questionsCompleted,
        totalQuestions: questions.length,
        completionRate: Math.round((questionsCompleted / questions.length) * 100),
        error: 'Failed to save to database'
      }

      if (onSessionEnd) {
        onSessionEnd(sessionData)
      }
    }
  }

  const startSession = async () => {
    console.log('🚀 Starting session from user button click (user gesture)')
    setIsSessionActive(true)

    // Start video recording immediately from user gesture (required for iOS)
    console.log('🎬 Starting video recording from user gesture')
    await startVideoRecording()
  }

  // Format timer display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Timer color based on remaining time
  const getTimerColor = () => {
    const percentRemaining = (timeRemaining / questionDurationSeconds) * 100
    if (percentRemaining > 50) return 'text-green-600'
    if (percentRemaining > 25) return 'text-yellow-600'
    return 'text-red-600'
  }

  // Show saving state when video is being processed
  if (isSavingVideo) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-8 text-center ${className}`}>
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600"></div>
          <h2 className="text-2xl font-bold text-gray-900">Saving video recording...</h2>
          <p className="text-gray-600">
            Please wait while we upload your training session video.
          </p>
        </div>
      </div>
    )
  }

  if (!isSessionActive) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-8 text-center ${className}`}>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">🎯 Product Recommendations Training</h2>
        <p className="text-gray-600 mb-6">
          Ready to start your recommendation training session with {questions.length} questions
        </p>
        <p className="text-sm text-gray-500 mb-8">
          Each question will be read aloud with {formatTime(questionDurationSeconds)} to respond via video
        </p>
        <button
          onClick={startSession}
          className="inline-flex items-center px-8 py-4 text-lg font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 shadow-lg transform transition hover:scale-105"
        >
          <Play className="w-5 h-5 mr-2" />
          Start TTS Session
        </button>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      {/* Question Header */}
      <div className="bg-purple-600 text-white p-6 rounded-t-lg">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            Question {currentQuestionIndex + 1} of {questions.length}
          </h2>
          <div className="text-sm opacity-90">
            {scenario?.title}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8">
        {/* Timer Display */}
        <div className="text-center mb-8">
          <div className={`text-6xl font-bold ${getTimerColor()} mb-2`}>
            {formatTime(timeRemaining)}
          </div>
          <p className="text-gray-600">Time Remaining</p>
        </div>

        {/* Question Text */}
        <div className="bg-gray-50 rounded-lg p-6 mb-8">
          <div className="flex items-center justify-center gap-4">
            <h3 className="text-2xl font-semibold text-gray-900 text-center leading-relaxed flex-1">
              {currentQuestion?.question_text || 'Loading question...'}
            </h3>
            <button
              onClick={playTTS}
              disabled={!audioUrl || isLoadingTTS}
              className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white transition-colors"
              title="Play question audio"
            >
              <Play className="w-5 h-5 ml-0.5" />
            </button>
          </div>
        </div>

        {/* TTS Status */}
        <div className="flex items-center justify-center mb-6 space-x-4">
          {isLoadingTTS && (
            <div className="flex items-center text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              Loading audio...
            </div>
          )}
          {ttsError && (
            <div className="flex items-center text-orange-600">
              <VolumeX className="w-4 h-4 mr-2" />
              {ttsError}
            </div>
          )}
          {!isLoadingTTS && !ttsError && (
            <div className="flex items-center text-green-600">
              <Volume2 className="w-4 h-4 mr-2" />
              Audio playing automatically
            </div>
          )}
        </div>

        {/* Video Recording Display */}
        <div
          className="bg-black rounded-lg mb-8 relative overflow-hidden mx-auto"
          style={{
            aspectRatio: videoAspectRatio,
            maxWidth: videoAspectRatio === '9:16' ? '360px' : '100%',
            width: '100%'
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-contain"
            style={videoNeedsRotation ? {
              transform: 'rotate(90deg) scale(1.33)',
              transformOrigin: 'center center'
            } : undefined}
          />
          {isRecording && (
            <div className="absolute top-4 right-4 flex items-center bg-red-600 text-white px-3 py-1 rounded-full text-sm">
              <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
              Recording
            </div>
          )}
          {videoNeedsRotation && (
            <div className="absolute bottom-4 left-4 bg-blue-600 text-white px-3 py-1 rounded text-xs">
              📱 Rotated for portrait mode
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-center space-x-4">
          {!isLastQuestion ? (
            <button
              onClick={handleNextQuestion}
              className="inline-flex items-center px-6 py-3 text-lg font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <SkipForward className="w-5 h-5 mr-2" />
              Next Question
            </button>
          ) : (
            <button
              onClick={handleEndSession}
              className="inline-flex items-center px-6 py-3 text-lg font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              <StopCircle className="w-5 h-5 mr-2" />
              End Session
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mt-8">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span>{Math.round(((currentQuestionIndex + 1) / questions.length) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Hidden audio element for TTS playback */}
      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="hidden"
      />
    </div>
  )
}