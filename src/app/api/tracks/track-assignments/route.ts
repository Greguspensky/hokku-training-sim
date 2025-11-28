import { NextRequest, NextResponse } from 'next/server'
import { apiErrorHandler, createSuccessResponse, createErrorResponse, parseRequestBody } from '@/lib/utils/api';
import { trackAssignmentService } from '@/lib/track-assignments'

// GET /api/track-assignments - Get assignments for a company or employee
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    const employeeId = searchParams.get('employee_id')

    if (employeeId) {
      // Get assignments for a specific employee
      const assignments = await trackAssignmentService.getEmployeeAssignments(employeeId)
      return NextResponse.json({
        success: true,
        assignments
      })
    } else if (companyId) {
      // Get all assignments for a company (manager view)
      const assignments = await trackAssignmentService.getCompanyAssignments(companyId)
      return NextResponse.json({
        success: true,
        assignments
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Either company_id or employee_id is required'
      }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Error fetching track assignments:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch track assignments'
    }, { status: 500 })
  }
}

// POST /api/track-assignments - Create a new track assignment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { employee_id, track_id, assigned_by, notes } = body

    // Validate required fields
    if (!employee_id || !track_id || !assigned_by) {
      return NextResponse.json({
        success: false,
        error: 'employee_id, track_id, and assigned_by are required'
      }, { status: 400 })
    }

    // Check if assignment already exists
    const hasExisting = await trackAssignmentService.hasTrackAssignment(employee_id, track_id)
    if (hasExisting) {
      return NextResponse.json({
        success: false,
        error: 'Employee already has this track assigned'
      }, { status: 409 })
    }

    const assignment = await trackAssignmentService.assignTrackToEmployee({
      employee_id,
      track_id,
      assigned_by,
      notes
    })

    return NextResponse.json({
      success: true,
      assignment
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating track assignment:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create track assignment'
    }, { status: 500 })
  }
}