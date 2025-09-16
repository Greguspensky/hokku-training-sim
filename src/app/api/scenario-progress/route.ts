import { NextRequest, NextResponse } from 'next/server'
import { trackAssignmentService } from '@/lib/track-assignments'

// GET /api/scenario-progress - Get scenario progress for an assignment
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const assignmentId = searchParams.get('assignment_id')

    if (!assignmentId) {
      return NextResponse.json({
        success: false,
        error: 'assignment_id is required'
      }, { status: 400 })
    }

    const progress = await trackAssignmentService.getAssignmentScenarioProgress(assignmentId)

    return NextResponse.json({
      success: true,
      progress
    })
  } catch (error: any) {
    console.error('Error fetching scenario progress:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch scenario progress'
    }, { status: 500 })
  }
}

// POST /api/scenario-progress - Update scenario progress
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      assignment_id,
      scenario_id,
      status,
      score,
      feedback,
      time_spent_minutes
    } = body

    // Validate required fields
    if (!assignment_id || !scenario_id) {
      return NextResponse.json({
        success: false,
        error: 'assignment_id and scenario_id are required'
      }, { status: 400 })
    }

    const progress = await trackAssignmentService.updateScenarioProgress(
      assignment_id,
      scenario_id,
      {
        status,
        score,
        feedback,
        time_spent_minutes
      }
    )

    return NextResponse.json({
      success: true,
      progress
    })
  } catch (error: any) {
    console.error('Error updating scenario progress:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to update scenario progress'
    }, { status: 500 })
  }
}