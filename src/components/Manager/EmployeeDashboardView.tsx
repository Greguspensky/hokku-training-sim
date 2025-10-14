'use client'

import { useState, useEffect } from 'react'
import { Employee } from '@/lib/employees'
import { AssignmentWithDetails } from '@/lib/track-assignments'
import { trainingSessionsService, type TrainingSession } from '@/lib/training-sessions'
import TrainingTrackCard from '@/components/Employee/TrainingTrackCard'
import SessionCard from '@/components/Employee/SessionCard'
import QuestionProgressDashboard from '@/components/QuestionProgressDashboard'
import { User, Calendar, Mail, TrendingUp, Clock, Award } from 'lucide-react'

interface EmployeeDashboardViewProps {
  employee: Employee
}

export default function EmployeeDashboardView({ employee }: EmployeeDashboardViewProps) {
  const [activeTab, setActiveTab] = useState<'tracks' | 'history' | 'progress'>('tracks')
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

  // Load auth user ID from employee email
  useEffect(() => {
    const loadAuthUserId = async () => {
      if (!employee.email) return

      try {
        const response = await fetch(`/api/auth-user-by-email?email=${encodeURIComponent(employee.email)}`)
        const data = await response.json()

        if (data.success && data.authUserId) {
          setAuthUserId(data.authUserId)
        }
      } catch (error) {
        console.error('Failed to load auth user ID:', error)
      }
    }

    loadAuthUserId()
  }, [employee.email])

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
    try {
      setLoading(true)
      const response = await fetch(`/api/track-assignments-standalone?employee_id=${employee.id}`)
      const data = await response.json()

      if (data.success) {
        setAssignments(data.assignments || [])
      }
    } catch (error) {
      console.error('Failed to load assignments:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTrainingHistory = async () => {
    if (!authUserId) return

    try {
      setHistoryLoading(true)

      // Fetch all company sessions and filter for this employee
      // Using company-sessions API with supabaseAdmin to bypass RLS
      const companyResponse = await fetch(`/api/company-sessions?company_id=${employee.company_id}`)
      const companyData = await companyResponse.json()

      // Filter sessions for this specific employee
      const employeeSessions = companyData.sessions?.filter((s: any) =>
        s.employee_id === authUserId || s.employee_id === employee.id
      ) || []

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
                        <SessionCard key={session.id} session={session} showClickable={true} />
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
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
