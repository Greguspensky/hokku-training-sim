'use client'

import EmployeeManagement from '@/components/Employees/EmployeeManagement'
import UserHeader from '@/components/UserHeader'
import { useAuth } from '@/contexts/AuthContext'
import { employeeService } from '@/lib/employees'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function EmployeesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [roleChecking, setRoleChecking] = useState(true)
  const [isEmployee, setIsEmployee] = useState(false)
  const companyId = user?.company_id

  console.log('👤 EmployeesPage - user:', { email: user?.email, company_id: user?.company_id, role: user?.role })
  console.log('🏢 EmployeesPage - companyId being passed to EmployeeManagement:', companyId)

  // Check user role on mount
  useEffect(() => {
    const checkUserRole = () => {
      if (user?.role) {
        // Check actual role from database
        const isEmp = user.role === 'employee'
        setIsEmployee(isEmp)
        if (isEmp) {
          console.log('Manager employees page: Employee detected by role, redirecting to /employee')
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

  // Loading state during auth or role checking
  if (authLoading || roleChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // If employee was detected, don't render anything (redirect in progress)
  if (isEmployee) {
    return null
  }

  // Check if user is authenticated and authorized (only after auth loading is complete)
  if (!authLoading && !user) {
    if (typeof window !== 'undefined') {
      window.location.href = '/signin'
    }
    return null
  }

  // Temporarily allow all authenticated users to access employees page
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
          title="Employee Management"
          subtitle="Invite team members and manage their training access"
        />

        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => window.location.href = '/manager'}
                className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
              >
                Feed
              </button>
              <button
                onClick={() => window.location.href = '/manager?tab=training'}
                className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
              >
                Training
              </button>
              <button
                onClick={() => window.location.href = '/manager/knowledge-base'}
                className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
              >
                Knowledge Base
              </button>
              <button
                onClick={() => {}}
                className="border-blue-500 text-blue-600 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
              >
                Employees
              </button>
            </nav>
          </div>
        </div>

        {/* Employee Management Component */}
        <EmployeeManagement companyId={companyId} />
      </div>
    </div>
  )
}