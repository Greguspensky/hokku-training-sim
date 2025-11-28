'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Employee } from '@/lib/employees'

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

interface EmployeeScenariosListProps {
  employee: Employee
}

export default function EmployeeScenariosList({ employee }: EmployeeScenariosListProps) {
  const t = useTranslations('employees')
  const [scenarios, setScenarios] = useState<ScenarioAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [savingAttempts, setSavingAttempts] = useState<Set<string>>(new Set())

  const loadScenarios = async () => {
    if (!employee.id) {
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`/api/scenarios/scenario-assignments?employee_id=${employee.id}`)
      const data = await response.json()

      if (data.success) {
        setScenarios(data.assignments || [])
      } else {
        console.error('Failed to load scenario assignments:', data.error)
      }
    } catch (error) {
      console.error('Error loading scenario assignments:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadScenarios()
  }, [employee.id])

  const handleRemoveScenario = async (assignmentId: string, scenarioTitle: string) => {
    if (!confirm(t('confirmRemoveScenario', { scenarioTitle }))) {
      return
    }

    setRemovingIds(prev => new Set([...prev, assignmentId]))

    try {
      const response = await fetch(`/api/scenarios/scenario-assignments?assignment_id=${assignmentId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        // Remove from local state immediately
        setScenarios(prev => prev.filter(scenario => scenario.id !== assignmentId))
      } else {
        console.error('Failed to remove scenario assignment:', data.error)
        alert('Failed to remove scenario assignment. Please try again.')
      }
    } catch (error) {
      console.error('Error removing scenario assignment:', error)
      alert('Failed to remove scenario assignment. Please try again.')
    } finally {
      setRemovingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(assignmentId)
        return newSet
      })
    }
  }

  const handleUpdateAttemptsLimit = async (assignmentId: string, maxAttempts: number | null) => {
    setSavingAttempts(prev => new Set([...prev, assignmentId]))

    try {
      const response = await fetch('/api/scenarios/scenario-assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignmentId,
          max_attempts: maxAttempts
        })
      })

      const data = await response.json()

      if (!data.success) {
        console.error('Failed to update attempts limit:', data.error)
        alert('Failed to update attempts limit. Please try again.')
      } else {
        console.log('✅ Successfully updated attempts limit')
        // Update local state to reflect the change
        setScenarios(prev => prev.map(scenario =>
          scenario.id === assignmentId
            ? { ...scenario, max_attempts: maxAttempts }
            : scenario
        ))
      }
    } catch (error) {
      console.error('Error updating attempts limit:', error)
      alert('Failed to update attempts limit. Please try again.')
    } finally {
      setSavingAttempts(prev => {
        const newSet = new Set(prev)
        newSet.delete(assignmentId)
        return newSet
      })
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    )
  }

  if (scenarios.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-gray-500">
        <svg className="mx-auto h-6 w-6 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-1l-4 4z" />
        </svg>
        {t('noIndividualScenarios')}
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
      case 'completed': return t('completed')
      case 'in_progress': return t('inProgress')
      default: return t('readyToStart')
    }
  }

  const getScenarioTypeColor = (type: string) => {
    switch (type) {
      case 'theory': return 'bg-purple-100 text-purple-800'
      case 'service_practice': return 'bg-green-100 text-green-800'
      case 'recommendations': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getScenarioTypeText = (type: string) => {
    switch (type) {
      case 'theory': return t('theoryQA')
      case 'service_practice': return t('servicePractice')
      case 'recommendations': return t('recommendations')
      default: return type
    }
  }

  return (
    <div className="space-y-3">
      {scenarios.map((assignment) => (
        <div key={assignment.id} className="bg-gray-50 rounded-lg p-4 border">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h6 className="font-medium text-gray-900 text-sm">{assignment.scenarios.title}</h6>
              <p className="text-xs text-gray-400 font-mono">ID: {assignment.scenarios.id}</p>
              <p className="text-xs text-gray-600 mt-1">{assignment.scenarios.description}</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}>
                {getStatusText(assignment.status)}
              </span>
              <button
                onClick={() => handleRemoveScenario(assignment.id, assignment.scenarios.title)}
                disabled={removingIds.has(assignment.id)}
                className="inline-flex items-center p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={t('removeScenarioFromEmployee')}
              >
                {removingIds.has(assignment.id) ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center space-x-2 text-xs">
              <span className="inline-flex items-center px-2 py-1 rounded-full font-medium bg-blue-100 text-blue-800">
                {assignment.scenarios.tracks.name}
              </span>
              <span className={`inline-flex items-center px-2 py-1 rounded-full font-medium ${getScenarioTypeColor(assignment.scenarios.scenario_type)}`}>
                {getScenarioTypeText(assignment.scenarios.scenario_type)}
              </span>
              {assignment.scenarios.session_time_limit_minutes && (
                <span className="inline-flex items-center px-2 py-1 rounded-full font-medium bg-gray-100 text-gray-700">
                  ⏱️ {assignment.scenarios.session_time_limit_minutes} min
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-xs text-gray-600" title={t('leaveEmptyForUnlimited')}>
                {t('attemptsLimit')}
              </label>
              <div className="relative flex items-center">
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={assignment.max_attempts || ''}
                  onChange={(e) => {
                    // Update local state immediately for responsive UI
                    const value = e.target.value ? parseInt(e.target.value) : null
                    setScenarios(prev => prev.map(s =>
                      s.id === assignment.id ? { ...s, max_attempts: value } : s
                    ))
                  }}
                  onBlur={(e) => {
                    const value = e.target.value ? parseInt(e.target.value) : null
                    handleUpdateAttemptsLimit(assignment.id, value)
                  }}
                  disabled={savingAttempts.has(assignment.id)}
                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="∞"
                  title={t('leaveEmptyForUnlimited')}
                />
                {assignment.max_attempts && !savingAttempts.has(assignment.id) && (
                  <button
                    onClick={() => handleUpdateAttemptsLimit(assignment.id, null)}
                    className="ml-1 text-gray-400 hover:text-gray-600 transition-colors"
                    title={t('clearLimit')}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                {savingAttempts.has(assignment.id) && (
                  <svg className="animate-spin h-4 w-4 text-gray-400 ml-1" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
              </div>
            </div>
          </div>

          {assignment.notes && (
            <div className="mt-2 bg-blue-50 border border-blue-200 rounded p-2">
              <p className="text-xs text-blue-700">
                <strong>{t('managersNote')}</strong> {assignment.notes}
              </p>
            </div>
          )}

          <div className="mt-2 text-xs text-gray-400">
            {t('assigned', { date: new Date(assignment.assigned_at).toLocaleDateString() })}
          </div>
        </div>
      ))}
    </div>
  )
}