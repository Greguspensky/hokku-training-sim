'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { AssignmentWithDetails } from '@/lib/track-assignments'
import TrainingTrackCard from '@/components/Employee/TrainingTrackCard'
import IndividualScenariosCard from '@/components/Employee/IndividualScenariosCard'
import UserHeader from '@/components/Shared/UserHeader'
import QuestionProgressDashboard from '@/components/Analytics/QuestionProgressDashboard'
import SessionCard from '@/components/Employee/SessionCard'
import { useAuth } from '@/contexts/AuthContext'
import { trainingSessionsService, type TrainingSession } from '@/lib/training-sessions'

// Declare Weglot global type
declare global {
  interface Window {
    Weglot: any
  }
}

export default function EmployeeDashboard() {
  const t = useTranslations('employeeDashboard')
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [redirectTimeout, setRedirectTimeout] = useState<NodeJS.Timeout | null>(null)
  const [activeTab, setActiveTab] = useState<'tracks' | 'history' | 'progress'>('tracks')
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyStats, setHistoryStats] = useState({
    totalSessions: 0,
    totalDuration: 0,
    completedThisWeek: 0
  })
  const { user, loading: authLoading } = useAuth()

  // Get employee ID from authenticated user
  // For training sessions: use user.id (auth ID)
  // For assignments: need to look up employee table ID via API
  const employeeId = user?.id
  const [employeeTableId, setEmployeeTableId] = useState<string | null>(null)

  // Load employee table ID
  useEffect(() => {
    const loadEmployeeTableId = async () => {
      if (!employeeId || !user?.company_id) return

      try {
        const response = await fetch(`/api/employees?company_id=${user.company_id}`)
        const data = await response.json()

        if (data.success && data.data?.employees) {
          const employee = data.data.employees.find((e: any) => e.email === user.email)
          if (employee) {
            setEmployeeTableId(employee.id)
            console.log('📋 Found employee table ID:', employee.id)
          }
        }
      } catch (error) {
        console.error('Failed to load employee table ID:', error)
      }
    }

    loadEmployeeTableId()
  }, [employeeId, user?.company_id, user?.email])

  // Load and apply company UI language setting
  useEffect(() => {
    const loadCompanyLanguage = async () => {
      if (!user?.company_id) return

      try {
        const response = await fetch(`/api/settings/company-settings?company_id=${user.company_id}`)
        const result = await response.json()

        if (result.success && result.data && result.data.settings) {
          const companyUiLanguage = result.data.settings.ui_language

          if (companyUiLanguage) {
            // Check current cookie
            const currentLocale = document.cookie
              .split('; ')
              .find(row => row.startsWith('NEXT_LOCALE='))
              ?.split('=')[1]

            // If company language differs from current, update and reload
            if (currentLocale !== companyUiLanguage) {
              console.log(`🌐 Applying company UI language: ${companyUiLanguage}`)
              document.cookie = `NEXT_LOCALE=${companyUiLanguage}; path=/; max-age=31536000; SameSite=Lax`
              window.location.reload()
            }
          }
        }
      } catch (error) {
        console.error('Failed to load company UI language:', error)
      }
    }

    loadCompanyLanguage()
  }, [user?.company_id])

  const loadAssignments = async () => {
    if (!employeeTableId) {
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`/api/tracks/track-assignments-standalone?employee_id=${employeeTableId}`)
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
    if (!employeeId) return

    try {
      setHistoryLoading(true)
      console.log('📚 Loading training session history for employee:', employeeId)

      // Load sessions and stats in parallel
      const [sessionHistory, employeeStats] = await Promise.all([
        trainingSessionsService.getEmployeeSessionHistory(employeeId),
        trainingSessionsService.getEmployeeStats(employeeId)
      ])

      setSessions(sessionHistory)
      setHistoryStats(employeeStats)

      console.log(`✅ Loaded ${sessionHistory.length} training sessions`)
    } catch (err) {
      console.error('❌ Failed to load training history:', err)
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (employeeTableId) {
      loadAssignments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeTableId])

  // Load training history when tab changes to history
  useEffect(() => {
    if (activeTab === 'history' && employeeId && sessions.length === 0) {
      loadTrainingHistory()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, employeeId])

  // Initialize Weglot translation widget
  useEffect(() => {
    // Load Weglot script
    const script = document.createElement('script')
    script.src = 'https://cdn.weglot.com/weglot.min.js'
    script.async = true
    script.onload = () => {
      if (window.Weglot) {
        window.Weglot.initialize({
          api_key: 'wg_661e7afb61a7fc276bca9e69567c8d8e6'
        })
        console.log('✅ Weglot initialized successfully')
      }
    }
    script.onerror = () => {
      console.error('❌ Failed to load Weglot script')
    }
    document.head.appendChild(script)

    // Cleanup on unmount
    return () => {
      if (script.parentNode) {
        document.head.removeChild(script)
      }
    }
  }, [])

  // Handle authentication - only redirect if definitely not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      // Give more time for auth to stabilize, especially when opening multiple tabs
      const timeout = setTimeout(() => {
        console.log('Employee page - no user after extended timeout, redirecting to signin')
        if (typeof window !== 'undefined') {
          window.location.href = '/signin'
        }
      }, 6000) // 6 second delay to allow auth state to fully stabilize

      setRedirectTimeout(timeout)
      return () => clearTimeout(timeout)
    } else if (user) {
      // Clear timeout if user is found
      if (redirectTimeout) {
        clearTimeout(redirectTimeout)
        setRedirectTimeout(null)
      }
    }
  }, [authLoading, user])

  const stats = {
    completed: assignments.filter(a => a.status === 'completed').length,
    totalHours: assignments.reduce((sum, a) => {
      // Rough calculation based on scenario progress
      const hoursPerScenario = 0.5 // 30 minutes average
      const completedScenarios = a.scenario_progress?.filter(p => p.status === 'completed').length || 0
      return sum + (completedScenarios * hoursPerScenario)
    }, 0),
    achievements: assignments.filter(a => a.progress_percentage === 100).length
  }

  // Debug logging
  console.log('Employee page - authLoading:', authLoading, 'user:', !!user, 'email:', user?.email)

  // Show loading state while checking authentication
  if (authLoading) {
    console.log('Employee page - showing auth loading')
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loading')}</p>
        </div>
      </div>
    )
  }


  // Don't render anything while redirect is pending
  if (!authLoading && !user && redirectTimeout) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('checkingAuthentication')}</p>
        </div>
      </div>
    )
  }

  console.log('Employee page - rendering main content')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* User Header */}
        <UserHeader
          title={t('trainingDashboard')}
          subtitle={t('welcomePortal')}
        />

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('tracks')}
                className={`${
                  activeTab === 'tracks'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                {t('myTrainingTracks')}
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`${
                  activeTab === 'history'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                {t('trainingHistory')}
              </button>
              <button
                onClick={() => setActiveTab('progress')}
                className={`${
                  activeTab === 'progress'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                {t('progressByTopic')}
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'tracks' && (
          <>
            {/* Training Tracks Section */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('myTrainingTracks')}</h2>

          {loading ? (
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="animate-pulse bg-white rounded-lg shadow p-6">
                  <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3 mb-4"></div>
                  <div className="h-2 bg-gray-200 rounded w-full"></div>
                </div>
              ))}
            </div>
          ) : assignments.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">{t('noTracksAssignedYet')}</h3>
              <p className="text-gray-500 mb-4">
                {t('noTracksDescription')}
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 max-w-md mx-auto">
                <p className="text-sm text-blue-700">
                  <strong>{t('whatHappensNext')}</strong><br />
                  • {t('managerWillAssign')}<br />
                  • {t('youWillSeeScenarios')}<br />
                  • {t('trackProgressAchievements')}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {assignments.map((assignment) => (
                <TrainingTrackCard key={assignment.id} assignment={assignment} />
              ))}
            </div>
          )}
        </div>

            {/* Individual Scenarios Section */}
            <div className="mt-8">
              <IndividualScenariosCard employeeId={employeeTableId || employeeId} />
            </div>
          </>
        )}

        {/* Training History Tab */}
        {activeTab === 'history' && (
          <div>
            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">{historyStats.totalSessions}</div>
                <div className="text-sm text-gray-600">{t('totalSessions')}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {trainingSessionsService.formatDuration(historyStats.totalDuration)}
                </div>
                <div className="text-sm text-gray-600">{t('totalTrainingTime')}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">{historyStats.completedThisWeek}</div>
                <div className="text-sm text-gray-600">{t('completedThisWeek')}</div>
              </div>
            </div>

            {/* Sessions List */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('trainingSessions')}</h2>

              {historyLoading ? (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">{t('loadingHistory')}</p>
                </div>
              ) : sessions.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                  <div className="text-gray-400 text-5xl mb-4">📚</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{t('noSessionsYet')}</h3>
                  <p className="text-gray-500 mb-4">
                    {t('noSessionsDescription')}
                  </p>
                  <button
                    onClick={() => setActiveTab('tracks')}
                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
                  >
                    {t('startTraining')}
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
          </div>
        )}

        {/* Progress by Topic Tab */}
        {activeTab === 'progress' && (
          <div>
            <QuestionProgressDashboard />
          </div>
        )}

      </div>
    </div>
  )
}