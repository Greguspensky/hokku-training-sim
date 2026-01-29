'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Brain, X, Clock, CheckCircle, AlertCircle, Loader2, AlertTriangle } from 'lucide-react'

interface UnanalyzedSession {
  id: string
  session_name: string
  training_mode: 'theory' | 'service_practice'
  employee_id: string
  employee_name: string
  scenario_name: string | null
  created_at: string
  language: string
  conversation_transcript: any[]
}

type SessionStatus = 'pending' | 'analyzing' | 'completed' | 'failed'

interface BatchAnalysisBarProps {
  companyId: string
}

export default function BatchAnalysisBar({ companyId }: BatchAnalysisBarProps) {
  const t = useTranslations('manager.batchAnalysis')
  const [unanalyzedSessions, setUnanalyzedSessions] = useState<UnanalyzedSession[]>([])
  const [currentSessionIndex, setCurrentSessionIndex] = useState<number>(-1)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<Map<string, SessionStatus>>(new Map())
  const [errorDetails, setErrorDetails] = useState<Map<string, string>>(new Map())
  const [isVisible, setIsVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch unanalyzed sessions with ref to prevent race conditions
  const isFetchingRef = useRef(false)

  const fetchUnanalyzedSessions = useCallback(async () => {
    if (!companyId || isFetchingRef.current) return

    isFetchingRef.current = true

    try {
      console.log('🔍 Fetching unanalyzed sessions...')
      const response = await fetch(`/api/training/unanalyzed-sessions?company_id=${companyId}`)

      if (!response.ok) {
        throw new Error('Failed to fetch unanalyzed sessions')
      }

      const data = await response.json()

      if (data.success && data.sessions) {
        setUnanalyzedSessions(data.sessions)
        setIsVisible(data.sessions.length > 0)
        console.log(`✅ Found ${data.sessions.length} unanalyzed sessions`)
      }
    } catch (error) {
      console.error('❌ Error fetching unanalyzed sessions:', error)
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }, [companyId])

  // Auto-refresh every 30 seconds when idle
  useEffect(() => {
    if (!companyId) return

    fetchUnanalyzedSessions()

    const interval = setInterval(() => {
      if (!isAnalyzing) {
        fetchUnanalyzedSessions()
      }
    }, 30000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, fetchUnanalyzedSessions])

  // Analyze a single session
  const analyzeSingleSession = async (session: UnanalyzedSession) => {
    if (session.training_mode === 'theory') {
      const response = await fetch('/api/assessment/assess-theory-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          userId: session.employee_id,
          transcript: session.conversation_transcript
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Theory assessment failed')
      }

      return await response.json()
    } else if (session.training_mode === 'service_practice') {
      const response = await fetch('/api/assessment/assess-service-practice-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          forceReAnalysis: false,
          language: session.language
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Service practice assessment failed')
      }

      return await response.json()
    }

    throw new Error(`Unknown training mode: ${session.training_mode}`)
  }

  // Start batch analysis
  const startAnalysis = async () => {
    console.log(`🚀 Starting batch analysis of ${unanalyzedSessions.length} sessions`)
    setIsAnalyzing(true)
    setCurrentSessionIndex(0)
    setResults(new Map())
    setErrorDetails(new Map())

    for (let i = 0; i < unanalyzedSessions.length; i++) {
      setCurrentSessionIndex(i)
      const session = unanalyzedSessions[i]

      console.log(`📊 Analyzing session ${i + 1}/${unanalyzedSessions.length}: ${session.session_name}`)

      // Mark as analyzing
      setResults(prev => new Map(prev).set(session.id, 'analyzing'))

      try {
        await analyzeSingleSession(session)
        console.log(`✅ Successfully analyzed session: ${session.session_name}`)
        setResults(prev => new Map(prev).set(session.id, 'completed'))
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`❌ Failed to analyze session ${session.id}:`, errorMessage)
        setResults(prev => new Map(prev).set(session.id, 'failed'))
        setErrorDetails(prev => new Map(prev).set(session.id, errorMessage))
        // Continue with next session (don't break)
      }

      // Brief delay between requests
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    console.log('✅ Batch analysis complete')
    setIsAnalyzing(false)
    setCurrentSessionIndex(-1)

    // Refresh list after completion (with slight delay)
    setTimeout(() => {
      fetchUnanalyzedSessions()
    }, 2000)
  }

  // Get session status
  const getSessionStatus = (sessionId: string, index: number): SessionStatus => {
    if (results.has(sessionId)) {
      return results.get(sessionId)!
    }
    if (isAnalyzing && index === currentSessionIndex) {
      return 'analyzing'
    }
    return 'pending'
  }

  // Don't render if not visible or no sessions
  if (!isVisible || unanalyzedSessions.length === 0) {
    return null
  }

  const failedCount = Array.from(results.values()).filter(status => status === 'failed').length

  return (
    <div className="fixed bottom-4 right-4 w-[420px] bg-white border-2 border-blue-500 rounded-lg shadow-xl z-30">
      <div className="px-4 py-3">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Brain className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-medium text-gray-900">
              {t('sessionsToAnalyze', { count: unanalyzedSessions.length })}
            </h3>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title={t('hideAnalysisBar')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        {isAnalyzing && (
          <div className="mb-3">
            <div className="text-sm text-gray-600 mb-1 truncate">
              {t('analyzingProgress', {
                current: currentSessionIndex + 1,
                total: unanalyzedSessions.length,
                name: unanalyzedSessions[currentSessionIndex]?.scenario_name ||
                      unanalyzedSessions[currentSessionIndex]?.session_name
              })}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(results.size / unanalyzedSessions.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Session List - Scrollable */}
        <div className="max-h-[300px] overflow-y-auto mb-3 -mx-4">
          {unanalyzedSessions.map((session, idx) => (
            <div key={session.id}>
              <SessionChip
                session={session}
                status={getSessionStatus(session.id, idx)}
                error={errorDetails.get(session.id)}
              />
              {idx < unanalyzedSessions.length - 1 && (
                <div className="border-b border-gray-100 mx-4" />
              )}
            </div>
          ))}
        </div>

        {/* Error Summary */}
        {failedCount > 0 && (
          <div className="mb-3 flex items-center space-x-2 text-sm text-red-600">
            <AlertTriangle className="w-4 h-4" />
            <span>
              {t('failedSessions', { count: failedCount })}
            </span>
          </div>
        )}

        {/* Action Button */}
        {!isAnalyzing && (
          <button
            onClick={startAnalysis}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            {t('startAnalyzing')}
          </button>
        )}
      </div>
    </div>
  )
}

// SessionChip sub-component
interface SessionChipProps {
  session: UnanalyzedSession
  status: SessionStatus
  error?: string
}

function SessionChip({ session, status, error }: SessionChipProps) {
  const icons: Record<SessionStatus, JSX.Element> = {
    pending: <Clock className="w-5 h-5 text-gray-400" />,
    analyzing: <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />,
    completed: <CheckCircle className="w-5 h-5 text-green-600" />,
    failed: <AlertCircle className="w-5 h-5 text-red-600" />
  }

  // Prioritize scenario name (e.g. "Родитель с ребенком") over generic session name
  const displayTitle = session.scenario_name || session.session_name
  const displayName = `${session.employee_name} - ${displayTitle}`

  return (
    <div
      className="flex items-center space-x-3 px-4 py-2 hover:bg-gray-50 transition-colors cursor-default"
      title={error || displayName}
    >
      <div className="flex-shrink-0">
        {icons[status]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {displayTitle}
        </p>
        <p className="text-xs text-gray-500 truncate">
          {session.employee_name}
          {status === 'failed' && error && ` - ${error}`}
        </p>
      </div>
    </div>
  )
}
