/**
 * useVideoRecording Hook
 *
 * Custom React hook that wraps VideoRecordingService and provides
 * a clean, declarative API for components that need video recording.
 *
 * Features:
 * - Automatic state management
 * - Error handling
 * - Cleanup on unmount
 * - Simple start/stop API
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { VideoRecordingService, RecordingChunks } from '@/services/VideoRecordingService'

export interface UseVideoRecordingOptions {
  aspectRatio?: '16:9' | '9:16' | '4:3' | '1:1'
  enableAudioMixing?: boolean
  onError?: (error: Error) => void
}

export interface UseVideoRecordingResult {
  // State
  isRecording: boolean
  error: string | null

  // Actions
  startRecording: () => Promise<void>
  stopRecording: () => Promise<RecordingChunks>
  mixTTSAudio: (audioUrl: string) => Promise<void>

  // Utils
  getPreviewStream: () => MediaStream | null
  clearError: () => void
}

/**
 * Hook for managing video recording in components
 *
 * @example
 * ```tsx
 * const { isRecording, startRecording, stopRecording } = useVideoRecording({
 *   aspectRatio: '16:9',
 *   enableAudioMixing: true
 * })
 *
 * // Start recording
 * await startRecording()
 *
 * // Mix TTS audio into recording
 * await mixTTSAudio(audioUrl)
 *
 * // Stop and get chunks
 * const { chunks, mimeType } = await stopRecording()
 * ```
 */
export function useVideoRecording(
  options: UseVideoRecordingOptions = {}
): UseVideoRecordingResult {
  const {
    aspectRatio = '16:9',
    enableAudioMixing = false,
    onError
  } = options

  // State
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Service instance (persists across renders)
  const serviceRef = useRef<VideoRecordingService>(new VideoRecordingService())

  /**
   * Start video recording
   */
  const startRecording = useCallback(async () => {
    try {
      setError(null)
      console.log('🎬 useVideoRecording: Starting recording...')

      await serviceRef.current.startRecording({
        aspectRatio,
        enableAudioMixing,
        videoBitrate: undefined // Auto-detect
      })

      setIsRecording(true)
      console.log('✅ useVideoRecording: Recording started')

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording'
      console.error('❌ useVideoRecording: Start error:', err)
      setError(errorMessage)
      setIsRecording(false)

      if (onError && err instanceof Error) {
        onError(err)
      }

      throw err
    }
  }, [aspectRatio, enableAudioMixing, onError])

  /**
   * Stop video recording and return chunks
   */
  const stopRecording = useCallback(async (): Promise<RecordingChunks> => {
    try {
      console.log('🛑 useVideoRecording: Stopping recording...')

      const chunks = await serviceRef.current.stopRecording()
      setIsRecording(false)

      console.log(`✅ useVideoRecording: Recording stopped (${chunks.chunks.length} chunks, ${chunks.duration}s)`)
      return chunks

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop recording'
      console.error('❌ useVideoRecording: Stop error:', err)
      setError(errorMessage)

      if (onError && err instanceof Error) {
        onError(err)
      }

      throw err
    }
  }, [onError])

  /**
   * Mix TTS audio into the recording
   */
  const mixTTSAudio = useCallback(async (audioUrl: string) => {
    try {
      console.log('🎵 useVideoRecording: Mixing TTS audio...')
      await serviceRef.current.mixTTSAudio(audioUrl)
      console.log('✅ useVideoRecording: TTS audio mixed')

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to mix TTS audio'
      console.error('❌ useVideoRecording: Mix error:', err)
      setError(errorMessage)

      if (onError && err instanceof Error) {
        onError(err)
      }

      // Don't throw - TTS mixing is optional
    }
  }, [onError])

  /**
   * Get video preview stream for displaying in UI
   */
  const getPreviewStream = useCallback(() => {
    return serviceRef.current.getPreviewStream()
  }, [])

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  /**
   * Cleanup on unmount - stop recording if active
   */
  useEffect(() => {
    return () => {
      if (serviceRef.current.isRecording()) {
        console.log('⚠️ useVideoRecording: Component unmounting, stopping recording')
        serviceRef.current.stopRecording().catch(console.error)
      }
    }
  }, [])

  return {
    // State
    isRecording,
    error,

    // Actions
    startRecording,
    stopRecording,
    mixTTSAudio,

    // Utils
    getPreviewStream,
    clearError
  }
}
