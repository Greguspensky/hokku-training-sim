'use client'

import { useState, useEffect } from 'react'

interface KnowledgeTopic {
  id: string
  name: string
  description: string
  category: string
  difficulty_level: number
}

interface ScenarioAssignment {
  id: string
  scenario_id: string
  employee_id: string
  assigned_by: string
  assigned_at: string
  status: 'assigned' | 'in_progress' | 'completed'
  notes?: string
  scenarios: {
    id: string
    title: string
    description: string
    scenario_type: string
    difficulty: string
    estimated_duration_minutes: number
    track_id: string
    tracks: {
      id: string
      name: string
    }
  }
}

interface IndividualScenariosCardProps {
  employeeId: string
}

export default function IndividualScenariosCard({ employeeId }: IndividualScenariosCardProps) {
  const [scenarioAssignments, setScenarioAssignments] = useState<ScenarioAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [topics, setTopics] = useState<{[key: string]: KnowledgeTopic}>({})

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
        setScenarioAssignments(data.assignments || [])

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
  }, [employeeId])

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
        {scenarioAssignments.map((assignment) => (
          <div key={assignment.id} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h4 className="text-lg font-medium text-gray-900">{assignment.scenarios.title}</h4>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}>
                    {getStatusText(assignment.status)}
                  </span>
                </div>

                <p className="text-gray-600 mb-3">{assignment.scenarios.description}</p>

                <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {assignment.scenarios.tracks.name}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    assignment.scenarios.scenario_type === 'theory'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {assignment.scenarios.scenario_type === 'theory' ? 'Theory (Q&A)' : 'Service Practice'}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {assignment.scenarios.difficulty}
                  </span>
                  <span>{assignment.scenarios.estimated_duration_minutes} min</span>
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
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    onClick={() => {
                      // Navigate to training session using scenario ID, not assignment ID
                      const assignmentId = `individual-${assignment.scenario_id}`
                      window.location.href = `/employee/training/${assignmentId}`
                    }}
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {assignment.status === 'in_progress' ? 'Continue Training' : 'Start Training'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}