'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import TrackList from '@/components/TrackList'
import TrackForm from '@/components/TrackForm'
import ScenarioForm from '@/components/ScenarioForm'
import EditScenarioForm from '@/components/EditScenarioForm'
import UserHeader from '@/components/UserHeader'
import { useAuth } from '@/contexts/AuthContext'
import { Track, Scenario } from '@/lib/scenarios'
import { employeeService } from '@/lib/employees'

export default function ManagerDashboard() {
  const router = useRouter()
  const { user } = useAuth()
  const [tracks, setTracks] = useState<Track[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null)
  const [showTrackForm, setShowTrackForm] = useState(false)
  const [showScenarioForm, setShowScenarioForm] = useState(false)
  const [showEditScenarioForm, setShowEditScenarioForm] = useState(false)
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null)
  const [loading, setLoading] = useState(true)
  const [roleChecking, setRoleChecking] = useState(true)
  const [isEmployee, setIsEmployee] = useState(false)

  // Get company ID from authenticated user
  const companyId = user?.company_id || '01f773e2-1027-490e-8d36-279136700bbf'

  const loadTracks = async () => {
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

  const loadScenarios = async (trackId: string) => {
    try {
      const response = await fetch(`/api/scenarios?track_id=${trackId}`)
      const data = await response.json()
      if (data.success) {
        setScenarios(data.scenarios || [])
      }
    } catch (error) {
      console.error('Failed to load scenarios:', error)
      setScenarios([])
    }
  }

  // Check user role on mount
  useEffect(() => {
    const checkUserRole = () => {
      if (user?.email) {
        // Simple role detection based on email pattern
        const isEmp = user.email.includes('emp')
        setIsEmployee(isEmp)
        if (isEmp) {
          console.log('Manager page: Employee detected by email, redirecting to /employee')
          router.push('/employee')
          return
        }
      }
      setRoleChecking(false)
    }

    if (user) {
      checkUserRole()
    } else if (!user) {
      setRoleChecking(false)
    }
  }, [user, router])

  useEffect(() => {
    if (!roleChecking && !isEmployee) {
      loadTracks()
    }
  }, [roleChecking, isEmployee])

  useEffect(() => {
    if (selectedTrack) {
      loadScenarios(selectedTrack.id)
    } else {
      setScenarios([])
    }
  }, [selectedTrack])

  const handleTrackCreated = () => {
    setShowTrackForm(false)
    loadTracks()
  }

  const handleScenarioCreated = () => {
    setShowScenarioForm(false)
    if (selectedTrack) {
      loadScenarios(selectedTrack.id)
    }
  }

  const handleEditScenario = (scenario: Scenario) => {
    setEditingScenario(scenario)
    setShowEditScenarioForm(true)
  }

  const handleScenarioUpdated = () => {
    setShowEditScenarioForm(false)
    setEditingScenario(null)
    if (selectedTrack) {
      loadScenarios(selectedTrack.id)
    }
  }

  const handleSelectTrack = (track: Track) => {
    setSelectedTrack(track)
  }

  const handleBackToTracks = () => {
    setSelectedTrack(null)
    setScenarios([])
  }

  if (loading || roleChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // If employee was detected, don't render anything (redirect in progress)
  if (isEmployee) {
    return null
  }

  // Check if user is authenticated and authorized
  if (!user) {
    if (typeof window !== 'undefined') {
      window.location.href = '/signin'
    }
    return null
  }

  // Temporarily allow all authenticated users to access manager dashboard
  // TODO: Add proper role checking once user profiles are set up
  if (false) { // user.role !== 'manager'
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">This page is only accessible to managers.</p>
          <a
            href="/employee"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Go to Employee Dashboard
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* User Header */}
        <UserHeader
          title="Training Manager"
          subtitle={selectedTrack ? `Managing scenarios for: ${selectedTrack.name}` : 'Manage your training tracks and scenarios'}
        />

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 mb-8">
          {selectedTrack && (
            <>
              <button
                onClick={() => setShowScenarioForm(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Add Scenario
              </button>
              <button
                onClick={handleBackToTracks}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Back to Tracks
              </button>
            </>
          )}
          {!selectedTrack && (
            <button
              onClick={() => setShowTrackForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Create Track
            </button>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => {}}
                className="border-blue-500 text-blue-600 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
              >
                Training
              </button>
              <button
                onClick={() => router.push('/manager/knowledge-base')}
                className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
              >
                Knowledge Base
              </button>
              <button
                onClick={() => router.push('/manager/employees')}
                className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
              >
                Employees
              </button>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        {!selectedTrack ? (
          /* Track Management View */
          <div>
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Training Tracks</h2>
              <p className="text-gray-600 mb-4">
                Create and manage training tracks for your team. Each track contains multiple scenarios.
              </p>
            </div>
            <TrackList
              tracks={tracks}
              onSelectTrack={handleSelectTrack}
            />
          </div>
        ) : (
          /* Scenario Management View */
          <div>
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">{selectedTrack.name}</h2>
                  <p className="text-gray-600 mb-4">{selectedTrack.description}</p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {selectedTrack.target_audience.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                    <span>{scenarios.length} scenarios</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Scenarios List */}
            <div className="space-y-4">
              {scenarios.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-1l-4 4z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No scenarios yet</h3>
                  <p className="mt-1 text-sm text-gray-500">Get started by creating your first scenario.</p>
                  <button
                    onClick={() => setShowScenarioForm(true)}
                    className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                  >
                    Create Scenario
                  </button>
                </div>
              ) : (
                scenarios.map((scenario) => (
                  <div key={scenario.id} className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900">{scenario.title}</h3>
                        <p className="text-gray-600 mt-1">{scenario.description}</p>
                        <div className="mt-3 flex items-center space-x-4 text-sm text-gray-500">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {scenario.scenario_type === 'theory' ? 'Theory (Q&A)' : 'Service Practice'}
                          </span>
                          {scenario.scenario_type === 'service_practice' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {scenario.template_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                          )}
                          {scenario.scenario_type === 'service_practice' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              {scenario.difficulty}
                            </span>
                          )}
                          <span>{scenario.estimated_duration_minutes} min</span>
                        </div>
                        
                        {scenario.scenario_type === 'service_practice' && (
                          <div className="mt-4 space-y-2">
                            <div>
                              <span className="text-sm font-medium text-gray-700">Client Behavior:</span>
                              <p className="text-sm text-gray-600 mt-1">{scenario.client_behavior}</p>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-700">Expected Response:</span>
                              <p className="text-sm text-gray-600 mt-1">{scenario.expected_response}</p>
                            </div>
                            {scenario.milestones && scenario.milestones.length > 0 && (
                              <div>
                                <span className="text-sm font-medium text-gray-700">Milestones:</span>
                                <div className="mt-1 space-y-1">
                                  {scenario.milestones.map((milestone, index) => (
                                    <div key={index} className="flex items-center text-sm text-gray-600">
                                      <span className="w-2 h-2 bg-green-400 rounded-full mr-2 flex-shrink-0"></span>
                                      <span>{milestone}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {scenario.scenario_type === 'theory' && (
                          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                            <p className="text-sm text-blue-700">
                              <strong>Theory scenario:</strong> Knowledge-based Q&A session focusing on theoretical understanding.
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        <button
                          onClick={() => handleEditScenario(scenario)}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Track Form Modal */}
        {showTrackForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900">Create New Track</h3>
              </div>
              <TrackForm
                companyId={companyId}
                onSuccess={handleTrackCreated}
                onCancel={() => setShowTrackForm(false)}
              />
            </div>
          </div>
        )}

        {/* Scenario Form Modal */}
        {showScenarioForm && selectedTrack && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900">Create New Scenario</h3>
                <p className="text-sm text-gray-600">Adding to: {selectedTrack.name}</p>
              </div>
              <ScenarioForm
                companyId={companyId}
                tracks={[selectedTrack]}
                onSuccess={handleScenarioCreated}
                onCancel={() => setShowScenarioForm(false)}
              />
            </div>
          </div>
        )}

        {/* Edit Scenario Form Modal */}
        {showEditScenarioForm && editingScenario && selectedTrack && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900">Edit Scenario</h3>
                <p className="text-sm text-gray-600">Editing: {editingScenario.title}</p>
              </div>
              <EditScenarioForm
                scenario={editingScenario}
                companyId={companyId}
                tracks={tracks}
                onSuccess={handleScenarioUpdated}
                onCancel={() => {
                  setShowEditScenarioForm(false)
                  setEditingScenario(null)
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}