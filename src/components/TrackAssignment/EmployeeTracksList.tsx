'use client'

import { useState, useEffect } from 'react'
import { Employee } from '@/lib/employees'
import { AssignmentWithDetails } from '@/lib/track-assignments'

interface EmployeeTracksListProps {
  employee: Employee
  companyId: string
}

export default function EmployeeTracksList({ employee, companyId }: EmployeeTracksListProps) {
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  const loadEmployeeAssignments = async () => {
    try {
      const response = await fetch(`/api/track-assignments-standalone?employee_id=${employee.id}`)
      const data = await response.json()

      if (data.success) {
        setAssignments(data.assignments || [])
      }
    } catch (error) {
      console.error('Failed to load employee assignments:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEmployeeAssignments()
  }, [employee.id])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'assigned':
        return 'bg-yellow-100 text-yellow-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatStatus = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'In Progress'
      case 'completed':
        return 'Completed'
      case 'assigned':
        return 'Assigned'
      case 'cancelled':
        return 'Cancelled'
      default:
        return status
    }
  }

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to remove this track assignment?')) {
      return
    }

    try {
      const response = await fetch(`/api/track-assignments-standalone/${assignmentId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        setAssignments(prev => prev.filter(a => a.id !== assignmentId))
      } else {
        alert(data.error || 'Failed to remove assignment')
      }
    } catch (error) {
      console.error('Error removing assignment:', error)
      alert('Failed to remove assignment')
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-20 bg-gray-200 rounded-lg"></div>
          </div>
        ))}
      </div>
    )
  }

  if (assignments.length === 0) {
    return (
      <div className="text-center py-6">
        <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <p className="text-sm text-gray-500">No training tracks assigned yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {assignments.map((assignment) => (
        <div key={assignment.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h4 className="font-medium text-gray-900">
                  {assignment.track?.name || 'Unknown Track'}
                </h4>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(assignment.status)}`}>
                  {formatStatus(assignment.status)}
                </span>
              </div>

              <p className="text-sm text-gray-600 mb-3">
                {assignment.track?.description || 'No description available'}
              </p>

              <div className="flex items-center space-x-4 text-xs text-gray-500">
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
                      {assignment.track.target_audience === 'new_hire' ? 'New Hire' : 'Existing Employee'}
                    </span>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">Progress</span>
                  <span className="text-xs text-gray-500">{assignment.progress_percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${assignment.progress_percentage}%` }}
                  ></div>
                </div>
              </div>

              {assignment.notes && (
                <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-600">
                  <strong>Notes:</strong> {assignment.notes}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2 ml-4">
              <button
                onClick={() => handleRemoveAssignment(assignment.id)}
                className="text-red-600 hover:text-red-800 p-1 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                title="Remove assignment"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}