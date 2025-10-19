'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AssignmentWithDetails } from '@/lib/track-assignments'
import { Scenario } from '@/lib/scenarios'
import { useAuth } from '@/contexts/AuthContext'

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

interface TrainingTrackCardProps {
  assignment: AssignmentWithDetails
  managerView?: boolean
  employeeUserId?: string
}

export default function TrainingTrackCard({ assignment, managerView = false, employeeUserId }: TrainingTrackCardProps) {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [scenariosLoading, setScenariosLoading] = useState(true)
  const [topics, setTopics] = useState<{[key: string]: KnowledgeTopic}>({})
  const [scenarioStats, setScenarioStats] = useState<{[key: string]: ScenarioStats}>({})
  const router = useRouter()
  const { user } = useAuth()

  // Use provided employeeUserId in manager view, otherwise use auth user
  const userId = employeeUserId || user?.id

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'assigned':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatStatus = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'In Progress'
      case 'completed':
        return 'Completed'
      case 'assigned':
        return 'Ready to Start'
      default:
        return status
    }
  }

  // Function to fetch topic details
  const loadTopics = async (topicIds: string[]) => {
    if (topicIds.length === 0) return

    try {
      // Use a demo company ID for now
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

  // Fetch scenarios for this track
  useEffect(() => {
    const loadScenarios = async () => {
      if (!assignment.track_id) return

      try {
        setScenariosLoading(true)
        const response = await fetch(`/api/scenarios?track_id=${assignment.track_id}`)
        const data = await response.json()

        if (data.success) {
          setScenarios(data.scenarios || [])

          // Load stats for each scenario
          if (userId && data.scenarios) {
            loadScenarioStats(data.scenarios)
          }
        }
      } catch (error) {
        console.error('Failed to load scenarios for track:', error)
      } finally {
        setScenariosLoading(false)
      }
    }

    loadScenarios()
  }, [assignment.track_id, userId])

  // Load statistics for all scenarios
  const loadScenarioStats = async (scenariosList: Scenario[]) => {
    if (!userId) return

    const statsPromises = scenariosList.map(async (scenario) => {
      try {
        const response = await fetch(`/api/scenario-stats?scenario_id=${scenario.id}&user_id=${userId}`)
        const data = await response.json()

        if (data.success) {
          return { scenarioId: scenario.id, stats: data.stats }
        }
      } catch (error) {
        console.error(`Failed to load stats for scenario ${scenario.id}:`, error)
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

    setScenarioStats(statsMap)
  }

  const handleStartTraining = () => {
    // Navigate to the training session
    router.push(`/employee/training/${assignment.id}`)
  }

  const handleStartScenario = (scenario: Scenario) => {
    // For now, navigate to the generic training page
    // In the future, this could be scenario-specific
    router.push(`/employee/training/${assignment.id}?scenario=${scenario.id}`)
  }

  const getScenarioStatusIcon = (scenarioStatus: string) => {
    switch (scenarioStatus) {
      case 'completed':
        return '✅'
      case 'in_progress':
        return '🔄'
      case 'not_started':
        return '⏳'
      case 'skipped':
        return '⏭️'
      default:
        return '⏳'
    }
  }

  const getScenarioTypeLabel = (scenarioType: string) => {
    switch (scenarioType) {
      case 'theory':
        return 'Theory Q&A'
      case 'service_practice':
        return 'Service Practice'
      default:
        return scenarioType
    }
  }

  const getScenarioTypeIcon = (scenarioType: string) => {
    switch (scenarioType) {
      case 'theory':
        return '📚'
      case 'service_practice':
        return '🎭'
      default:
        return '📋'
    }
  }

  // Calculate actual progress based on scenario completion
  const calculateRealProgress = (): number => {
    if (scenarios.length === 0) return 0

    let completedCount = 0
    scenarios.forEach(scenario => {
      const stats = scenarioStats[scenario.id]
      if (stats) {
        // For theory scenarios, consider completed if 100% completion
        // For other scenarios, check isCompleted flag
        if (scenario.scenario_type === 'theory') {
          if (stats.completionPercentage === 100) {
            completedCount++
          }
        } else {
          if (stats.isCompleted) {
            completedCount++
          }
        }
      }
    })

    return Math.round((completedCount / scenarios.length) * 100)
  }

  // Use real progress if scenarios are loaded, otherwise fall back to assignment progress
  const displayProgress = scenarios.length > 0 ? calculateRealProgress() : assignment.progress_percentage

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {assignment.track?.name || 'Unknown Track'}
              </h3>
              <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(assignment.status)}`}>
                {formatStatus(assignment.status)}
              </span>
            </div>

            <p className="text-gray-600 mb-3">
              {assignment.track?.description || 'No description available'}
            </p>

            <div className="flex items-center space-x-4 text-sm text-gray-500 mb-4">
              <div className="flex items-center space-x-1">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Assigned: {new Date(assignment.assigned_at).toLocaleDateString()}</span>
              </div>

              {assignment.track?.target_audience && (
                <div className="flex items-center space-x-1">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>
                    {assignment.track.target_audience === 'new_hire' ? 'New Hire Training' : 'Continuing Education'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm text-gray-500">{displayProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${
                displayProgress === 100
                  ? 'bg-green-500'
                  : displayProgress > 0
                  ? 'bg-blue-500'
                  : 'bg-gray-300'
              }`}
              style={{ width: `${displayProgress}%` }}
            />
          </div>
        </div>

        {/* Available Scenarios */}
        <div className="mt-6">
          <h4 className="text-md font-medium text-gray-900 mb-3">Available Training Scenarios</h4>

          {scenariosLoading ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 bg-gray-200 rounded"></div>
                    <div>
                      <div className="h-4 bg-gray-200 rounded w-32 mb-1"></div>
                      <div className="h-3 bg-gray-200 rounded w-20"></div>
                    </div>
                  </div>
                  <div className="h-8 w-20 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : scenarios.length > 0 ? (
            <div className="space-y-2">
              {scenarios.map((scenario) => {
                const stats = scenarioStats[scenario.id]
                return (
                  <div key={scenario.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{getScenarioTypeIcon(scenario.scenario_type)}</span>
                      <div>
                        <h5 className="font-medium text-gray-900 text-sm">
                          {scenario.title}
                        </h5>
                        <p className="text-xs text-gray-400 font-mono">ID: {scenario.id}</p>
                        <div className="flex items-center space-x-3 mt-1">
                          <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">
                            {getScenarioTypeLabel(scenario.scenario_type)}
                          </span>

                          {/* Progress/Completion Status */}
                          {stats && (
                            <>
                              {scenario.scenario_type === 'theory' ? (
                                <span className="text-xs text-blue-600 font-medium">
                                  Completed: {stats.completionPercentage}%
                                </span>
                              ) : (
                                <span className={`text-xs font-medium ${stats.isCompleted ? 'text-green-600' : 'text-gray-500'}`}>
                                  {stats.isCompleted ? '✓ Completed' : 'Not completed'}
                                </span>
                              )}

                              {/* Attempts with limit */}
                              <span className="text-xs text-gray-600">
                                Attempts: {stats.attemptCount}/{
                                  (assignment as any).scenario_attempts_limits?.[scenario.id]
                                    ? (assignment as any).scenario_attempts_limits[scenario.id]
                                    : '∞'
                                }
                              </span>

                              {/* Last Attempt */}
                              {stats.lastAttempt && (
                                <span className="text-xs text-gray-500">
                                  Last: {new Date(stats.lastAttempt).toLocaleDateString()}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {!managerView && (() => {
                      const maxAttempts = (assignment as any).scenario_attempts_limits?.[scenario.id]
                      const currentAttempts = stats?.attemptCount || 0
                      const isLimitReached = maxAttempts && currentAttempts >= maxAttempts

                      return (
                        <button
                          onClick={() => handleStartScenario(scenario)}
                          disabled={isLimitReached}
                          className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                            isLimitReached
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                          title={isLimitReached ? 'Attempt limit reached' : 'Start training session'}
                        >
                          <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {isLimitReached ? 'Limit Reached' : 'Start'}
                        </button>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-md border border-gray-200">
              <svg className="mx-auto h-6 w-6 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm">No scenarios available yet</p>
            </div>
          )}
        </div>

        {/* Action Buttons - Only show fallback buttons if no scenarios are available */}
        {!scenariosLoading && scenarios.length === 0 && (
          <div className="flex items-center mt-6">
            {assignment.status === 'assigned' && (
              <button
                onClick={handleStartTraining}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start Training
              </button>
            )}

            {assignment.status === 'in_progress' && (
              <button
                onClick={handleStartTraining}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Continue Training
              </button>
            )}

            {assignment.status === 'completed' && (
              <div className="flex items-center text-green-600">
                <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">Completed</span>
                {assignment.completed_at && (
                  <span className="text-sm text-gray-500 ml-2">
                    on {new Date(assignment.completed_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Assignment Notes */}
        {assignment.notes && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-start space-x-2">
              <svg className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-900">Manager Notes:</p>
                <p className="text-sm text-blue-800 mt-1">{assignment.notes}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}