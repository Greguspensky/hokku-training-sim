'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Employee } from '@/lib/employees'

interface CompactEmployeeListProps {
  employees: Employee[]
  onEmployeeToggled: () => void
  onEmployeeDeleted: () => void
  searchQuery: string
  companyId: string
  onAssignTrack: (employee: Employee) => void
  onAssignScenario: (employee: Employee) => void
}

export default function CompactEmployeeList({
  employees,
  onEmployeeToggled,
  onEmployeeDeleted,
  searchQuery,
  companyId,
  onAssignTrack,
  onAssignScenario
}: CompactEmployeeListProps) {
  const t = useTranslations('employees')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

  const handleToggleActive = async (employee: Employee) => {
    setTogglingId(employee.id)

    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_active' })
      })

      if (response.ok) {
        onEmployeeToggled()
      } else {
        const errorData = await response.json()
        console.error('Failed to toggle employee status:', errorData)
        alert(t('failedToUpdateEmployee'))
      }
    } catch (error) {
      console.error('Failed to toggle employee status:', error)
      alert(t('failedToUpdateEmployee'))
    } finally {
      setTogglingId(null)
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

  const toggleRowExpansion = (employeeId: string) => {
    setExpandedRowId(expandedRowId === employeeId ? null : employeeId)
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
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('name')}
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('email')}
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('status')}
              </th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('active')}
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {employees.map((employee) => (
              <>
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <button
                        onClick={() => toggleRowExpansion(employee.id)}
                        className="mr-2 text-gray-400 hover:text-gray-600"
                      >
                        <svg
                          className={`h-5 w-5 transition-transform ${expandedRowId === employee.id ? 'transform rotate-90' : ''}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-600">
                      {employee.email || <span className="text-gray-400 italic">{t('notProvidedYet')}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      employee.has_joined
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {employee.has_joined ? t('joined') : t('pending')}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <button
                      onClick={() => handleToggleActive(employee)}
                      disabled={togglingId === employee.id}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                        employee.is_active ? 'bg-blue-600' : 'bg-gray-200'
                      } ${togglingId === employee.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          employee.is_active ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      onClick={() => onAssignTrack(employee)}
                      className="text-blue-600 hover:text-blue-900"
                      title={t('assignTrack')}
                    >
                      <svg className="h-5 w-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onAssignScenario(employee)}
                      className="text-green-600 hover:text-green-900"
                      title={t('assignScenario')}
                    >
                      <svg className="h-5 w-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-1l-4 4z" />
                      </svg>
                    </button>
                  </td>
                </tr>
                {/* Expanded Row Details */}
                {expandedRowId === employee.id && (
                  <tr className="bg-gray-50">
                    <td colSpan={5} className="px-4 py-4">
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center space-x-2 text-gray-600">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{t('invited', { date: new Date(employee.created_at).toLocaleDateString() })}</span>
                        </div>
                        {employee.joined_at && (
                          <div className="flex items-center space-x-2 text-gray-600">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{t('joinedOn', { date: new Date(employee.joined_at).toLocaleDateString() })}</span>
                          </div>
                        )}
                        {!employee.has_joined && (
                          <div className="mt-3 p-3 bg-white rounded-md border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">{t('inviteLinkLabel')}</span>
                              <button
                                onClick={() => copyInviteLink(employee)}
                                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                              >
                                {t('copyLink')}
                              </button>
                            </div>
                            <div className="p-2 bg-gray-50 border rounded text-xs font-mono text-gray-500 truncate">
                              {window.location?.origin || 'localhost:3000'}/join/{employee.invite_token}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
