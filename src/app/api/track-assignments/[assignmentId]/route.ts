import { NextRequest, NextResponse } from 'next/server'
import { trackAssignmentService } from '@/lib/track-assignments'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { assignmentId } = await params
    const assignment = await trackAssignmentService.getAssignmentWithDetails(assignmentId)

    if (!assignment) {
      return NextResponse.json(
        { success: false, error: 'Assignment not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      assignment
    })

  } catch (error) {
    console.error('Get assignment error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get assignment'
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { assignmentId } = await params
    const body = await request.json()
    const { status, progress_percentage, notes } = body

    const assignment = await trackAssignmentService.updateAssignmentProgress(
      assignmentId,
      { status, progress_percentage, notes }
    )

    return NextResponse.json({
      success: true,
      assignment
    })
  } catch (error: any) {
    console.error('Error updating track assignment:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to update track assignment'
    }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { assignmentId } = await params
    const updates = await request.json()

    const assignment = await trackAssignmentService.updateAssignment(assignmentId, updates)

    return NextResponse.json({
      success: true,
      assignment
    })

  } catch (error) {
    console.error('Update assignment error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update assignment'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { assignmentId } = await params
    await trackAssignmentService.removeTrackAssignment(assignmentId)

    return NextResponse.json({
      success: true,
      message: 'Track assignment removed successfully'
    })
  } catch (error: any) {
    console.error('Error removing track assignment:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to remove track assignment'
    }, { status: 500 })
  }
}