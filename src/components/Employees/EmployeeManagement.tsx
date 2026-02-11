'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Employee } from '@/lib/employees'
import AddEmployeeForm from './AddEmployeeForm'
import EmployeeList from './EmployeeList'
import CompactEmployeeList from './CompactEmployeeList'
import TrackAssignmentModal from '@/components/TrackAssignment/TrackAssignmentModal'
import ScenarioAssignmentModal from '@/components/TrackAssignment/ScenarioAssignmentModal'

interface EmployeeManagementProps {
  companyId: string
}

type FilterType = 'active' | 'inactive' | 'all'
type ViewType = 'compact' | 'detailed'

export default function EmployeeManagement({ companyId }: EmployeeManagementProps) {
  const t = useTranslations('employees')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]) // Unfiltered list for counts
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('active')
  const [view, setView] = useState<ViewType>('compact')
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
  const [scenarioAssignmentModalOpen, setScenarioAssignmentModalOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [selectedEmployeeForScenario, setSelectedEmployeeForScenario] = useState<Employee | null>(null)

  const loadEmployees = async () => {
    try {
      setLoading(true) // Set loading when starting fetch
      console.log('🔍 EmployeeManagement loadEmployees called with companyId:', companyId, 'filter:', filter, 'view:', view)

      if (!companyId) {
        console.warn('⚠️ No companyId provided to EmployeeManagement')
        setLoading(false)
        return
      }

      // Always fetch all employees for accurate counts
      let allUrl = `/api/employees?company_id=${companyId}&filter=all`
      console.log('📡 Fetching all employees for counts from:', allUrl)
      const allResponse = await fetch(allUrl)
      const allData = await allResponse.json()

      if (allData.success) {
        setAllEmployees(allData.data?.employees || [])
      }

      // For compact view, always show all employees
      // For detailed view, use filter
      const filterParam = view === 'compact' ? 'all' : filter
      let url = `/api/employees?company_id=${companyId}&filter=${filterParam}`
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery)}`
      }

      console.log('📡 Fetching filtered employees with filter:', filterParam, 'from:', url)
      const response = await fetch(url)
      const data = await response.json()

      console.log('📊 Employees API response:', {
        success: data.success,
        filter: filterParam,
        count: data.data?.count,
        employeesReceived: data.data?.employees?.length,
        employees: data.data?.employees
      })

      if (data.success) {
        setEmployees(data.data?.employees || [])
      }
    } catch (error) {
      console.error('Failed to load employees:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEmployees()
  }, [companyId, filter, view])

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

  const handleEmployeeToggled = () => {
    loadEmployees()
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Search is already handled by the useEffect above
  }

  const clearSearch = () => {
    setSearchQuery('')
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
    loadEmployees()
  }

  const handleScenarioAssignmentCreated = () => {
    loadEmployees()
  }

  if (loading) {
    return (
      <div className="min-h-64 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loadingEmployees')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t('employeeManagement')}</h2>
          <p className="text-gray-600 mt-1">
            {t('inviteEmployeesDescription')}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('compact')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === 'compact'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('compactView')}
            </button>
            <button
              onClick={() => setView('detailed')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === 'detailed'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('detailedView')}
            </button>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {t('inviteEmployee')}
          </button>
        </div>
      </div>

      {/* Filter Tabs - Only show in detailed view */}
      {view === 'detailed' && (
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setFilter('active')}
                className={`${
                  filter === 'active'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                {t('activeEmployees')} ({allEmployees.filter(e => e.is_active).length})
              </button>
              <button
                onClick={() => setFilter('inactive')}
                className={`${
                  filter === 'inactive'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                {t('inactiveEmployees')} ({allEmployees.filter(e => !e.is_active).length})
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`${
                  filter === 'all'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                {t('allEmployees')} ({allEmployees.length})
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <form onSubmit={handleSearch} className="flex items-center space-x-4">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              {t('clear')}
            </button>
          )}
        </form>
      </div>

      {/* Employee List - Compact or Detailed View */}
      {view === 'compact' ? (
        <CompactEmployeeList
          employees={employees}
          onEmployeeToggled={handleEmployeeToggled}
          searchQuery={searchQuery}
        />
      ) : (
        <EmployeeList
          employees={employees}
          onEmployeeDeleted={handleEmployeeDeleted}
          searchQuery={searchQuery}
          companyId={companyId}
        />
      )}

      {/* Add Employee Modal */}
      {showAddForm && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
          onClick={(e) => {
            // Close modal if clicking on backdrop (not on content)
            if (e.target === e.currentTarget) {
              console.log('🚪 Modal backdrop clicked - closing and refreshing list')
              handleEmployeeAdded()
            }
          }}
        >
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900">{t('inviteNewEmployee')}</h3>
              <p className="text-sm text-gray-600">{t('inviteLinkDescription')}</p>
            </div>
            <AddEmployeeForm
              companyId={companyId}
              onSuccess={handleEmployeeAdded}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        </div>
      )}

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