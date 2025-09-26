'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AssignmentWithDetails } from '@/lib/track-assignments'
import { Scenario } from '@/lib/scenarios'

interface TrainingTrackCardProps {
  assignment: AssignmentWithDetails
}

export default function TrainingTrackCard({ assignment }: TrainingTrackCardProps) {
  const [expanded, setExpanded] = useState(false)
  const router = useRouter()

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

  const handleStartTraining = () => {
    // Navigate to the training session
    router.push(`/employee/training/${assignment.id}`)
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
            <span className="text-sm text-gray-500">{assignment.progress_percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${
                assignment.progress_percentage === 100
                  ? 'bg-green-500'
                  : assignment.progress_percentage > 0
                  ? 'bg-blue-500'
                  : 'bg-gray-300'
              }`}
              style={{ width: `${assignment.progress_percentage}%` }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
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

          {/* View Details Button */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className={`h-4 w-4 mr-2 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {expanded ? 'Hide Details' : 'View Details'}
          </button>
        </div>

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

      {/* Expanded Scenario Details */}
      {expanded && (
        <div className="border-t border-gray-200 bg-gray-50 p-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">Training Scenarios</h4>

          {assignment.scenario_progress && assignment.scenario_progress.length > 0 ? (
            <div className="space-y-3">
              {assignment.scenario_progress.map((progress) => (
                <div key={progress.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-md">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{getScenarioStatusIcon(progress.status)}</span>
                    <div>
                      <h5 className="font-medium text-gray-900">
                        {progress.scenario?.title || 'Unknown Scenario'}
                      </h5>
                      <p className="text-sm text-gray-500">
                        {progress.scenario?.description || 'No description'}
                      </p>
                      {progress.scenario?.estimated_duration_minutes && (
                        <p className="text-xs text-gray-400">
                          Est. {progress.scenario.estimated_duration_minutes} minutes
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {progress.score && (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                        {progress.score}%
                      </span>
                    )}

                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      progress.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : progress.status === 'in_progress'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {progress.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm">No scenarios available yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}