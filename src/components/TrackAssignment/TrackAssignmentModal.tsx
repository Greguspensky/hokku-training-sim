'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Employee } from '@/lib/employees'
import { Track, Scenario } from '@/lib/scenarios'

interface TrackAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  employee: Employee
  companyId: string
  onAssignmentCreated: () => void
}

export default function TrackAssignmentModal({
  isOpen,
  onClose,
  employee,
  companyId,
  onAssignmentCreated
}: TrackAssignmentModalProps) {
  const t = useTranslations('assignments')
  const [tracks, setTracks] = useState<Track[]>([])
  const [selectedTrackId, setSelectedTrackId] = useState('')
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingScenarios, setLoadingScenarios] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Load available tracks
  const loadTracks = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/tracks?company_id=${companyId}`)
      const data = await response.json()

      if (data.success) {
        setTracks(data.data?.tracks || [])
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
      setSelectedScenarioIds([])
      return
    }

    setLoadingScenarios(true)
    try {
      const response = await fetch(`/api/scenarios?track_id=${trackId}`)
      const data = await response.json()

      if (data.success) {
        const trackScenarios = data.data?.scenarios || []
        setScenarios(trackScenarios)
        // By default, select all scenarios
        setSelectedScenarioIds(trackScenarios.map(s => s.id))
      } else {
        console.error('Failed to load scenarios:', data.error)
        setScenarios([])
        setSelectedScenarioIds([])
      }
    } catch (error) {
      console.error('Failed to load scenarios:', error)
      setScenarios([])
      setSelectedScenarioIds([])
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
      setSelectedScenarioIds([])
    }
  }, [selectedTrackId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedTrackId) {
      alert('Please select a track to assign')
      return
    }

    if (scenarios.length > 0 && selectedScenarioIds.length === 0) {
      alert('Please select at least one scenario to assign')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/tracks/track-assignments-standalone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employee_id: employee.id,
          track_id: selectedTrackId,
          assigned_by: 'demo-manager-1', // In real app, get from auth
          notes,
          selected_scenario_ids: selectedScenarioIds.length > 0 ? selectedScenarioIds : undefined
        })
      })

      const data = await response.json()

      if (data.success) {
        onAssignmentCreated()
        onClose()
        setSelectedTrackId('')
        setSelectedScenarioIds([])
        setScenarios([])
        setNotes('')
      } else {
        alert(data.error || 'Failed to assign track')
      }
    } catch (error) {
      console.error('Error assigning track:', error)
      alert('Failed to assign track')
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
              {t('assignTrainingTrack')}
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
            {t('assignTrackTo', { name: employee.name })}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Track Selection */}
          <div>
            <label htmlFor="track" className="block text-sm font-medium text-gray-700 mb-2">
              {t('selectTrainingTrack')}
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
                <p className="text-sm text-gray-500">{t('noTracksAvailable')}</p>
              </div>
            ) : (
              <select
                id="track"
                value={selectedTrackId}
                onChange={(e) => setSelectedTrackId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">{t('chooseTrack')}</option>
                {tracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.name} ({track.target_audience === 'new_hire' ? t('newHire') : t('existingEmployee')})
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
                        {selectedTrack.target_audience === 'new_hire' ? t('newHire') : t('existingEmployee')}
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('selectScenariosToAssign')}
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
                  <p className="text-sm text-gray-500">{t('noScenariosAvailable')}</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-md p-2">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b">
                    <span className="text-sm font-medium text-gray-700">
                      {t('ofSelected', { count: selectedScenarioIds.length, total: scenarios.length })}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedScenarioIds(scenarios.map(s => s.id))}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        {t('selectAll')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedScenarioIds([])}
                        className="text-xs text-gray-600 hover:text-gray-700"
                      >
                        {t('clearAll')}
                      </button>
                    </div>
                  </div>
                  {scenarios.map((scenario) => (
                    <label key={scenario.id} className="flex items-start p-2 hover:bg-gray-50 cursor-pointer rounded">
                      <input
                        type="checkbox"
                        checked={selectedScenarioIds.includes(scenario.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedScenarioIds([...selectedScenarioIds, scenario.id])
                          } else {
                            setSelectedScenarioIds(selectedScenarioIds.filter(id => id !== scenario.id))
                          }
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
                      />
                      <div className="ml-3 flex-1">
                        <span className="text-sm font-medium text-gray-900">{scenario.title}</span>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`text-xs px-2 py-1 rounded ${
                            scenario.scenario_type === 'theory'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {scenario.scenario_type === 'theory' ? t('theory') : t('practice')}
                          </span>
                          <span className="text-xs text-gray-500">
                            {scenario.difficulty} • {scenario.estimated_duration_minutes}min
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                          {scenario.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {selectedScenarioIds.length === 0 && scenarios.length > 0 && (
                <p className="text-sm text-red-600 mt-1">{t('pleaseSelectOneScenario')}</p>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              {t('notesOptional')}
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t('addNotesPlaceholder')}
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
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedTrackId || (scenarios.length > 0 && selectedScenarioIds.length === 0)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? t('assigning') : t('assignTrack')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}