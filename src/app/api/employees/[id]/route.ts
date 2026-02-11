import { NextRequest, NextResponse } from 'next/server'
import { employeeService } from '@/lib/employees'
import { getCurrentUser } from '@/lib/auth'

interface RouteParams {
  params: {
    id: string
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    
    // Temporarily allow demo mode for testing
    const demoUser = user || {
      id: 'demo-user',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'manager'
    }

    const resolvedParams = await params
    await employeeService.deleteEmployee(resolvedParams.id, demoUser.id)

    return NextResponse.json({
      success: true,
      message: 'Employee deleted successfully'
    })

  } catch (error) {
    console.error('Delete employee error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete employee' 
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    
    // Temporarily allow demo mode for testing
    const demoUser = user || {
      id: 'demo-user',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'manager'
    }

    const resolvedParams = await params
    const body = await request.json()

    // Support regenerating invite token
    if (body.action === 'regenerate_token') {
      const employee = await employeeService.regenerateInviteToken(resolvedParams.id, demoUser.id)

      if (!employee) {
        return NextResponse.json(
          { success: false, error: 'Employee not found' },
          { status: 404 }
        )
      }

      const inviteLink = employeeService.getInviteLink(employee)

      return NextResponse.json({
        success: true,
        employee,
        invite_link: inviteLink,
        message: 'Invite token regenerated successfully'
      })
    }

    // Support toggling active status
    if (body.action === 'toggle_active') {
      const employee = await employeeService.toggleEmployeeActive(resolvedParams.id, demoUser.id)

      if (!employee) {
        return NextResponse.json(
          { success: false, error: 'Employee not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        employee,
        message: employee.is_active ? 'Employee activated' : 'Employee deactivated'
      })
    }

    // Support updating employee name
    if (body.action === 'update_name') {
      const employee = await employeeService.updateEmployeeName(resolvedParams.id, demoUser.id, body.name)

      if (!employee) {
        return NextResponse.json(
          { success: false, error: 'Employee not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        employee,
        message: 'Employee name updated successfully'
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Update employee error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update employee' 
      },
      { status: 500 }
    )
  }
}