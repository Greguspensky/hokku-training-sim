import { NextRequest, NextResponse } from 'next/server'
import { employeeService, type CreateEmployeeData } from '@/lib/employees'
import { apiErrorHandler, createSuccessResponse, createErrorResponse, parseRequestBody } from '@/lib/utils/api'

export async function GET(request: NextRequest) {
  try {
    // Temporarily bypass auth check since we simplified auth system
    // const user = await getCurrentUserServer()
    // if (!user || user.role !== 'manager') {
    //   return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    // }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    const search = searchParams.get('search')
    const filter = searchParams.get('filter') || 'active' // active, inactive, all

    if (!companyId) {
      return createErrorResponse('company_id parameter is required', 400)
    }

    // Use demo user for testing
    const demoUser = {
      id: 'demo-user',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'manager'
    };

    let employees
    if (search) {
      employees = await employeeService.searchEmployees(demoUser.id, companyId, search, filter)
    } else {
      employees = await employeeService.getEmployeesByManager(demoUser.id, companyId, filter)
    }

    return createSuccessResponse({ employees, count: employees.length })

  } catch (error) {
    return apiErrorHandler(error, 'Get employees')
  }
}

export async function POST(request: NextRequest) {
  try {
    // Temporarily bypass auth check since we simplified auth system
    // const user = await getCurrentUserServer()
    // if (!user) {
    //   return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    // }

    // Temporarily allow all authenticated users
    // if (user.role !== 'manager') {
    //   return NextResponse.json({ success: false, error: 'Manager access required' }, { status: 403 })
    // }

    // Use demo user for testing
    const demoUser = {
      id: 'demo-user',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'manager'
    };

    const body = await parseRequestBody<any>(request)
    const employeeData: CreateEmployeeData = {
      name: body.name,
      company_id: body.company_id,
      manager_id: demoUser.id
    }

    // Validate required fields
    if (!employeeData.name || !employeeData.company_id) {
      return createErrorResponse('name and company_id are required', 400)
    }

    if (!employeeData.name.trim()) {
      return createErrorResponse('Employee name cannot be empty', 400)
    }

    const employee = await employeeService.createEmployee(employeeData)

    // Generate invite link
    const inviteLink = employeeService.getInviteLink(employee)

    return createSuccessResponse({ employee, invite_link: inviteLink }, 'Employee invite created successfully')

  } catch (error) {
    return apiErrorHandler(error, 'Create employee')
  }
}