import { NextRequest, NextResponse } from 'next/server'
import { employeeService } from '@/lib/employees'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'email parameter is required' },
        { status: 400 }
      )
    }

    const isEmployee = await employeeService.isEmployee(email)
    const employee = await employeeService.getEmployeeByEmail(email)

    console.log('🔍 Debug role check:', {
      email,
      isEmployee,
      employee: employee ? {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        has_joined: employee.has_joined,
        is_active: employee.is_active
      } : null
    })

    return NextResponse.json({
      success: true,
      email,
      isEmployee,
      employee
    })

  } catch (error) {
    console.error('Debug role error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check role'
      },
      { status: 500 }
    )
  }
}