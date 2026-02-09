/**
 * useDeviceCheck Hook
 *
 * Manages device enumeration, permission requests, audio monitoring,
 * test recording, and pre-flight validation for training sessions.
 *
 * Prevents transcription failures by ensuring devices work before session starts.
 */

import { useState, useRef, useCallback, useEffect } from 'react'

export interface DeviceInfo {
  deviceId: string
  label: string
  kind: 'audioinput' | 'videoinput'
}

export interface BrowserCompatibility {
  webrtc: boolean
  mediaRecorder: boolean
  websocket: boolean
  getUserMedia: boolean
}

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'checking'
export type ValidationStatus = 'unchecked' | 'checking' | 'success' | 'failed'

export interface UseDeviceCheckOptions {
  recordingPreference: 'none' | 'audio' | 'audio_video'
  onError?: (error: Error) => void
}

export interface UseDeviceCheckResult {
  // Device Lists
  cameras: DeviceInfo[]
  microphones: DeviceInfo[]

  // Selected Devices
  selectedCamera: string | null
  selectedMicrophone: string | null

  // Permission Status
  cameraPermission: PermissionState
  microphonePermission: PermissionState

  // Audio Monitoring
  audioLevel: number // 0-100
  isMonitoring: boolean

  // Test Recording
  testRecording: Blob | null
  isRecordingTest: boolean
  isPlayingTest: boolean

  // Pre-flight Checks
  websocketStatus: ValidationStatus
  tokenStatus: ValidationStatus
  browserCompatibility: BrowserCompatibility

  // Overall Status
  isReady: boolean
  error: string | null

  // Actions
  requestPermissions: () => Promise<void>
  selectCamera: (deviceId: string) => void
  selectMicrophone: (deviceId: string) => void
  startAudioMonitoring: () => Promise<void>
  stopAudioMonitoring: () => void
  startTestRecording: () => Promise<void>
  stopTestRecording: () => Promise<void>
  playTestRecording: () => void
  checkPreFlight: () => Promise<void>
  getVideoPreview: () => MediaStream | null
  reset: () => void
}

export function useDeviceCheck({
  recordingPreference,
  onError
}: UseDeviceCheckOptions): UseDeviceCheckResult {

  // Device Lists
  const [cameras, setCameras] = useState<DeviceInfo[]>([])
  const [microphones, setMicrophones] = useState<DeviceInfo[]>([])

  // Selected Devices
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null)
  const [selectedMicrophone, setSelectedMicrophone] = useState<string | null>(null)

  // Permission Status
  const [cameraPermission, setCameraPermission] = useState<PermissionState>('prompt')
  const [microphonePermission, setMicrophonePermission] = useState<PermissionState>('prompt')

  // Audio Monitoring
  const [audioLevel, setAudioLevel] = useState(0)
  const [isMonitoring, setIsMonitoring] = useState(false)

  // Test Recording
  const [testRecording, setTestRecording] = useState<Blob | null>(null)
  const [isRecordingTest, setIsRecordingTest] = useState(false)
  const [isPlayingTest, setIsPlayingTest] = useState(false)

  // Pre-flight Checks
  const [websocketStatus, setWebsocketStatus] = useState<ValidationStatus>('unchecked')
  const [tokenStatus, setTokenStatus] = useState<ValidationStatus>('unchecked')
  const [browserCompatibility, setBrowserCompatibility] = useState<BrowserCompatibility>({
    webrtc: false,
    mediaRecorder: false,
    websocket: false,
    getUserMedia: false
  })

  // Error State
  const [error, setError] = useState<string | null>(null)

  // Refs
  const videoStreamRef = useRef<MediaStream | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const testAudioRef = useRef<HTMLAudioElement | null>(null)

  /**
   * Check browser compatibility
   */
  const checkBrowserCompatibility = useCallback(() => {
    const compatibility: BrowserCompatibility = {
      webrtc: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      mediaRecorder: typeof MediaRecorder !== 'undefined',
      websocket: typeof WebSocket !== 'undefined',
      getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    }

    setBrowserCompatibility(compatibility)

    console.log('🔍 Browser compatibility check:', compatibility)

    return compatibility
  }, [])

  /**
   * Enumerate available devices
   */
  const enumerateDevices = useCallback(async () => {
    try {
      console.log('🎬 Enumerating devices...')

      const devices = await navigator.mediaDevices.enumerateDevices()

      const videoDevices: DeviceInfo[] = devices
        .filter(d => d.kind === 'videoinput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${devices.filter(x => x.kind === 'videoinput').indexOf(d) + 1}`,
          kind: 'videoinput' as const
        }))

      const audioDevices: DeviceInfo[] = devices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${devices.filter(x => x.kind === 'audioinput').indexOf(d) + 1}`,
          kind: 'audioinput' as const
        }))

      setCameras(videoDevices)
      setMicrophones(audioDevices)

      console.log('📹 Found cameras:', videoDevices.length)
      console.log('🎤 Found microphones:', audioDevices.length)

      // Auto-select from localStorage or first device
      const savedCameraId = localStorage.getItem('preferred_camera_id')
      const savedMicrophoneId = localStorage.getItem('preferred_microphone_id')

      if (savedCameraId && videoDevices.find(d => d.deviceId === savedCameraId)) {
        setSelectedCamera(savedCameraId)
        console.log('✅ Auto-selected saved camera:', savedCameraId)
      } else if (videoDevices.length > 0) {
        setSelectedCamera(videoDevices[0].deviceId)
        console.log('✅ Auto-selected first camera:', videoDevices[0].deviceId)
      }

      if (savedMicrophoneId && audioDevices.find(d => d.deviceId === savedMicrophoneId)) {
        setSelectedMicrophone(savedMicrophoneId)
        console.log('✅ Auto-selected saved microphone:', savedMicrophoneId)
      } else if (audioDevices.length > 0) {
        setSelectedMicrophone(audioDevices[0].deviceId)
        console.log('✅ Auto-selected first microphone:', audioDevices[0].deviceId)
      }

    } catch (err) {
      console.error('❌ Failed to enumerate devices:', err)
      setError('Failed to list available devices')
      onError?.(err instanceof Error ? err : new Error('Device enumeration failed'))
    }
  }, [onError])

  /**
   * Request device permissions
   */
  const requestPermissions = useCallback(async () => {
    try {
      console.log('🔐 Requesting permissions...')

      setCameraPermission('checking')
      setMicrophonePermission('checking')
      setError(null)

      const constraints: MediaStreamConstraints = {}

      if (recordingPreference === 'audio_video') {
        constraints.video = true
        constraints.audio = true
      } else if (recordingPreference === 'audio') {
        constraints.audio = true
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      // Permissions granted!
      if (recordingPreference === 'audio_video') {
        setCameraPermission('granted')
        console.log('✅ Camera permission granted')
      }

      setMicrophonePermission('granted')
      console.log('✅ Microphone permission granted')

      // Stop the permission test stream
      stream.getTracks().forEach(track => track.stop())

      // Re-enumerate devices to get full labels
      await enumerateDevices()

    } catch (err) {
      console.error('❌ Permission request failed:', err)

      const error = err as Error

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        // User explicitly denied permission
        if (recordingPreference === 'audio_video') {
          setCameraPermission('denied')
        }
        setMicrophonePermission('denied')
        setError('Permission denied. Please allow camera and microphone access.')
      } else if (error.name === 'NotFoundError') {
        // No devices found - don't mark as denied, user can retry after connecting devices
        setError('No camera or microphone found. Please connect your devices and try again.')
        // Keep permission state as 'prompt' so button remains visible
        if (recordingPreference === 'audio_video') {
          setCameraPermission('prompt')
        }
        setMicrophonePermission('prompt')
        console.log('⚠️ No devices found - keeping permission as "prompt" for retry')
      } else {
        // Unknown error
        setError('Failed to access devices: ' + error.message)
        // Don't set to denied for unknown errors - user might be able to retry
        if (recordingPreference === 'audio_video') {
          setCameraPermission('prompt')
        }
        setMicrophonePermission('prompt')
      }

      onError?.(err instanceof Error ? err : new Error('Permission request failed'))
    }
  }, [recordingPreference, enumerateDevices, onError])

  /**
   * Select camera device
   */
  const selectCamera = useCallback((deviceId: string) => {
    console.log('📹 Selected camera:', deviceId)
    setSelectedCamera(deviceId)
    localStorage.setItem('preferred_camera_id', deviceId)

    // Stop existing video stream
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(track => track.stop())
      videoStreamRef.current = null
    }
  }, [])

  /**
   * Select microphone device
   */
  const selectMicrophone = useCallback((deviceId: string) => {
    console.log('🎤 Selected microphone:', deviceId)
    setSelectedMicrophone(deviceId)
    localStorage.setItem('preferred_microphone_id', deviceId)

    // Restart audio monitoring if active
    if (isMonitoring) {
      stopAudioMonitoring()
      setTimeout(() => startAudioMonitoring(), 100)
    }
  }, [isMonitoring])

  /**
   * Start audio level monitoring
   */
  const startAudioMonitoring = useCallback(async () => {
    try {
      console.log('🎤 Starting audio monitoring...')

      if (!selectedMicrophone) {
        throw new Error('No microphone selected')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: selectedMicrophone } }
      })

      audioStreamRef.current = stream

      // Create AudioContext and AnalyserNode
      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      const source = audioContext.createMediaStreamSource(stream)

      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8

      source.connect(analyser)

      audioContextRef.current = audioContext
      analyserRef.current = analyser

      // Start monitoring loop
      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const updateLevel = () => {
        if (!analyserRef.current) return

        analyserRef.current.getByteFrequencyData(dataArray)

        // Calculate RMS level
        const sum = dataArray.reduce((acc, val) => acc + val * val, 0)
        const rms = Math.sqrt(sum / dataArray.length)
        const level = Math.min(100, (rms / 128) * 100)

        setAudioLevel(Math.round(level))

        animationFrameRef.current = requestAnimationFrame(updateLevel)
      }

      updateLevel()
      setIsMonitoring(true)

      console.log('✅ Audio monitoring started')

    } catch (err) {
      console.error('❌ Failed to start audio monitoring:', err)
      setError('Failed to access microphone')
      onError?.(err instanceof Error ? err : new Error('Audio monitoring failed'))
    }
  }, [selectedMicrophone, onError])

  /**
   * Stop audio level monitoring
   */
  const stopAudioMonitoring = useCallback(() => {
    console.log('🛑 Stopping audio monitoring...')

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop())
      audioStreamRef.current = null
    }

    analyserRef.current = null
    setIsMonitoring(false)
    setAudioLevel(0)

    console.log('✅ Audio monitoring stopped')
  }, [])

  /**
   * Start test recording
   */
  const startTestRecording = useCallback(async () => {
    try {
      console.log('🎙️ Starting test recording...')

      if (!selectedMicrophone) {
        throw new Error('No microphone selected')
      }

      // Stop monitoring during test recording
      if (isMonitoring) {
        stopAudioMonitoring()
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: selectedMicrophone } }
      })

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      })

      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        setTestRecording(blob)
        console.log('✅ Test recording saved:', blob.size, 'bytes')

        // Clean up
        stream.getTracks().forEach(track => track.stop())

        // Restart monitoring
        startAudioMonitoring()
      }

      mediaRecorder.start()
      mediaRecorderRef.current = mediaRecorder
      setIsRecordingTest(true)

      // Stop after 3 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop()
          mediaRecorderRef.current = null
          setIsRecordingTest(false)
        }
      }, 3000)

      console.log('✅ Test recording started (3 seconds)')

    } catch (err) {
      console.error('❌ Failed to start test recording:', err)
      setError('Failed to record audio')
      setIsRecordingTest(false)
      onError?.(err instanceof Error ? err : new Error('Test recording failed'))
    }
  }, [selectedMicrophone, isMonitoring, stopAudioMonitoring, startAudioMonitoring, onError])

  /**
   * Stop test recording
   */
  const stopTestRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
      setIsRecordingTest(false)
    }
  }, [])

  /**
   * Play test recording
   */
  const playTestRecording = useCallback(() => {
    if (!testRecording) return

    console.log('▶️ Playing test recording...')

    if (testAudioRef.current) {
      testAudioRef.current.pause()
      testAudioRef.current = null
    }

    const audio = new Audio(URL.createObjectURL(testRecording))
    testAudioRef.current = audio

    setIsPlayingTest(true)

    audio.onended = () => {
      setIsPlayingTest(false)
      console.log('✅ Test playback finished')
    }

    audio.onerror = () => {
      setIsPlayingTest(false)
      console.error('❌ Test playback failed')
    }

    audio.play()
  }, [testRecording])

  /**
   * Check pre-flight validations
   */
  const checkPreFlight = useCallback(async () => {
    console.log('🚀 Running pre-flight checks...')

    // Check token generation
    setTokenStatus('checking')
    try {
      const response = await fetch('/api/elevenlabs-stt/token', {
        method: 'POST'
      })

      const data = await response.json()

      if (data.success && data.token) {
        setTokenStatus('success')
        console.log('✅ Token generation successful')
      } else {
        setTokenStatus('failed')
        console.error('❌ Token generation failed:', data)
      }
    } catch (err) {
      setTokenStatus('failed')
      console.error('❌ Token generation error:', err)
    }

    // Check WebSocket connectivity
    setWebsocketStatus('checking')
    try {
      // For now, we'll assume WebSocket is available if token works
      // Full WebSocket test would require a valid token
      if (tokenStatus === 'success' || browserCompatibility.websocket) {
        setWebsocketStatus('success')
        console.log('✅ WebSocket available')
      } else {
        setWebsocketStatus('failed')
        console.error('❌ WebSocket not available')
      }
    } catch (err) {
      setWebsocketStatus('failed')
      console.error('❌ WebSocket check error:', err)
    }
  }, [tokenStatus, browserCompatibility.websocket])

  /**
   * Get video preview stream
   */
  const getVideoPreview = useCallback((): MediaStream | null => {
    if (!selectedCamera || recordingPreference !== 'audio_video') {
      return null
    }

    if (videoStreamRef.current) {
      return videoStreamRef.current
    }

    // Create new video stream
    navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: selectedCamera } },
      audio: false
    }).then(stream => {
      videoStreamRef.current = stream
    }).catch(err => {
      console.error('❌ Failed to get video preview:', err)
    })

    return videoStreamRef.current
  }, [selectedCamera, recordingPreference])

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    console.log('🔄 Resetting device check...')

    stopAudioMonitoring()

    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(track => track.stop())
      videoStreamRef.current = null
    }

    if (testAudioRef.current) {
      testAudioRef.current.pause()
      testAudioRef.current = null
    }

    setTestRecording(null)
    setIsPlayingTest(false)
    setError(null)
  }, [stopAudioMonitoring])

  /**
   * Calculate if ready to continue
   */
  const isReady =
    (recordingPreference === 'audio_video'
      ? cameraPermission === 'granted' && microphonePermission === 'granted' && selectedCamera !== null
      : microphonePermission === 'granted'
    ) &&
    selectedMicrophone !== null &&
    tokenStatus === 'success' &&
    browserCompatibility.webrtc &&
    browserCompatibility.mediaRecorder

  /**
   * Initialize on mount
   */
  useEffect(() => {
    checkBrowserCompatibility()
    enumerateDevices()

    return () => {
      reset()
    }
  }, [])

  /**
   * Listen for device changes
   */
  useEffect(() => {
    const handleDeviceChange = () => {
      console.log('🔄 Devices changed, re-enumerating...')
      enumerateDevices()
    }

    navigator.mediaDevices?.addEventListener('devicechange', handleDeviceChange)

    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', handleDeviceChange)
    }
  }, [enumerateDevices])

  return {
    // Device Lists
    cameras,
    microphones,

    // Selected Devices
    selectedCamera,
    selectedMicrophone,

    // Permission Status
    cameraPermission,
    microphonePermission,

    // Audio Monitoring
    audioLevel,
    isMonitoring,

    // Test Recording
    testRecording,
    isRecordingTest,
    isPlayingTest,

    // Pre-flight Checks
    websocketStatus,
    tokenStatus,
    browserCompatibility,

    // Overall Status
    isReady,
    error,

    // Actions
    requestPermissions,
    selectCamera,
    selectMicrophone,
    startAudioMonitoring,
    stopAudioMonitoring,
    startTestRecording,
    stopTestRecording,
    playTestRecording,
    checkPreFlight,
    getVideoPreview,
    reset
  }
}
