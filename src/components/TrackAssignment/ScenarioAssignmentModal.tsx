'use client'

import { useState, useEffect } from 'react'
import { Employee } from '@/lib/employees'
import { Track, Scenario } from '@/lib/scenarios'

interface ScenarioAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  employee: Employee
  companyId: string
  onAssignmentCreated: () => void
}

export default function ScenarioAssignmentModal({
  isOpen,
  onClose,
  employee,
  companyId,
  onAssignmentCreated
}: ScenarioAssignmentModalProps) {
  const [tracks, setTracks] = useState<Track[]>([])
  const [selectedTrackId, setSelectedTrackId] = useState('')
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [selectedScenarioId, setSelectedScenarioId] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingScenarios, setLoadingScenarios] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Helper function to get scenario type display name
  const getScenarioTypeDisplay = (scenarioType: string) => {
    switch (scenarioType) {
      case 'theory':
        return 'Theory Q&A'
      case 'service_practice':
        return 'Service Practice'
      case 'recommendations':
        return 'Recommendations'
      default:
        return scenarioType
    }
  }

  // Helper function to get scenario type color
  const getScenarioTypeColor = (scenarioType: string) => {
    switch (scenarioType) {
      case 'theory':
        return 'bg-blue-200 text-blue-800'
      case 'service_practice':
        return 'bg-green-200 text-green-800'
      case 'recommendations':
        return 'bg-purple-200 text-purple-800'
      default:
        return 'bg-gray-200 text-gray-800'
    }
  }

  // Load available tracks
  const loadTracks = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/tracks?company_id=${companyId}`)
      const data = await response.json()

      if (data.success) {
        setTracks(data.tracks || [])
      }
    } catch (error) {
      console.error('Failed to load tracks:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load scenarios for selected track
  const loadScenarios = async (trackId: string) => {
    if (!trackId) {
      setScenarios([])
      setSelectedScenarioId('')
      return
    }

    setLoadingScenarios(true)
    try {
      const response = await fetch(`/api/scenarios?track_id=${trackId}`)
      const data = await response.json()

      if (data.success) {
        const trackScenarios = data.scenarios || []
        setScenarios(trackScenarios)
        setSelectedScenarioId('')
      } else {
        console.error('Failed to load scenarios:', data.error)
        setScenarios([])
        setSelectedScenarioId('')
      }
    } catch (error) {
      console.error('Failed to load scenarios:', error)
      setScenarios([])
      setSelectedScenarioId('')
    } finally {
      setLoadingScenarios(false)
    }
  }

  useEffect(() => {
    if (isOpen && companyId) {
      loadTracks()
    }
  }, [isOpen, companyId])

  // Load scenarios when track selection changes
  useEffect(() => {
    if (selectedTrackId) {
      loadScenarios(selectedTrackId)
    } else {
      setScenarios([])
      setSelectedScenarioId('')
    }
  }, [selectedTrackId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedTrackId) {
      alert('Please select a track first')
      return
    }

    if (!selectedScenarioId) {
      alert('Please select a scenario to assign')
      return
    }

    console.log('📤 Submitting scenario assignment with employee:', {
      employee_id: employee.id,
      employee_name: employee.name,
      employee_email: employee.email,
      scenario_id: selectedScenarioId
    })

    setSubmitting(true)
    try {
      const response = await fetch('/api/scenario-assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employee_id: employee.id,
          scenario_id: selectedScenarioId,
          assigned_by: 'demo-manager-1', // In real app, get from auth
          notes
        })
      })

      const data = await response.json()

      if (data.success) {
        onAssignmentCreated()
        onClose()
        setSelectedTrackId('')
        setSelectedScenarioId('')
        setScenarios([])
        setNotes('')
      } else {
        alert(data.error || 'Failed to assign scenario')
      }
    } catch (error) {
      console.error('Error assigning scenario:', error)
      alert('Failed to assign scenario')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Assign Training Scenario
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Assign a specific scenario to <strong>{employee.name}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Track Selection */}
          <div>
            <label htmlFor="track" className="block text-sm font-medium text-gray-700 mb-2">
              Select Training Track *
            </label>
            {loading ? (
              <div className="p-3 border border-gray-300 rounded-md">
                <div className="animate-pulse flex space-x-4">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ) : tracks.length === 0 ? (
              <div className="p-3 border border-gray-300 rounded-md bg-gray-50">
                <p className="text-sm text-gray-500">No training tracks available</p>
              </div>
            ) : (
              <select
                id="track"
                value={selectedTrackId}
                onChange={(e) => setSelectedTrackId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Choose a track...</option>
                {tracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.name} ({track.target_audience === 'new_hire' ? 'New Hire' : 'Existing Employee'})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Selected Track Details */}
          {selectedTrackId && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              {(() => {
                const selectedTrack = tracks.find(t => t.id === selectedTrackId)
                return selectedTrack ? (
                  <div>
                    <h4 className="font-medium text-blue-900">{selectedTrack.name}</h4>
                    <p className="text-sm text-blue-700 mt-1">{selectedTrack.description}</p>
                    <div className="mt-2 flex items-center space-x-4 text-xs text-blue-600">
                      <span className="px-2 py-1 bg-blue-200 rounded">
                        {selectedTrack.target_audience === 'new_hire' ? 'New Hire' : 'Existing Employee'}
                      </span>
                    </div>
                  </div>
                ) : null
              })()}
            </div>
          )}

          {/* Scenario Selection */}
          {selectedTrackId && (
            <div>
              <label htmlFor="scenario" className="block text-sm font-medium text-gray-700 mb-2">
                Select Scenario to Assign *
              </label>
              {loadingScenarios ? (
                <div className="p-3 border border-gray-300 rounded-md">
                  <div className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ) : scenarios.length === 0 ? (
                <div className="p-3 border border-gray-300 rounded-md bg-gray-50">
                  <p className="text-sm text-gray-500">No scenarios available for this track</p>
                </div>
              ) : (
                <select
                  id="scenario"
                  value={selectedScenarioId}
                  onChange={(e) => setSelectedScenarioId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Choose a scenario...</option>
                  {scenarios.map((scenario) => (
                    <option key={scenario.id} value={scenario.id}>
                      {scenario.title} [ID: {scenario.id.slice(-8)}] ({getScenarioTypeDisplay(scenario.scenario_type)} • {scenario.estimated_duration_minutes}min)
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Selected Scenario Details */}
          {selectedScenarioId && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              {(() => {
                const selectedScenario = scenarios.find(s => s.id === selectedScenarioId)
                return selectedScenario ? (
                  <div>
                    <h4 className="font-medium text-green-900">{selectedScenario.title}</h4>
                    <p className="text-sm text-green-700 mt-1">{selectedScenario.description}</p>
                    <div className="mt-2 flex items-center space-x-4 text-xs text-green-600">
                      <span className={`px-2 py-1 rounded ${getScenarioTypeColor(selectedScenario.scenario_type)}`}>
                        {getScenarioTypeDisplay(selectedScenario.scenario_type)}
                      </span>
                      <span>{selectedScenario.difficulty}</span>
                      <span>{selectedScenario.estimated_duration_minutes} min</span>
                    </div>
                  </div>
                ) : null
              })()}
            </div>
          )}

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Add any notes about this assignment..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedScenarioId}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? 'Assigning...' : 'Assign Scenario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}