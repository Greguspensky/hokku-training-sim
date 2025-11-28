'use client'

import { useState, useEffect } from 'react'
import { Scenario, scenarioService } from '@/lib/scenarios'

interface AddScenariosDialogProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (scenarioIds: string[]) => void
  trackId: string
  companyId: string
}

// TopicTag component to display topic information
interface TopicTagProps {
  topicId: string
}

function TopicTag({ topicId }: TopicTagProps) {
  const [topicData, setTopicData] = useState<{
    name: string
    questionCount: number
    category?: string
    difficulty_level?: number
  } | null>(null)

  useEffect(() => {
    async function fetchTopicData() {
      try {
        const response = await fetch(`/api/topics/${topicId}`)
        if (response.ok) {
          const data = await response.json()
          setTopicData({
            name: data.name || `Topic ${topicId}`,
            questionCount: data.questions?.length || 0,
            category: data.category,
            difficulty_level: data.difficulty_level
          })
        }
      } catch (error) {
        console.error('Error fetching topic data:', error)
        setTopicData({
          name: `Topic ${topicId}`,
          questionCount: 0
        })
      }
    }

    fetchTopicData()
  }, [topicId])

  if (!topicData) {
    return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 animate-pulse">Loading...</span>
  }

  const getCategoryColor = (category?: string) => {
    switch (category?.toLowerCase()) {
      case 'menu':
        return 'bg-blue-100 text-blue-800'
      case 'procedures':
        return 'bg-green-100 text-green-800'
      case 'policies':
        return 'bg-purple-100 text-purple-800'
      case 'general':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(topicData.category)}`}>
      {topicData.name}
      {topicData.questionCount > 0 && (
        <span className="ml-1 text-xs">({topicData.questionCount})</span>
      )}
    </span>
  )
}

export default function AddScenariosDialog({
  isOpen,
  onClose,
  onAdd,
  trackId,
  companyId
}: AddScenariosDialogProps) {
  const [availableScenarios, setAvailableScenarios] = useState<Scenario[]>([])
  const [assignedScenarios, setAssignedScenarios] = useState<string[]>([])
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadAvailableScenarios()
    }
  }, [isOpen, companyId, trackId])

  const loadAvailableScenarios = async () => {
    setLoading(true)

    try {
      console.log('🔍 Loading real scenarios from main scenarios list')
      console.log('🏢 Company ID:', companyId)
      console.log('🎯 Track ID:', trackId)

      // Try to get scenarios from the parent component or global state
      // We'll make an API call to get all scenarios, which should include the real ones
      const apiUrl = `/api/scenarios?company_id=${companyId}`
      console.log('🌐 API URL:', apiUrl)
      const response = await fetch(apiUrl)

      if (response.ok) {
        const data = await response.json()
        console.log('🔍 API Response data:', data)

        if (data.success && data.scenarios) {
          console.log(`📋 Found ${data.scenarios.length} scenarios from API`)
          console.log('📋 First few scenarios:', data.scenarios.slice(0, 3).map(s => ({ id: s.id, title: s.title })))

          // Try to get currently assigned scenarios to this track, but don't fail if it errors
          let assignedIds: string[] = []
          try {
            const currentlyAssigned = await scenarioService.getScenariosByTrack(trackId)
            assignedIds = currentlyAssigned.map(s => s.id)
            console.log(`📌 Found ${assignedIds.length} currently assigned scenarios`)
          } catch (assignmentError) {
            console.log('⚠️ Could not get assigned scenarios, assuming none assigned:', assignmentError)
            assignedIds = [] // Assume no scenarios are assigned if we can't check
          }

          console.log('✅ Setting available scenarios:', data.scenarios.length)
          console.log('✅ Setting assigned scenarios:', assignedIds)
          setAvailableScenarios(data.scenarios)
          setAssignedScenarios(assignedIds)
          setLoading(false)
          return
        } else {
          console.log('❌ API response missing scenarios:', data)
        }
      } else {
        console.log('❌ API response not ok:', response.status, response.statusText)
      }

      throw new Error('API call failed, falling back to scenario service')

    } catch (error) {
      console.log('⚠️ API failed, trying scenario service directly')

      try {
        // Try the scenario service method
        const allScenarios = await scenarioService.getScenarios(companyId)

        // Try to get assigned scenarios, but don't fail if it errors
        let assignedIds: string[] = []
        try {
          const currentlyAssigned = await scenarioService.getScenariosByTrack(trackId)
          assignedIds = currentlyAssigned.map(s => s.id)
        } catch (assignmentError) {
          console.log('⚠️ Could not get assigned scenarios, assuming none assigned:', assignmentError)
          assignedIds = [] // Assume no scenarios are assigned if we can't check
        }

        console.log(`📋 Loaded ${allScenarios.length} scenarios from scenario service`)
        setAvailableScenarios(allScenarios)
        setAssignedScenarios(assignedIds)

      } catch (serviceError) {
        console.error('❌ Both API and service failed:', serviceError)

        // Last resort: empty list with message
        setAvailableScenarios([])
        setAssignedScenarios([])
      }
    }

    setLoading(false)
  }

  const handleScenarioToggle = (scenarioId: string) => {
    setSelectedScenarios(prev =>
      prev.includes(scenarioId)
        ? prev.filter(id => id !== scenarioId)
        : [...prev, scenarioId]
    )
  }

  const handleSubmit = () => {
    onAdd(selectedScenarios)
    setSelectedScenarios([])
  }

  const handleCancel = () => {
    setSelectedScenarios([])
    onClose()
  }

  if (!isOpen) return null

  const unassignedScenarios = availableScenarios.filter(
    scenario => !assignedScenarios.includes(scenario.id)
  )

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Add Scenarios to Track
          </h3>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading scenarios...</p>
            </div>
          ) : unassignedScenarios.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">All available scenarios are already assigned to this track.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Select scenarios to add to this track. Only unassigned scenarios are shown.
              </p>

              <div className="max-h-96 overflow-y-auto space-y-3">
                {unassignedScenarios.map(scenario => (
                  <label
                    key={scenario.id}
                    className="flex items-start p-4 border-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedScenarios.includes(scenario.id)}
                      onChange={() => handleScenarioToggle(scenario.id)}
                      className="mt-1 mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-900">{scenario.title}</h4>
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-medium ${
                            scenario.scenario_type === 'theory'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {scenario.scenario_type === 'theory' ? 'Theory (Q&A)' : 'Service Practice'}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{scenario.description}</p>

                      {scenario.scenario_type === 'theory' && scenario.topic_ids && scenario.topic_ids.length > 0 && (
                        <div className="mt-2">
                          <span className="text-xs font-medium text-gray-700">Topics:</span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {scenario.topic_ids.map(topicId => (
                              <TopicTag key={topicId} topicId={topicId} />
                            ))}
                          </div>
                        </div>
                      )}

                      {scenario.scenario_type === 'service_practice' && (
                        <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-800">
                            {scenario.template_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
                            {scenario.difficulty}
                          </span>
                          <span>{scenario.estimated_duration_minutes} min</span>
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}

          <div className="mt-6 flex justify-between">
            <div className="text-sm text-gray-500">
              {selectedScenarios.length > 0 && (
                <span>{selectedScenarios.length} scenario(s) selected</span>
              )}
            </div>
            <div className="space-x-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={selectedScenarios.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Add Selected ({selectedScenarios.length})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}