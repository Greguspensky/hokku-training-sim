'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, MessageCircle, Brain, Video, Target, User } from 'lucide-react'
import { trainingSessionsService, type TrainingSession } from '@/lib/training-sessions'

interface SessionWithEmployee extends TrainingSession {
  employee_name?: string
}

export default function SessionFeed({ companyId }: { companyId: string }) {
  const [sessions, setSessions] = useState<SessionWithEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadFeed()
  }, [companyId])

  const loadFeed = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('📰 Loading session feed for company:', companyId)

      // Load company sessions with employee information
      const response = await fetch(`/api/company-sessions?company_id=${companyId}`)
      const data = await response.json()

      if (response.ok) {
        setSessions(data.sessions || [])
        console.log(`✅ Loaded ${data.sessions?.length || 0} sessions`)
      } else {
        setError(data.error || 'Failed to load sessions')
      }
    } catch (err) {
      console.error('❌ Error loading session feed:', err)
      setError('Failed to load session feed')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      })
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Feed</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={loadFeed}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="text-gray-400 text-5xl mb-4">📚</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Training Sessions Yet</h3>
        <p className="text-gray-500">
          Training sessions from your employees will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Training Sessions</h2>

      {sessions.map((session) => (
        <div
          key={session.id}
          className="bg-white rounded-lg shadow border border-gray-200"
        >
          <div className="p-6">
            {/* Header with employee name */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <User className="w-4 h-4 mr-2 text-gray-500" />
                  <span className="font-semibold text-gray-900">
                    {session.employee_name || 'Unknown Employee'}
                  </span>
                  <span className="text-gray-500 mx-2">completed a</span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      session.training_mode === 'theory'
                        ? 'bg-blue-100 text-blue-800'
                        : session.training_mode === 'recommendation_tts'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {session.training_mode === 'theory'
                      ? 'Theory Q&A'
                      : session.training_mode === 'recommendation_tts'
                      ? 'Product Recommendations'
                      : 'Service Practice'}
                  </span>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {session.session_name}
                </h3>

                <div className="flex items-center text-sm text-gray-500">
                  <Calendar className="w-4 h-4 mr-1" />
                  {formatDate(session.started_at)} at {formatTime(session.started_at)}
                </div>

                <div className="text-xs text-gray-400 font-mono mt-1 space-y-0.5">
                  <div>Attempt ID: {session.id}</div>
                  {session.scenario_id && (
                    <div>Scenario ID: {session.scenario_id}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="flex items-center text-gray-600">
                <Clock className="w-4 h-4 mr-2" />
                <span>{trainingSessionsService.formatDuration(session.session_duration_seconds)}</span>
              </div>
              <div className="flex items-center text-gray-600">
                {session.training_mode === 'recommendation_tts' ? (
                  <>
                    <Target className="w-4 h-4 mr-2" />
                    <span>{session.conversation_transcript.length} questions</span>
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    <span>{session.conversation_transcript.length} messages</span>
                  </>
                )}
              </div>
              <div className="flex items-center text-gray-600">
                <Brain className="w-4 h-4 mr-2" />
                <span>{session.language.toUpperCase()}</span>
              </div>
            </div>

            {session.knowledge_context && session.knowledge_context.documents && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500 mb-1">Knowledge Documents:</div>
                <div className="flex flex-wrap gap-1">
                  {session.knowledge_context.documents.slice(0, 3).map((doc, index) => (
                    <span
                      key={index}
                      className="inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs"
                    >
                      {doc.title}
                    </span>
                  ))}
                  {session.knowledge_context.documents.length > 3 && (
                    <span className="inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                      +{session.knowledge_context.documents.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {session.video_recording_url && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500 mb-2 flex items-center">
                  <Video className="w-3 h-3 mr-1" />
                  Video Recording:
                </div>
                <div className="bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                  <video
                    src={session.video_recording_url}
                    controls
                    className="w-full h-full object-cover"
                    preload="metadata"
                  >
                    Your browser does not support video playback.
                  </video>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
