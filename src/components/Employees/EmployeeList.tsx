'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Employee } from '@/lib/employees'
import TrackAssignmentModal from '@/components/TrackAssignment/TrackAssignmentModal'
import ScenarioAssignmentModal from '@/components/TrackAssignment/ScenarioAssignmentModal'
import EmployeeTracksList from '@/components/TrackAssignment/EmployeeTracksList'
import EmployeeScenariosList from './EmployeeScenariosList'

interface EmployeeListProps {
  employees: Employee[]
  onEmployeeDeleted: () => void
  searchQuery: string
  companyId: string
}

export default function EmployeeList({ employees, onEmployeeDeleted, searchQuery, companyId }: EmployeeListProps) {
  const t = useTranslations('employees')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
  const [scenarioAssignmentModalOpen, setScenarioAssignmentModalOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [selectedEmployeeForScenario, setSelectedEmployeeForScenario] = useState<Employee | null>(null)
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleDeleteEmployee = async (employee: Employee) => {
    if (!confirm(t('confirmRemoveEmployee', { name: employee.name }))) {
      return
    }

    setDeletingId(employee.id)
    
    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        onEmployeeDeleted()
      } else {
        console.error('Failed to delete employee')
      }
    } catch (error) {
      console.error('Failed to delete employee:', error)
    } finally {
      setDeletingId(null)
    }
  }

  const handleRegenerateToken = async (employee: Employee) => {
    setRegeneratingId(employee.id)
    
    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_token' })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Copy new invite link to clipboard
        if (data.invite_link) {
          await navigator.clipboard.writeText(data.invite_link)
          // You could show a toast notification here
        }
        onEmployeeDeleted() // Refresh the list
      }
    } catch (error) {
      console.error('Failed to regenerate token:', error)
    } finally {
      setRegeneratingId(null)
    }
  }

  const copyInviteLink = async (employee: Employee) => {
    const inviteLink = `${window.location.origin}/join/${employee.invite_token}`
    try {
      await navigator.clipboard.writeText(inviteLink)
      // You could show a toast notification here
    } catch (error) {
      console.error('Failed to copy invite link:', error)
    }
  }

  const handleAssignTrack = (employee: Employee) => {
    setSelectedEmployee(employee)
    setAssignmentModalOpen(true)
  }

  const handleAssignScenario = (employee: Employee) => {
    setSelectedEmployeeForScenario(employee)
    setScenarioAssignmentModalOpen(true)
  }

  const handleAssignmentCreated = () => {
    // Trigger refresh of assignment lists by incrementing refresh key
    setRefreshKey(prev => prev + 1)
  }

  const handleScenarioAssignmentCreated = () => {
    // Trigger refresh of assignment lists by incrementing refresh key
    setRefreshKey(prev => prev + 1)
  }

  const toggleEmployeeExpansion = (employeeId: string) => {
    setExpandedEmployeeId(expandedEmployeeId === employeeId ? null : employeeId)
  }

  if (employees.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        {searchQuery ? (
          <>
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('noEmployeesFound')}</h3>
            <p className="text-gray-500">{t('noEmployeesMatchSearch', { searchQuery })}</p>
          </>
        ) : (
          <>
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('noEmployeesYet')}</h3>
            <p className="text-gray-500">{t('getStartedInviting')}</p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">
          {t('teamMembers', { count: employees.length })}
        </h3>
      </div>
      
      <div className="divide-y divide-gray-200">
        {employees.map((employee) => (
          <div key={employee.id} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h4 className="text-lg font-medium text-gray-900">{employee.name}</h4>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    employee.has_joined
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {employee.has_joined ? t('joined') : t('pending')}
                  </span>
                </div>
                
                <div className="space-y-1 text-sm text-gray-600">
                  {employee.email ? (
                    <p>📧 {employee.email}</p>
                  ) : (
                    <p>📧 {t('notProvidedYet')}</p>
                  )}
                  <p>📅 {t('invited', { date: new Date(employee.created_at).toLocaleDateString() })}</p>
                  {employee.joined_at && (
                    <p>✅ {t('joinedOn', { date: new Date(employee.joined_at).toLocaleDateString() })}</p>
                  )}
                </div>

                {!employee.has_joined && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-md">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{t('inviteLinkLabel')}</span>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => copyInviteLink(employee)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          {t('copyLink')}
                        </button>
                        <button
                          onClick={() => handleRegenerateToken(employee)}
                          disabled={regeneratingId === employee.id}
                          className="text-orange-600 hover:text-orange-700 text-sm font-medium disabled:opacity-50"
                        >
                          {regeneratingId === employee.id ? t('regenerating') : t('newLink')}
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 p-2 bg-white border rounded text-xs font-mono text-gray-500 truncate">
                      {window.location?.origin || 'localhost:3000'}/join/{employee.invite_token}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="ml-4 flex-shrink-0 flex items-center space-x-2">
                {/* Assign Track Button */}
                <button
                  onClick={() => handleAssignTrack(employee)}
                  className="inline-flex items-center px-3 py-2 border border-blue-300 shadow-sm text-sm leading-4 font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  title="Assign training track"
                >
                  <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  {t('assignTrack')}
                </button>

                {/* Assign Scenario Button */}
                <button
                  onClick={() => handleAssignScenario(employee)}
                  className="inline-flex items-center px-3 py-2 border border-green-300 shadow-sm text-sm leading-4 font-medium rounded-md text-green-700 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  title="Assign individual scenario"
                >
                  <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-1l-4 4z" />
                  </svg>
                  {t('assignScenario')}
                </button>


                {/* Remove Employee Button */}
                <button
                  onClick={() => handleDeleteEmployee(employee)}
                  disabled={deletingId === employee.id}
                  className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Remove employee"
                >
                  {deletingId === employee.id ? (
                    <>
                      <svg className="animate-spin h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('removing')}
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      {t('remove')}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Always Visible Track Assignments */}
            <div className="mt-4 border-t border-gray-200 pt-4">
              <h5 className="text-sm font-medium text-gray-900 mb-3">{t('assignedTrainingTracks')}</h5>
              <EmployeeTracksList key={`tracks-${employee.id}-${refreshKey}`} employee={employee} companyId={companyId} />
            </div>

            {/* Individual Scenario Assignments */}
            <div className="mt-4 border-t border-gray-200 pt-4">
              <h5 className="text-sm font-medium text-gray-900 mb-3">{t('individualScenarios')}</h5>
              <EmployeeScenariosList key={`scenarios-${employee.id}-${refreshKey}`} employee={employee} />
            </div>
          </div>
        ))}
      </div>

      {/* Track Assignment Modal */}
      {selectedEmployee && (
        <TrackAssignmentModal
          isOpen={assignmentModalOpen}
          onClose={() => setAssignmentModalOpen(false)}
          employee={selectedEmployee}
          companyId={companyId}
          onAssignmentCreated={handleAssignmentCreated}
        />
      )}

      {/* Scenario Assignment Modal */}
      {selectedEmployeeForScenario && (
        <ScenarioAssignmentModal
          isOpen={scenarioAssignmentModalOpen}
          onClose={() => setScenarioAssignmentModalOpen(false)}
          employee={selectedEmployeeForScenario}
          companyId={companyId}
          onAssignmentCreated={handleScenarioAssignmentCreated}
        />
      )}
    </div>
  )
}