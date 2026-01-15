/**
 * Real-time Transcription Hook
 *
 * Captures audio separately from video recording and streams to OpenAI Whisper
 * for real-time speech-to-text transcription with live captions.
 *
 * Uses parallel audio capture - separate MediaRecorder from video recording
 * to avoid interfering with existing VideoRecordingService.
 */

import { useState, useRef, useEffect, useCallback } from 'react'

export interface UseRealtimeTranscriptionOptions {
  language: string
  enabled: boolean
  onTranscriptUpdate?: (text: string, isFinal: boolean) => void
  onError?: (error: Error) => void
}

export interface UseRealtimeTranscriptionResult {
  // State
  isTranscribing: boolean
  currentTranscript: string
  finalTranscripts: string[]
  error: string | null

  // Actions
  startTranscription: () => Promise<void>
  stopTranscription: () => Promise<string>  // Returns the final transcript
  resetTranscript: () => void
  getAllTranscripts: () => string
  clearError: () => void
}

export function useRealtimeTranscription(
  options: UseRealtimeTranscriptionOptions
): UseRealtimeTranscriptionResult {
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [finalTranscripts, setFinalTranscripts] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isProcessingRef = useRef(false)
  const pendingChunksRef = useRef<Blob[]>([])

  /**
   * Process audio chunk by sending to STT API
   */
  const processAudioChunk = useCallback(async (audioBlob: Blob) => {
    if (!options.enabled || isProcessingRef.current) {
      return
    }

    // Skip if chunk is too small (< 3KB minimum for Whisper)
    if (audioBlob.size < 3000) {
      console.log('🔇 Audio chunk too small, skipping:', audioBlob.size, 'bytes')
      return
    }

    try {
      isProcessingRef.current = true

      const formData = new FormData()
      formData.append('audio', audioBlob, 'chunk.webm')
      formData.append('language', options.language)
      formData.append('streaming', 'true')

      console.log('🎙️ Sending audio chunk to STT:', audioBlob.size, 'bytes')

      const response = await fetch('/api/media/stt-streaming', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`STT API failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()

      if (result.transcript && result.transcript.trim()) {
        console.log('✅ STT result:', result.transcript, 'confidence:', result.confidence)

        // Append to current transcript
        setCurrentTranscript(prev => {
          const newText = prev ? `${prev} ${result.transcript}` : result.transcript
          return newText.trim()
        })

        // Notify callback
        options.onTranscriptUpdate?.(result.transcript, result.is_final || false)

        // Reset silence timer on speech
        resetSilenceTimer()
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'STT processing failed'
      console.error('❌ Chunk processing error:', errorMessage)

      // Don't stop transcription on individual chunk errors
      // Just log and continue
    } finally {
      isProcessingRef.current = false
    }
  }, [options])

  /**
   * Reset silence timer - finalizes transcript after 2 seconds of silence
   */
  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
    }

    silenceTimerRef.current = setTimeout(() => {
      if (currentTranscript.trim()) {
        console.log('🔇 Silence detected, finalizing transcript:', currentTranscript)

        setFinalTranscripts(prev => {
          console.log('📝 Adding to finalTranscripts array (current:', prev.length, 'items)')
          return [...prev, currentTranscript]
        })
        options.onTranscriptUpdate?.(currentTranscript, true)
        setCurrentTranscript('')
      }
    }, 2000) // 2-second silence threshold
  }, [currentTranscript, options])

  /**
   * Start transcription - request audio stream and begin recording
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
      console.log('🎤 Starting real-time transcription...')

      // Request audio-only stream (separate from video recording)
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

      // Log audio device info
      const audioTrack = stream.getAudioTracks()[0]
      console.log('✅ Audio stream acquired')
      console.log('🎤 Audio device:', audioTrack.label)
      console.log('🎤 Audio settings:', audioTrack.getSettings())

      // Create MediaRecorder with opus codec for Whisper
      let mediaRecorder: MediaRecorder

      try {
        mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        })
      } catch (e) {
        // Fallback if specific codec not supported
        console.warn('⚠️ audio/webm;codecs=opus not supported, using default')
        mediaRecorder = new MediaRecorder(stream)
      }

      mediaRecorderRef.current = mediaRecorder

      // Handle data available event
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          // Queue chunk for processing
          pendingChunksRef.current.push(event.data)

          // Process immediately if not already processing
          if (!isProcessingRef.current && pendingChunksRef.current.length > 0) {
            const chunk = pendingChunksRef.current.shift()
            if (chunk) {
              await processAudioChunk(chunk)
            }
          }
        }
      }

      mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event)
        const error = new Error('Audio recording failed')
        setError(error.message)
        options.onError?.(error)
      }

      mediaRecorder.onstop = () => {
        console.log('🛑 MediaRecorder stopped')
      }

      // Start recording in 3-second chunks
      mediaRecorder.start(3000)
      setIsTranscribing(true)
      setError(null)

      console.log('✅ Transcription started - recording in 3s chunks')

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start transcription')
      console.error('❌ Start transcription failed:', error.message)
      setError(error.message)
      options.onError?.(error)

      // Cleanup on error
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop())
        audioStreamRef.current = null
      }

      throw error
    }
  }, [options, isTranscribing, processAudioChunk])

  /**
   * Stop transcription - finalize and cleanup
   * Returns the complete transcript text
   */
  const stopTranscription = useCallback(async (): Promise<string> => {
    console.log('🛑 Stopping transcription...')

    // Build complete transcript by combining finalized + current
    let completeTranscript = finalTranscripts.join(' ').trim()

    // Finalize any pending transcript
    if (currentTranscript.trim()) {
      console.log('💾 Finalizing pending transcript:', currentTranscript)
      completeTranscript = completeTranscript
        ? `${completeTranscript} ${currentTranscript}`.trim()
        : currentTranscript.trim()

      setFinalTranscripts(prev => {
        console.log('📝 Adding pending transcript to finalTranscripts (current:', prev.length, 'items)')
        return [...prev, currentTranscript]
      })
      options.onTranscriptUpdate?.(currentTranscript, true)
      setCurrentTranscript('')
    } else {
      console.log('⚠️ No pending transcript to finalize')
    }

    console.log('📝 Complete transcript being returned:', completeTranscript.substring(0, 100))

    // Clear silence timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }

    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch (e) {
        console.warn('⚠️ Error stopping MediaRecorder:', e)
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

    // Clear pending chunks
    pendingChunksRef.current = []
    isProcessingRef.current = false

    setIsTranscribing(false)
    console.log('✅ Transcription stopped')

    return completeTranscript
  }, [currentTranscript, finalTranscripts, options])

  /**
   * Reset current transcript (between questions)
   */
  const resetTranscript = useCallback(() => {
    console.log('🔄 Resetting current transcript and clearing finalized transcripts')
    setCurrentTranscript('')
    setFinalTranscripts([])  // ✅ FIX: Clear finalized transcripts between questions

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
  }, [])

  /**
   * Get all finalized transcripts as single string
   */
  const getAllTranscripts = useCallback(() => {
    return finalTranscripts.join(' ').trim()
  }, [finalTranscripts])

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
      console.log('🧹 Cleaning up transcription hook')

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop()
        } catch (e) {
          // Ignore errors during cleanup
        }
      }

      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  return {
    isTranscribing,
    currentTranscript,
    finalTranscripts,
    error,
    startTranscription,
    stopTranscription,
    resetTranscript,
    getAllTranscripts,
    clearError
  }
}
