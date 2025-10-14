'use client'

import { useState, useEffect } from 'react'
import { Search, Users, Calendar, CheckCircle } from 'lucide-react'
import { Employee } from '@/lib/employees'

interface EmployeeProgressListProps {
  companyId: string
  selectedEmployeeId: string | null
  onSelectEmployee: (employee: Employee) => void
}

export default function EmployeeProgressList({
  companyId,
  selectedEmployeeId,
  onSelectEmployee
}: EmployeeProgressListProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadEmployees()
  }, [companyId])

  const loadEmployees = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/employees?company_id=${companyId}`)
      const data = await response.json()

      if (data.employees) {
        // Filter only employees who have joined
        const joinedEmployees = data.employees.filter((emp: Employee) => emp.has_joined)
        setEmployees(joinedEmployees)
      }
    } catch (error) {
      console.error('Failed to load employees:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (emp.email && emp.email.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
          </div>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
            {filteredEmployees.length}
          </span>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Employee List */}
      <div className="overflow-y-auto max-h-[600px]">
        {filteredEmployees.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="font-medium">No employees found</p>
            {searchQuery && (
              <p className="text-sm mt-1">Try adjusting your search</p>
            )}
            {!searchQuery && employees.length === 0 && (
              <p className="text-sm mt-1">Invite team members to get started</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredEmployees.map((employee) => (
              <button
                key={employee.id}
                onClick={() => onSelectEmployee(employee)}
                className={`w-full text-left p-4 transition-colors ${
                  selectedEmployeeId === employee.id
                    ? 'bg-blue-50 border-l-4 border-blue-500'
                    : 'hover:bg-gray-50 border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="text-sm font-semibold text-gray-900 truncate">
                        {employee.name}
                      </h4>
                      {employee.has_joined && (
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                    {employee.email && (
                      <p className="text-xs text-gray-600 truncate mb-1">
                        {employee.email}
                      </p>
                    )}
                    {employee.joined_at && (
                      <div className="flex items-center space-x-1 text-xs text-gray-500">
                        <Calendar className="w-3 h-3" />
                        <span>Joined {formatDate(employee.joined_at)}</span>
                      </div>
                    )}
                  </div>
                  {selectedEmployeeId === employee.id && (
                    <div className="ml-2 flex-shrink-0">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
