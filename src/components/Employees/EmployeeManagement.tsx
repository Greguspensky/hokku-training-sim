'use client'

import { useState, useEffect } from 'react'
import { Employee } from '@/lib/employees'
import AddEmployeeForm from './AddEmployeeForm'
import EmployeeList from './EmployeeList'

interface EmployeeManagementProps {
  companyId: string
}

export default function EmployeeManagement({ companyId }: EmployeeManagementProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const loadEmployees = async () => {
    try {
      let url = `/api/employees?company_id=${companyId}`
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery)}`
      }

      const response = await fetch(url)
      const data = await response.json()
      
      if (data.success) {
        setEmployees(data.employees || [])
      }
    } catch (error) {
      console.error('Failed to load employees:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEmployees()
  }, [companyId])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadEmployees()
    }, 300) // Debounce search

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  const handleEmployeeAdded = () => {
    setShowAddForm(false)
    loadEmployees()
  }

  const handleEmployeeDeleted = () => {
    loadEmployees()
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Search is already handled by the useEffect above
  }

  const clearSearch = () => {
    setSearchQuery('')
  }

  if (loading) {
    return (
      <div className="min-h-64 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading employees...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Employee Management</h2>
          <p className="text-gray-600 mt-1">
            Invite employees and manage their training access
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Invite Employee
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <form onSubmit={handleSearch} className="flex items-center space-x-4">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search employees by name or email..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Employee List */}
      <EmployeeList
        employees={employees}
        onEmployeeDeleted={handleEmployeeDeleted}
        searchQuery={searchQuery}
        companyId={companyId}
      />

      {/* Add Employee Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900">Invite New Employee</h3>
              <p className="text-sm text-gray-600">Create an invite link for a new team member</p>
            </div>
            <AddEmployeeForm
              companyId={companyId}
              onSuccess={handleEmployeeAdded}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}