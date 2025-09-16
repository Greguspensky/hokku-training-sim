import { NextRequest, NextResponse } from 'next/server'
import { trackAssignmentService } from '@/lib/track-assignments'

interface RouteParams {
  params: {
    id: string
  }
}

// PUT /api/track-assignments/[id] - Update assignment progress
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const assignmentId = params.id
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

// DELETE /api/track-assignments/[id] - Remove assignment
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const assignmentId = params.id

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