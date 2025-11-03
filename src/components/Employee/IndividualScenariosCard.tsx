'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import HiddenContent from '@/components/SurpriseMode/HiddenContent'

interface KnowledgeTopic {
  id: string
  name: string
  description: string
  category: string
  difficulty_level: number
}

interface ScenarioStats {
  attemptCount: number
  lastAttempt: string | null
  completionPercentage: number
  isCompleted: boolean
}

interface ScenarioAssignment {
  id: string
  scenario_id: string
  employee_id: string
  assigned_by: string
  assigned_at: string
  status: 'assigned' | 'in_progress' | 'completed'
  notes?: string
  max_attempts?: number | null
  scenarios: {
    id: string
    title: string
    description: string
    scenario_type: string
    session_time_limit_minutes?: number
    track_id: string
    tracks: {
      id: string
      name: string
    }
  }
}

interface IndividualScenariosCardProps {
  employeeId: string  // For loading assignments (employees table ID)
}

export default function IndividualScenariosCard({ employeeId }: IndividualScenariosCardProps) {
  const [scenarioAssignments, setScenarioAssignments] = useState<ScenarioAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [topics, setTopics] = useState<{[key: string]: KnowledgeTopic}>({})
  const [scenarioStats, setScenarioStats] = useState<{[key: string]: ScenarioStats}>({})
  const { user } = useAuth()

  // Use auth user ID for stats queries (training sessions are saved with auth user ID)
  const statsUserId = user?.id

  // Function to fetch topic details
  const loadTopics = async (topicIds: string[]) => {
    if (topicIds.length === 0) return

    try {
      // Use a demo company ID for now, since we don't have easy access to company ID from assignment data
      const response = await fetch(`/api/knowledge-assessment/topics?company_id=demo-company`)
      const data = await response.json()

      if (data.success) {
        const topicMap: {[key: string]: KnowledgeTopic} = {}
        data.topics.forEach((topic: KnowledgeTopic) => {
          if (topicIds.includes(topic.id)) {
            topicMap[topic.id] = topic
          }
        })
        setTopics(prev => ({ ...prev, ...topicMap }))
      }
    } catch (error) {
      console.error('Failed to load topics:', error)
    }
  }

  // Load statistics for all scenarios
  const loadScenarioStats = async (assignments: ScenarioAssignment[]) => {
    if (!statsUserId) {
      console.log('⚠️ No auth user ID available for loading stats')
      return
    }

    console.log('📊 Loading stats with auth user ID:', statsUserId)

    const statsPromises = assignments.map(async (assignment) => {
      try {
        const response = await fetch(`/api/scenario-stats?scenario_id=${assignment.scenario_id}&user_id=${statsUserId}`)
        const data = await response.json()

        if (data.success) {
          console.log(`✅ Loaded stats for scenario ${assignment.scenario_id}:`, data.stats)
          return { scenarioId: assignment.scenario_id, stats: data.stats }
        }
      } catch (error) {
        console.error(`Failed to load stats for scenario ${assignment.scenario_id}:`, error)
      }
      return null
    })

    const results = await Promise.all(statsPromises)
    const statsMap: {[key: string]: ScenarioStats} = {}

    results.forEach(result => {
      if (result) {
        statsMap[result.scenarioId] = result.stats
      }
    })

    console.log('📊 Stats map:', statsMap)
    setScenarioStats(statsMap)
  }

  const loadScenarioAssignments = async () => {
    console.log('🎯 IndividualScenariosCard - employeeId:', employeeId)

    if (!employeeId) {
      console.log('❌ No employeeId provided')
      setLoading(false)
      return
    }

    try {
      const url = `/api/scenario-assignments?employee_id=${employeeId}`
      console.log('🔍 Fetching scenario assignments from:', url)

      const response = await fetch(url)
      const data = await response.json()

      console.log('📊 API Response:', data)

      if (data.success) {
        console.log('✅ Found scenario assignments:', data.assignments.length)
        const assignments = data.assignments || []
        console.log('🔍 First assignment data:', assignments[0])
        console.log('🔍 First scenario data:', assignments[0]?.scenarios)
        setScenarioAssignments(assignments)

        // Load stats for all scenarios
        if (assignments.length > 0) {
          loadScenarioStats(assignments)
        }
      } else {
        console.log('❌ API Error:', data.error)
      }
    } catch (error) {
      console.error('Failed to load scenario assignments:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadScenarioAssignments()
  }, [employeeId, statsUserId])

  if (loading) {
    return (
      <div className="animate-pulse bg-white rounded-lg shadow p-6">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3 mb-4"></div>
        <div className="h-20 bg-gray-200 rounded w-full"></div>
      </div>
    )
  }

  if (scenarioAssignments.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Individual Scenarios</h3>
        <div className="text-center py-8">
          <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-1l-4 4z" />
          </svg>
          <p className="text-gray-500 text-sm">No individual scenarios assigned</p>
        </div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'in_progress': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Completed'
      case 'in_progress': return 'In Progress'
      default: return 'Ready to Start'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Individual Scenarios</h3>
        <p className="text-sm text-gray-500 mt-1">
          Specific scenarios assigned to you individually
        </p>
      </div>

      <div className="divide-y divide-gray-200">
        {scenarioAssignments.map((assignment) => {
          const stats = scenarioStats[assignment.scenario_id]
          const maxAttempts = assignment.max_attempts
          const currentAttempts = stats?.attemptCount || 0
          const isLimitReached = maxAttempts && currentAttempts >= maxAttempts

          return (
            <div key={assignment.id} className="p-6">
              {/* Desktop Layout */}
              <div className="hidden md:flex md:items-start md:justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h4 className="text-lg font-medium text-gray-900">
                      <HiddenContent type="title" customPlaceholder="Mystery Scenario" />
                    </h4>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}>
                      {getStatusText(assignment.status)}
                    </span>
                  </div>

                  <p className="text-gray-600 mb-3 text-sm">
                    <HiddenContent type="description" showIcon={false} />
                  </p>

                  <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {assignment.scenarios.tracks.name}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      assignment.scenarios.scenario_type === 'theory'
                        ? 'bg-purple-100 text-purple-800'
                        : assignment.scenarios.scenario_type === 'recommendations'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {assignment.scenarios.scenario_type === 'theory' ? 'Theory (Q&A)' :
                       assignment.scenarios.scenario_type === 'recommendations' ? 'Recommendations' :
                       'Service Practice'}
                    </span>

                    {assignment.scenarios.session_time_limit_minutes && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        ⏱️ {assignment.scenarios.session_time_limit_minutes} min
                      </span>
                    )}

                    {stats && (
                      <>
                        {assignment.scenarios.scenario_type === 'theory' ? (
                          <span className="text-xs text-blue-600 font-medium">
                            Completed: {stats.completionPercentage}%
                          </span>
                        ) : (
                          <span className={`text-xs font-medium ${stats.isCompleted ? 'text-green-600' : 'text-gray-500'}`}>
                            {stats.isCompleted ? '✓ Completed' : 'Not completed'}
                          </span>
                        )}

                        <span className="text-xs text-gray-600">
                          Attempts: {stats.attemptCount}/{assignment.max_attempts || '∞'}
                        </span>

                        {stats.lastAttempt && (
                          <span className="text-xs text-gray-500">
                            Last: {new Date(stats.lastAttempt).toLocaleDateString()}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {assignment.notes && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-3">
                      <p className="text-sm text-blue-700">
                        <strong>Manager's Note:</strong> {assignment.notes}
                      </p>
                    </div>
                  )}

                  <div className="text-xs text-gray-400">
                    Assigned {new Date(assignment.assigned_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="ml-4 flex-shrink-0">
                  {assignment.status !== 'completed' && (
                    <button
                      disabled={isLimitReached}
                      className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                        isLimitReached
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                      onClick={() => {
                        if (!isLimitReached) {
                          const assignmentId = `individual-${assignment.scenario_id}`
                          window.location.href = `/employee/training/${assignmentId}`
                        }
                      }}
                      title={isLimitReached ? 'Attempt limit reached' : 'View session details'}
                    >
                      <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {isLimitReached
                        ? 'Limit Reached'
                        : assignment.status === 'in_progress' ? 'Continue Training' : 'View Session'
                      }
                    </button>
                  )}
                </div>
              </div>

              {/* Mobile Layout */}
              <div className="md:hidden space-y-4">
                <div>
                  <div className="flex items-center flex-wrap gap-2 mb-2">
                    <h4 className="text-lg font-medium text-gray-900">
                      <HiddenContent type="title" customPlaceholder="Mystery Scenario" />
                    </h4>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}>
                      {getStatusText(assignment.status)}
                    </span>
                  </div>

                  <p className="text-gray-600 mb-3 text-sm">
                    <HiddenContent type="description" showIcon={false} />
                  </p>

                  <div className="flex flex-wrap gap-2 text-sm mb-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {assignment.scenarios.tracks.name}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      assignment.scenarios.scenario_type === 'theory'
                        ? 'bg-purple-100 text-purple-800'
                        : assignment.scenarios.scenario_type === 'recommendations'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {assignment.scenarios.scenario_type === 'theory' ? 'Theory (Q&A)' :
                       assignment.scenarios.scenario_type === 'recommendations' ? 'Recommendations' :
                       'Service Practice'}
                    </span>

                    {assignment.scenarios.session_time_limit_minutes && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        ⏱️ {assignment.scenarios.session_time_limit_minutes} min
                      </span>
                    )}

                    {stats && (
                      <>
                        {assignment.scenarios.scenario_type === 'theory' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                            {stats.completionPercentage}% Done
                          </span>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stats.isCompleted ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                            {stats.isCompleted ? '✓ Completed' : 'Not completed'}
                          </span>
                        )}

                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          Attempts: {stats.attemptCount}/{assignment.max_attempts || '∞'}
                        </span>

                        {stats.lastAttempt && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            Last: {new Date(stats.lastAttempt).toLocaleDateString()}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {assignment.notes && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-3">
                      <p className="text-sm text-blue-700">
                        <strong>Manager's Note:</strong> {assignment.notes}
                      </p>
                    </div>
                  )}

                  <div className="text-xs text-gray-400">
                    Assigned {new Date(assignment.assigned_at).toLocaleDateString()}
                  </div>
                </div>

                {assignment.status !== 'completed' && (
                  <button
                    disabled={isLimitReached}
                    className={`w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                      isLimitReached
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                    onClick={() => {
                      if (!isLimitReached) {
                        const assignmentId = `individual-${assignment.scenario_id}`
                        window.location.href = `/employee/training/${assignmentId}`
                      }
                    }}
                    title={isLimitReached ? 'Attempt limit reached' : 'View session details'}
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {isLimitReached
                      ? 'Attempt Limit Reached'
                      : assignment.status === 'in_progress' ? 'Continue Training' : 'View Session'
                    }
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}