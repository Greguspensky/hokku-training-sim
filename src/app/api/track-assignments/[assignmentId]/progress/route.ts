import { NextRequest, NextResponse } from 'next/server'
import { trackAssignmentService } from '@/lib/track-assignments'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { assignmentId } = await params
    const { scenario_id, status, score } = await request.json()

    // Update scenario progress
    const assignment = await trackAssignmentService.updateScenarioProgressAndAssignment(
      assignmentId,
      scenario_id,
      status,
      score
    )

    return NextResponse.json({
      success: true,
      assignment
    })

  } catch (error) {
    console.error('Update progress error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update progress'
      },
      { status: 500 }
    )
  }
}