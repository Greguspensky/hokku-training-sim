'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock, Calendar, Brain, MessageCircle, User } from 'lucide-react'
import { trainingSessionsService, type TrainingSession } from '@/lib/training-sessions'
import { useAuth } from '@/contexts/AuthContext'
import UserHeader from '@/components/UserHeader'
import SessionCard from '@/components/Employee/SessionCard'

export default function TrainingHistoryPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalDuration: 0,
    completedThisWeek: 0
  })

  useEffect(() => {
    if (!user) return
    loadHistory()
  }, [user])

  const loadHistory = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      const employeeId = user.employee_record_id || user.id
      console.log('📚 Loading training session history for employee:', employeeId)

      // Load sessions and stats in parallel
      const [sessionHistory, employeeStats] = await Promise.all([
        trainingSessionsService.getEmployeeSessionHistory(employeeId),
        trainingSessionsService.getEmployeeStats(employeeId)
      ])

      setSessions(sessionHistory)
      setStats(employeeStats)

      console.log(`✅ Loaded ${sessionHistory.length} training sessions`)
    } catch (err) {
      console.error('❌ Failed to load training history:', err)
      setError('Failed to load training history')
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading training history...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading History</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/employee')}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <UserHeader
          title="My Training History"
          subtitle="View your completed training sessions and transcripts"
        />

        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/employee')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">{stats.totalSessions}</div>
            <div className="text-sm text-gray-600">Total Sessions</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {trainingSessionsService.formatDuration(stats.totalDuration)}
            </div>
            <div className="text-sm text-gray-600">Total Training Time</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">{stats.completedThisWeek}</div>
            <div className="text-sm text-gray-600">Completed This Week</div>
          </div>
        </div>

        {/* Sessions List */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Training Sessions</h2>

          {sessions.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="text-gray-400 text-5xl mb-4">📚</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Training Sessions Yet</h3>
              <p className="text-gray-500 mb-4">
                You haven't completed any training sessions yet. Start your first training session to see it here.
              </p>
              <button
                onClick={() => router.push('/employee')}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
              >
                Start Training
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          )}
        </div>

        {/* Back to Dashboard */}
        {sessions.length > 0 && (
          <div className="mt-8 text-center">
            <button
              onClick={() => router.push('/employee')}
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-200"
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}