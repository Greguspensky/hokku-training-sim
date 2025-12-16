/**
 * useTrainingSession Hook
 *
 * Consolidates common session lifecycle management across training components:
 * - Session ID generation and state
 * - Session attempt recording (for analytics)
 * - Countdown timer with auto-stop
 * - Guard flags to prevent duplicate operations
 *
 * This hook extracts the shared patterns from ElevenLabsAvatarSession,
 * RecommendationTTSSession, and TheoryPracticeSession while allowing
 * each component to maintain its specific logic.
 */

import { useState, useRef, useCallback, useEffect } from 'react'

export interface UseTrainingSessionOptions {
  /**
   * Company ID for session tracking
   */
  companyId: string

  /**
   * Scenario ID being practiced
   */
  scenarioId?: string

  /**
   * User ID for session tracking
   */
  userId?: string

  /**
   * Training mode type
   */
  trainingMode: 'theory' | 'service_practice' | 'recommendation_tts' | 'flipboard'

  /**
   * Language being used in the session
   */
  language?: string

  /**
   * ElevenLabs agent ID (if applicable)
   */
  agentId?: string

  /**
   * Session time limit in minutes (optional)
   * If provided, timer will count down and auto-stop at zero
   */
  sessionTimeLimit?: number

  /**
   * Assignment ID (if part of a track assignment)
   */
  assignmentId?: string

  /**
   * Callback when session ends (either manually or by timer)
   */
  onSessionEnd?: () => void | Promise<void>
}

export interface UseTrainingSessionResult {
  // Session State
  sessionId: string | null
  isSessionActive: boolean
  isSavingSession: boolean
  error: string | null

  // Timer State
  timeRemaining: number | null
  isTimerActive: boolean

  // Session Actions
  initializeSession: () => Promise<string> // Returns sessionId
  startTimer: () => void
  stopTimer: () => void
  markSessionActive: () => void
  markSessionSaving: (saving: boolean) => void
  endSession: () => Promise<void>

  // Guards (for preventing duplicate operations)
  isStartingSession: () => boolean
  setStartingSession: (starting: boolean) => void
  isSavingRef: React.MutableRefObject<boolean>

  // Utils
  clearError: () => void
}

/**
 * Hook for managing training session lifecycle
 *
 * @example
 * ```tsx
 * const session = useTrainingSession({
 *   companyId: 'company-123',
 *   scenarioId: 'scenario-456',
 *   userId: user?.id,
 *   trainingMode: 'theory',
 *   sessionTimeLimit: 10, // 10 minutes
 *   onSessionEnd: async () => {
 *     await saveResults()
 *     router.push('/employee')
 *   }
 * })
 *
 * // Start session
 * const sessionId = await session.initializeSession()
 * session.markSessionActive()
 * session.startTimer()
 *
 * // End session
 * await session.endSession()
 * ```
 */
export function useTrainingSession(
  options: UseTrainingSessionOptions
): UseTrainingSessionResult {
  const {
    companyId,
    scenarioId,
    userId,
    trainingMode,
    language,
    agentId,
    sessionTimeLimit,
    assignmentId = 'standalone',
    onSessionEnd
  } = options

  // Session State
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [isSavingSession, setIsSavingSession] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Timer State
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isTimerActive, setIsTimerActive] = useState(false)

  // Refs for guards (persist across renders, synchronous access)
  const sessionIdRef = useRef<string | null>(null)
  const isStartingSessionRef = useRef<boolean>(false)
  const isSavingSessionRef = useRef<boolean>(false)

  /**
   * Countdown timer effect
   * Counts down every second and auto-stops at zero
   */
  useEffect(() => {
    if (!isTimerActive || timeRemaining === null || timeRemaining <= 0) return

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          console.log('⏰ useTrainingSession: Time limit reached - triggering auto-stop')
          setIsTimerActive(false)

          // Trigger end session callback
          if (onSessionEnd) {
            onSessionEnd().catch(err => {
              console.error('❌ useTrainingSession: Error in onSessionEnd callback:', err)
            })
          }

          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isTimerActive, timeRemaining, onSessionEnd])

  /**
   * Initialize a new session
   * - Generates session ID
   * - Records attempt in database (for analytics)
   * - Returns session ID for component use
   */
  const initializeSession = useCallback(async (): Promise<string> => {
    try {
      // Generate new session ID
      const newSessionId = crypto.randomUUID()
      setSessionId(newSessionId)
      sessionIdRef.current = newSessionId
      console.log('🆔 useTrainingSession: Generated session ID:', newSessionId)

      // Record session attempt in database (counts even if user abandons session)
      if (userId && scenarioId) {
        console.log('📊 useTrainingSession: Recording session start for attempt counting...')

        const response = await fetch('/api/training/start-training-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: newSessionId,
            employeeId: userId,
            assignmentId,
            companyId,
            scenarioId,
            trainingMode,
            language,
            agentId
          })
        })

        if (!response.ok) {
          console.warn('⚠️ useTrainingSession: Failed to record session start, but continuing anyway')
        } else {
          console.log('✅ useTrainingSession: Session start recorded - attempt counted')
        }
      } else {
        console.warn('⚠️ useTrainingSession: Missing userId or scenarioId - skipping attempt recording')
      }

      return newSessionId

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize session'
      console.error('❌ useTrainingSession: Error initializing session:', err)
      setError(errorMessage)
      throw err
    }
  }, [userId, scenarioId, companyId, trainingMode, language, agentId, assignmentId])

  /**
   * Start the countdown timer
   */
  const startTimer = useCallback(() => {
    if (sessionTimeLimit) {
      const timeInSeconds = sessionTimeLimit * 60
      setTimeRemaining(timeInSeconds)
      setIsTimerActive(true)
      console.log(`⏱️ useTrainingSession: Started countdown timer: ${sessionTimeLimit} minutes (${timeInSeconds} seconds)`)
    } else {
      console.log('ℹ️ useTrainingSession: No time limit set - timer not started')
    }
  }, [sessionTimeLimit])

  /**
   * Stop the countdown timer
   */
  const stopTimer = useCallback(() => {
    setIsTimerActive(false)
    console.log('🛑 useTrainingSession: Timer stopped')
  }, [])

  /**
   * Mark session as active
   */
  const markSessionActive = useCallback(() => {
    setIsSessionActive(true)
    console.log('✅ useTrainingSession: Session marked as active')
  }, [])

  /**
   * Mark session as saving (or done saving)
   */
  const markSessionSaving = useCallback((saving: boolean) => {
    setIsSavingSession(saving)
    isSavingSessionRef.current = saving
    console.log(`${saving ? '💾' : '✅'} useTrainingSession: Session ${saving ? 'saving...' : 'save complete'}`)
  }, [])

  /**
   * End the session
   * - Stops timer
   * - Marks session as inactive
   * - Triggers onSessionEnd callback
   */
  const endSession = useCallback(async () => {
    console.log('🛑 useTrainingSession: Ending session...')

    // Stop timer
    stopTimer()

    // Mark session as inactive
    setIsSessionActive(false)

    // Reset starting guard
    isStartingSessionRef.current = false
    console.log('🔓 useTrainingSession: Session start guard reset')

    // Trigger callback if provided
    if (onSessionEnd) {
      try {
        await onSessionEnd()
        console.log('✅ useTrainingSession: onSessionEnd callback completed')
      } catch (err) {
        console.error('❌ useTrainingSession: Error in onSessionEnd callback:', err)
        throw err
      }
    }
  }, [stopTimer, onSessionEnd])

  /**
   * Check if session is currently starting (guard check)
   */
  const isStartingSession = useCallback(() => {
    return isStartingSessionRef.current
  }, [])

  /**
   * Set starting session flag (guard)
   */
  const setStartingSession = useCallback((starting: boolean) => {
    isStartingSessionRef.current = starting
    console.log(`${starting ? '🔒' : '🔓'} useTrainingSession: Session start guard ${starting ? 'activated' : 'released'}`)
  }, [])

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    // Session State
    sessionId,
    isSessionActive,
    isSavingSession,
    error,

    // Timer State
    timeRemaining,
    isTimerActive,

    // Session Actions
    initializeSession,
    startTimer,
    stopTimer,
    markSessionActive,
    markSessionSaving,
    endSession,

    // Guards
    isStartingSession,
    setStartingSession,
    isSavingRef: isSavingSessionRef,

    // Utils
    clearError
  }
}
