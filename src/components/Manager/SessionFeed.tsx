'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, MessageCircle, Brain, Video, Target, User, Trash2, AlertTriangle, X } from 'lucide-react'
import { trainingSessionsService, type TrainingSession } from '@/lib/training-sessions'
import { useAuth } from '@/contexts/AuthContext'

interface SessionWithEmployee extends TrainingSession {
  employee_name?: string
  scenario_name?: string | null
  scenario_type?: string | null
}

export default function SessionFeed({ companyId }: { companyId: string }) {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<SessionWithEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [displayLimit, setDisplayLimit] = useState(10) // Initially show only 10 sessions
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<SessionWithEmployee | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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

  const handleDeleteClick = (session: SessionWithEmployee) => {
    setSessionToDelete(session)
    setShowDeleteDialog(true)
    setDeleteError(null)
  }

  const confirmDelete = async () => {
    if (!sessionToDelete || !user?.id) return

    try {
      setDeletingSessionId(sessionToDelete.id)
      setDeleteError(null)

      console.log('🗑️ Deleting session:', sessionToDelete.id)
      const result = await trainingSessionsService.deleteSession(sessionToDelete.id, user.id)

      if (result.success) {
        console.log('✅ Session deleted successfully')
        // Remove from local state
        setSessions(prev => prev.filter(s => s.id !== sessionToDelete.id))
        setShowDeleteDialog(false)
        setSessionToDelete(null)
      } else {
        throw new Error('Deletion failed')
      }
    } catch (error) {
      console.error('❌ Failed to delete session:', error)
      setDeleteError(
        error instanceof Error
          ? error.message
          : 'Failed to delete session. Please try again.'
      )
    } finally {
      setDeletingSessionId(null)
    }
  }

  const cancelDelete = () => {
    setShowDeleteDialog(false)
    setSessionToDelete(null)
    setDeleteError(null)
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

  const displayedSessions = sessions.slice(0, displayLimit)
  const hasMore = sessions.length > displayLimit

  return (
    <div className="space-y-4">
      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && sessionToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Delete Training Session?
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  This will permanently delete:
                </p>
                <ul className="text-sm text-gray-600 space-y-1 mb-4 ml-4">
                  <li>• Session transcript and data</li>
                  <li>• Video/audio recordings from storage</li>
                  <li>• ElevenLabs conversation history</li>
                </ul>
                <p className="text-sm font-medium text-gray-900 mb-2">
                  Session: {sessionToDelete.scenario_name || sessionToDelete.session_name}
                </p>
                <p className="text-sm text-gray-600">
                  Employee: {sessionToDelete.employee_name || 'Unknown'}
                </p>
                <p className="text-sm text-red-600 font-semibold mt-3">
                  This action cannot be undone.
                </p>
                {deleteError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-800">{deleteError}</p>
                  </div>
                )}
              </div>
              <button
                onClick={cancelDelete}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                disabled={deletingSessionId !== null}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={cancelDelete}
                disabled={deletingSessionId !== null}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deletingSessionId !== null}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {deletingSessionId ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  'Delete Session'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Training Sessions</h2>
        <span className="text-sm text-gray-500">
          Showing {displayedSessions.length} of {sessions.length}
        </span>
      </div>

      {displayedSessions.map((session) => (
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
                  {session.scenario_name || session.session_name}
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
                  {session.elevenlabs_conversation_id && (
                    <div>ElevenLabs Conv ID: {session.elevenlabs_conversation_id}</div>
                  )}
                  {session.video_recording_url && (
                    <div>Video ID: {session.video_recording_url.split('/').pop()}</div>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDeleteClick(session)}
                disabled={deletingSessionId === session.id}
                className={`ml-3 p-2 rounded-md transition-colors ${
                  deletingSessionId === session.id
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'hover:bg-red-100 text-gray-500 hover:text-red-600'
                }`}
                title="Delete session"
              >
                {deletingSessionId === session.id ? (
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
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
                <div className="bg-black rounded-lg overflow-hidden flex items-center justify-center">
                  <video
                    src={session.video_recording_url}
                    controls
                    className="max-w-full max-h-[600px] object-contain"
                    preload="none"
                  >
                    Your browser does not support video playback.
                  </video>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {hasMore && (
        <div className="text-center pt-4">
          <button
            onClick={() => setDisplayLimit(prev => prev + 10)}
            className="inline-flex items-center px-6 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Load More ({sessions.length - displayLimit} remaining)
          </button>
        </div>
      )}
    </div>
  )
}
