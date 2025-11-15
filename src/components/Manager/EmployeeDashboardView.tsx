'use client'

import { useState, useEffect } from 'react'
import { Employee } from '@/lib/employees'
import { AssignmentWithDetails } from '@/lib/track-assignments'
import { trainingSessionsService, type TrainingSession } from '@/lib/training-sessions'
import TrainingTrackCard from '@/components/Employee/TrainingTrackCard'
import SessionCard from '@/components/Employee/SessionCard'
import QuestionProgressDashboard from '@/components/QuestionProgressDashboard'
import EmployeeSessionAnalysis from '@/components/Manager/EmployeeSessionAnalysis'
import { User, Calendar, Mail, TrendingUp, Clock, Award, AlertTriangle, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface EmployeeDashboardViewProps {
  employee: Employee
}

// Cache for employee data to prevent re-fetching
interface EmployeeDataCache {
  assignments?: AssignmentWithDetails[]
  sessions?: TrainingSession[]
  historyStats?: {
    totalSessions: number
    totalDuration: number
    completedThisWeek: number
  }
  authUserId?: string | null
}

const employeeCache = new Map<string, EmployeeDataCache>()

export default function EmployeeDashboardView({ employee }: EmployeeDashboardViewProps) {
  const { user: currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState<'tracks' | 'history' | 'progress' | 'analysis'>('tracks')
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([])
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [historyStats, setHistoryStats] = useState({
    totalSessions: 0,
    totalDuration: 0,
    completedThisWeek: 0
  })
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<TrainingSession | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [analyzingSessionId, setAnalyzingSessionId] = useState<string | null>(null)

  // Load auth user ID from employee email (with caching)
  useEffect(() => {
    const loadAuthUserId = async () => {
      if (!employee.email) return

      // Check cache first
      const cached = employeeCache.get(employee.id)
      if (cached?.authUserId !== undefined) {
        setAuthUserId(cached.authUserId)
        return
      }

      try {
        const response = await fetch(`/api/auth-user-by-email?email=${encodeURIComponent(employee.email)}`)
        const data = await response.json()

        if (data.success && data.authUserId) {
          setAuthUserId(data.authUserId)
          // Cache the result
          const cache = employeeCache.get(employee.id) || {}
          cache.authUserId = data.authUserId
          employeeCache.set(employee.id, cache)
        }
      } catch (error) {
        console.error('Failed to load auth user ID:', error)
      }
    }

    loadAuthUserId()
  }, [employee.email, employee.id])

  // Load assignments when component mounts or employee changes
  useEffect(() => {
    if (activeTab === 'tracks') {
      loadAssignments()
    }
  }, [employee.id, activeTab])

  // Load training history when switching to history tab and authUserId is available
  useEffect(() => {
    if (activeTab === 'history' && authUserId) {
      loadTrainingHistory()
    }
  }, [employee.id, activeTab, authUserId])

  const loadAssignments = async () => {
    // Check cache first
    const cached = employeeCache.get(employee.id)
    if (cached?.assignments) {
      setAssignments(cached.assignments)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/track-assignments-standalone?employee_id=${employee.id}`)
      const data = await response.json()

      if (data.success) {
        const assignmentsData = data.assignments || []
        setAssignments(assignmentsData)
        // Cache the result
        const cache = employeeCache.get(employee.id) || {}
        cache.assignments = assignmentsData
        employeeCache.set(employee.id, cache)
      }
    } catch (error) {
      console.error('Failed to load assignments:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTrainingHistory = async () => {
    if (!authUserId) return

    // Check cache first
    const cached = employeeCache.get(employee.id)
    if (cached?.sessions && cached?.historyStats) {
      setSessions(cached.sessions)
      setHistoryStats(cached.historyStats)
      setHistoryLoading(false)
      return
    }

    try {
      setHistoryLoading(true)

      // Fetch sessions filtered by employee on the server side
      // Try with authUserId first (the actual user auth ID), fallback to employee.id
      const employeeIdParam = authUserId || employee.id
      const companyResponse = await fetch(
        `/api/company-sessions?company_id=${employee.company_id}&employee_id=${employeeIdParam}`
      )
      const companyData = await companyResponse.json()

      const employeeSessions = companyData.sessions || []

      setSessions(employeeSessions)

      // Calculate statistics
      const now = new Date()
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      const stats = {
        totalSessions: employeeSessions.length,
        totalDuration: employeeSessions.reduce((sum: number, session: any) =>
          sum + (session.session_duration_seconds || 0), 0),
        completedThisWeek: employeeSessions.filter((session: any) => {
          const sessionDate = new Date(session.ended_at || session.created_at)
          return sessionDate >= oneWeekAgo
        }).length
      }

      setHistoryStats(stats)

      // Cache the results
      const cache = employeeCache.get(employee.id) || {}
      cache.sessions = employeeSessions
      cache.historyStats = stats
      employeeCache.set(employee.id, cache)
    } catch (error) {
      console.error('Failed to load training history:', error)
      setSessions([])
      setHistoryStats({
        totalSessions: 0,
        totalDuration: 0,
        completedThisWeek: 0
      })
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return

    setSessionToDelete(session)
    setShowDeleteDialog(true)
    setDeleteError(null)
  }

  const handleAnalyzeSession = async (sessionId: string) => {
    if (analyzingSessionId) return // Already analyzing another session

    try {
      setAnalyzingSessionId(sessionId)
      console.log('📊 Starting analysis for session:', sessionId)

      // Find the session to determine training mode
      const session = sessions.find(s => s.id === sessionId)
      if (!session) {
        alert('Session not found')
        return
      }

      // Determine which API endpoint to use based on training mode
      const apiEndpoint = session.training_mode === 'theory'
        ? '/api/assess-theory-session'
        : '/api/assess-service-practice-session'

      const requestBody = session.training_mode === 'theory'
        ? {
            sessionId,
            userId: authUserId,
            transcript: session.conversation_transcript
          }
        : {
            sessionId,
            forceReAnalysis: false
          }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()

      if (result.success) {
        console.log('✅ Analysis completed:', result)
        // Reload the training history to show the new score badge
        await loadTrainingHistory()
      } else {
        console.error('❌ Analysis failed:', result.error)
        alert('Failed to analyze session: ' + (result.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('❌ Error analyzing session:', error)
      alert('Failed to analyze session. Please try again.')
    } finally {
      setAnalyzingSessionId(null)
    }
  }

  const confirmDelete = async () => {
    if (!sessionToDelete || !currentUser?.id) return

    try {
      setDeletingSessionId(sessionToDelete.id)
      setDeleteError(null)

      console.log('🗑️ Deleting session:', sessionToDelete.id)
      const result = await trainingSessionsService.deleteSession(sessionToDelete.id, currentUser.id)

      if (result.success) {
        console.log('✅ Session deleted successfully')

        // Remove from local state
        setSessions(prev => prev.filter(s => s.id !== sessionToDelete.id))

        // Update stats
        setHistoryStats(prev => ({
          totalSessions: prev.totalSessions - 1,
          totalDuration: prev.totalDuration - (sessionToDelete.session_duration_seconds || 0),
          completedThisWeek: prev.completedThisWeek - (
            new Date(sessionToDelete.ended_at || sessionToDelete.created_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) ? 1 : 0
          )
        }))

        // Clear cache for this employee
        const cache = employeeCache.get(employee.id)
        if (cache) {
          cache.sessions = undefined
          cache.historyStats = undefined
          employeeCache.set(employee.id, cache)
        }

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

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not available'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <>
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
                  Session: {sessionToDelete.session_name}
                </p>
                <p className="text-sm text-gray-600">
                  Employee: {employee.name}
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

      <div className="space-y-6">
      {/* Employee Info Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{employee.name}</h2>
              <div className="space-y-1">
                {employee.email && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Mail className="w-4 h-4 mr-2" />
                    {employee.email}
                  </div>
                )}
                {employee.joined_at && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    Joined {formatDate(employee.joined_at)}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {employee.has_joined ? (
              <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                Active
              </span>
            ) : (
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
                Invited
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('tracks')}
              className={`${
                activeTab === 'tracks'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Training Tracks
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Training History
            </button>
            <button
              onClick={() => setActiveTab('progress')}
              className={`${
                activeTab === 'progress'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Progress by Topic
            </button>
            <button
              onClick={() => setActiveTab('analysis')}
              className={`${
                activeTab === 'analysis'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Session Analysis
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Training Tracks Tab */}
          {activeTab === 'tracks' && (
            <div>
              {loading ? (
                <div className="space-y-4">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="animate-pulse bg-gray-50 rounded-lg p-6">
                      <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                      <div className="h-4 bg-gray-200 rounded w-2/3 mb-4"></div>
                      <div className="h-2 bg-gray-200 rounded w-full"></div>
                    </div>
                  ))}
                </div>
              ) : assignments.length === 0 ? (
                <div className="text-center py-12">
                  <TrendingUp className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Training Tracks Assigned
                  </h3>
                  <p className="text-gray-500">
                    This employee hasn't been assigned any training tracks yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {assignments.map((assignment) => (
                    <TrainingTrackCard
                      key={assignment.id}
                      assignment={assignment}
                      managerView={true}
                      employeeUserId={authUserId || undefined}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Training History Tab */}
          {activeTab === 'history' && (
            <div>
              {historyLoading ? (
                <div className="space-y-4">
                  <div className="animate-pulse">
                    <div className="h-20 bg-gray-200 rounded mb-4"></div>
                    <div className="h-20 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Statistics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-gray-50 rounded-lg p-6 text-center">
                      <div className="text-3xl font-bold text-blue-600 mb-2">
                        {historyStats.totalSessions}
                      </div>
                      <div className="text-sm text-gray-600">Total Sessions</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-6 text-center">
                      <div className="text-3xl font-bold text-green-600 mb-2">
                        {trainingSessionsService.formatDuration(historyStats.totalDuration)}
                      </div>
                      <div className="text-sm text-gray-600">Total Training Time</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-6 text-center">
                      <div className="text-3xl font-bold text-purple-600 mb-2">
                        {historyStats.completedThisWeek}
                      </div>
                      <div className="text-sm text-gray-600">Completed This Week</div>
                    </div>
                  </div>

                  {/* Sessions List */}
                  {sessions.length === 0 ? (
                    <div className="text-center py-12">
                      <Clock className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No Training Sessions Yet
                      </h3>
                      <p className="text-gray-500">
                        This employee hasn't completed any training sessions yet.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sessions.map((session) => (
                        <SessionCard
                          key={session.id}
                          session={session}
                          showClickable={true}
                          showDeleteButton={true}
                          showAnalyzeButton={true}
                          onDelete={handleDeleteSession}
                          onAnalyze={handleAnalyzeSession}
                          isDeleting={deletingSessionId === session.id}
                          isAnalyzing={analyzingSessionId === session.id}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Progress by Topic Tab */}
          {activeTab === 'progress' && (
            <div>
              <QuestionProgressDashboard
                userId={authUserId || undefined}
                companyId={employee.company_id}
                managerView={true}
              />
            </div>
          )}

          {/* Session Analysis Tab */}
          {activeTab === 'analysis' && (
            <div>
              <EmployeeSessionAnalysis
                employeeId={authUserId || employee.id}
                employeeName={employee.name}
                companyId={employee.company_id}
              />
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  )
}
