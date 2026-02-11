'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Employee } from '@/lib/employees'

interface CompactEmployeeListProps {
  employees: Employee[]
  onEmployeeToggled: () => void
  searchQuery: string
}

export default function CompactEmployeeList({
  employees,
  onEmployeeToggled,
  searchQuery
}: CompactEmployeeListProps) {
  const t = useTranslations('employees')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [editedName, setEditedName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

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

  const handleOpenEdit = (employee: Employee) => {
    setEditingEmployee(employee)
    setEditedName(employee.name)
  }

  const handleCloseEdit = () => {
    setEditingEmployee(null)
    setEditedName('')
  }

  const handleSaveName = async () => {
    if (!editingEmployee || !editedName.trim()) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/employees/${editingEmployee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_name', name: editedName.trim() })
      })

      if (response.ok) {
        onEmployeeToggled() // Refresh list
        handleCloseEdit()
      } else {
        const errorData = await response.json()
        console.error('Failed to update employee name:', errorData)
        alert(t('failedToUpdateEmployee'))
      }
    } catch (error) {
      console.error('Failed to update employee name:', error)
      alert(t('failedToUpdateEmployee'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteEmployee = async () => {
    if (!editingEmployee) return

    const confirmed = window.confirm(t('confirmDeleteEmployee', { name: editingEmployee.name }))
    if (!confirmed) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/employees/${editingEmployee.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        onEmployeeToggled() // Refresh list
        handleCloseEdit()
      } else {
        const errorData = await response.json()
        console.error('Failed to delete employee:', errorData)
        alert(t('failedToRemoveEmployee'))
      }
    } catch (error) {
      console.error('Failed to delete employee:', error)
      alert(t('failedToRemoveEmployee'))
    } finally {
      setIsDeleting(false)
    }
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

  // Sort employees: active first, then inactive
  const sortedEmployees = [...employees].sort((a, b) => {
    if (a.is_active === b.is_active) return 0
    return a.is_active ? -1 : 1
  })

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('name')}
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('email')}
              </th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('active')}
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedEmployees.map((employee) => (
              <tr key={employee.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-600">
                    {employee.email || <span className="text-gray-400 italic">{t('notProvidedYet')}</span>}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
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
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <button
                    onClick={() => handleOpenEdit(employee)}
                    className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                  >
                    {t('edit')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Employee Modal */}
      {editingEmployee && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseEdit()
            }
          }}
        >
          <div className="relative top-20 mx-auto p-6 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">{t('editEmployee')}</h3>
            </div>

            {/* Name Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('employeeName')}
              </label>
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('enterFullName')}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between space-x-3">
              <button
                onClick={handleDeleteEmployee}
                disabled={isDeleting || isSaving}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? t('deleting') : t('deleteEmployee')}
              </button>
              <button
                onClick={handleCloseEdit}
                disabled={isDeleting || isSaving}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSaveName}
                disabled={isDeleting || isSaving || !editedName.trim()}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? t('saving') : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
