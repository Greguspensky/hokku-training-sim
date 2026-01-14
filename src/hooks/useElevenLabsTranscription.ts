/**
 * ElevenLabs Scribe V2 Realtime Transcription Hook
 *
 * WebSocket-based real-time speech-to-text transcription using ElevenLabs Scribe V2 Realtime.
 * Features ultra-low latency (150ms), automatic Voice Activity Detection (VAD),
 * live partial transcripts, and committed final transcripts.
 *
 * Key Features:
 * - WebSocket streaming for low latency
 * - Built-in VAD (no manual silence detection needed)
 * - Partial transcripts for live captions
 * - Committed transcripts when VAD detects silence
 * - Language switching without reconnection
 * - Previous context support for accuracy
 *
 * Documentation: https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime
 */

import { useState, useRef, useCallback, useEffect } from 'react'

export interface UseElevenLabsTranscriptionOptions {
  language: string  // ISO 639-1 code (e.g., "en", "ru", "es")
  enabled: boolean
  previousText?: string  // Optional context (max 50 chars)
  onPartialTranscript?: (text: string) => void
  onCommittedTranscript?: (text: string) => void
  onError?: (error: Error) => void
}

export interface UseElevenLabsTranscriptionResult {
  // State
  isTranscribing: boolean
  currentTranscript: string  // Live partial transcript
  finalTranscript: string     // Last committed transcript
  error: string | null

  // Actions
  startTranscription: () => Promise<void>
  stopTranscription: () => Promise<string>  // Returns final transcript
  resetTranscript: () => void
  clearError: () => void
}

interface WebSocketMessage {
  message_type: string
  [key: string]: any
}

export function useElevenLabsTranscription(
  options: UseElevenLabsTranscriptionOptions
): UseElevenLabsTranscriptionResult {
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [finalTranscript, setFinalTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null)
  const isFirstChunkRef = useRef(true)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 3

  /**
   * Generate single-use token from our backend
   */
  const generateToken = async (): Promise<string> => {
    console.log('🔑 Requesting single-use token from backend...')

    const response = await fetch('/api/elevenlabs-stt/token', {
      method: 'POST'
    })

    if (!response.ok) {
      throw new Error(`Token generation failed: ${response.status}`)
    }

    const data = await response.json()

    if (!data.success || !data.token) {
      throw new Error('Invalid token response')
    }

    console.log('✅ Single-use token received')
    return data.token
  }

  /**
   * Connect to ElevenLabs Scribe V2 Realtime WebSocket
   */
  const connectWebSocket = async (token: string): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      console.log('🔌 Connecting to ElevenLabs Scribe V2 Realtime WebSocket...')

      // Build WebSocket URL with parameters
      const params = new URLSearchParams({
        token,
        model_id: 'scribe_v2_realtime',  // Fixed: underscores not hyphens!
        language_code: options.language,
        audio_format: 'pcm_16000',
        commit_strategy: 'vad',  // Automatic Voice Activity Detection
        vad_silence_threshold_secs: '2.0',  // 2 seconds silence = commit
        vad_threshold: '0.4',  // Voice detection sensitivity
        min_speech_duration_ms: '200',
        min_silence_duration_ms: '200'
      })

      const wsUrl = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${params.toString()}`

      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('✅ WebSocket connected to ElevenLabs Scribe V2 Realtime')
        reconnectAttemptsRef.current = 0
        resolve(ws)
      }

      ws.onerror = (event) => {
        console.error('❌ WebSocket error:', event)
        reject(new Error('WebSocket connection failed'))
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          handleWebSocketMessage(message)
        } catch (err) {
          console.error('❌ Failed to parse WebSocket message:', err)
        }
      }

      ws.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason)

        if (isTranscribing && reconnectAttemptsRef.current < maxReconnectAttempts) {
          console.log(`🔄 Attempting reconnection (${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})...`)
          reconnectAttemptsRef.current++
          // Auto-reconnect logic would go here if needed
        }
      }
    })
  }

  /**
   * Handle incoming WebSocket messages
   */
  const handleWebSocketMessage = (message: WebSocketMessage) => {
    switch (message.message_type) {
      case 'session_started':
        console.log('✅ Session started:', message.session_id)
        console.log('📋 Session config:', message.config)
        break

      case 'partial_transcript':
        console.log('📝 Partial transcript:', message.text)
        setCurrentTranscript(message.text || '')
        options.onPartialTranscript?.(message.text || '')
        break

      case 'committed_transcript':
        console.log('✅ Committed transcript (VAD detected silence):', message.text)
        setFinalTranscript(message.text || '')
        setCurrentTranscript('')  // Clear partial transcript
        options.onCommittedTranscript?.(message.text || '')
        break

      case 'error':
        console.error('❌ WebSocket error message:', message.error_type, message.error_message)
        const errorMsg = `${message.error_type}: ${message.error_message || 'Unknown error'}`
        setError(errorMsg)
        options.onError?.(new Error(errorMsg))
        break

      default:
        console.log('📨 Unknown message type:', message.message_type, message)
    }
  }

  /**
   * Start audio capture and streaming using Web Audio API for PCM extraction
   */
  const startAudioCapture = async () => {
    console.log('🎤 Starting audio capture with direct PCM extraction...')

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        }
      })

      audioStreamRef.current = stream

      const audioTrack = stream.getAudioTracks()[0]
      console.log('✅ Audio stream acquired')
      console.log('🎤 Audio device:', audioTrack.label)
      console.log('🎤 Audio settings:', audioTrack.getSettings())

      // Create AudioContext for processing at 16kHz
      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext

      // Create media stream source
      const source = audioContext.createMediaStreamSource(stream)

      // Create ScriptProcessorNode for direct PCM access
      // Buffer size 4096 = ~256ms at 16kHz (good balance)
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1)
      scriptProcessorRef.current = scriptProcessor

      // Process audio in real-time
      scriptProcessor.onaudioprocess = (event) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          try {
            // Get PCM float32 data from input buffer
            const inputData = event.inputBuffer.getChannelData(0)

            // Convert float32 PCM to int16 PCM
            const int16Array = new Int16Array(inputData.length)
            for (let i = 0; i < inputData.length; i++) {
              // Clamp to [-1, 1] and convert to int16
              const sample = Math.max(-1, Math.min(1, inputData[i]))
              int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
            }

            // Convert to base64
            const base64Audio = arrayBufferToBase64(int16Array.buffer)

            // Build WebSocket message
            const message: any = {
              message_type: 'input_audio_chunk',
              audio_base_64: base64Audio,
              commit: false,  // Let VAD handle commits
              sample_rate: 16000
            }

            // Include previous_text only with the first chunk
            if (isFirstChunkRef.current && options.previousText) {
              message.previous_text = options.previousText.substring(0, 50)
              console.log('📝 Including previous context:', message.previous_text)
              isFirstChunkRef.current = false
            }

            // Send to WebSocket
            wsRef.current.send(JSON.stringify(message))

          } catch (err) {
            console.error('❌ PCM processing failed:', err)
          }
        }
      }

      // Connect: source → scriptProcessor → destination (creates audio processing chain)
      source.connect(scriptProcessor)
      scriptProcessor.connect(audioContext.destination)

      console.log('✅ Audio capture started (direct PCM stream, ~256ms chunks)')

    } catch (err) {
      console.error('❌ Audio capture failed:', err)
      throw err
    }
  }

  /**
   * Convert ArrayBuffer to base64
   */
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  /**
   * Start transcription
   */
  const startTranscription = useCallback(async () => {
    if (!options.enabled) {
      console.log('⚠️ Transcription not enabled')
      return
    }

    if (isTranscribing) {
      console.log('⚠️ Transcription already running')
      return
    }

    try {
      console.log(`🎤 Starting ElevenLabs Scribe V2 Realtime transcription (language: ${options.language})...`)

      // Reset state
      setCurrentTranscript('')
      setFinalTranscript('')
      setError(null)
      isFirstChunkRef.current = true

      // Generate token
      const token = await generateToken()

      // Connect WebSocket
      const ws = await connectWebSocket(token)
      wsRef.current = ws

      // Start audio capture
      await startAudioCapture()

      setIsTranscribing(true)
      console.log('✅ ElevenLabs transcription started successfully')

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start transcription')
      console.error('❌ Start transcription failed:', error.message)
      setError(error.message)
      options.onError?.(error)
      throw error
    }
  }, [options, isTranscribing])

  /**
   * Stop transcription and return final transcript
   */
  const stopTranscription = useCallback(async (): Promise<string> => {
    console.log('🛑 Stopping ElevenLabs transcription...')

    // Get final transcript before cleanup
    let completeTranscript = finalTranscript

    // If there's a pending partial transcript, include it
    if (currentTranscript.trim()) {
      console.log('💾 Including pending partial transcript:', currentTranscript)
      completeTranscript = completeTranscript
        ? `${completeTranscript} ${currentTranscript}`.trim()
        : currentTranscript.trim()
    }

    console.log('📝 Complete transcript:', completeTranscript.substring(0, 100))

    // Disconnect ScriptProcessorNode
    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect()
        scriptProcessorRef.current = null
        console.log('🎙️ ScriptProcessor disconnected')
      } catch (e) {
        console.warn('⚠️ Error disconnecting ScriptProcessor:', e)
      }
    }

    // Stop audio stream
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => {
        track.stop()
        console.log('🔇 Audio track stopped:', track.kind)
      })
      audioStreamRef.current = null
    }

    // Close AudioContext
    if (audioContextRef.current) {
      await audioContextRef.current.close()
      audioContextRef.current = null
      console.log('🔊 AudioContext closed')
    }

    // Close WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close()
      wsRef.current = null
      console.log('🔌 WebSocket closed')
    }

    setIsTranscribing(false)
    console.log('✅ Transcription stopped')

    return completeTranscript

  }, [currentTranscript, finalTranscript])

  /**
   * Reset transcripts (between questions)
   */
  const resetTranscript = useCallback(() => {
    console.log('🔄 Resetting transcripts')
    setCurrentTranscript('')
    setFinalTranscript('')
    isFirstChunkRef.current = true
  }, [])

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up ElevenLabs transcription hook')

      if (scriptProcessorRef.current) {
        try {
          scriptProcessorRef.current.disconnect()
        } catch (e) {
          // Ignore errors during cleanup
        }
      }

      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop())
      }

      if (audioContextRef.current) {
        audioContextRef.current.close()
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close()
      }
    }
  }, [])

  return {
    isTranscribing,
    currentTranscript,
    finalTranscript,
    error,
    startTranscription,
    stopTranscription,
    resetTranscript,
    clearError
  }
}
