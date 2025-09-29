import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Define types inline to avoid imports
interface Track {
  id: string
  name: string
  description: string
  target_audience: string
  company_id: string
  is_active: boolean
  created_at: string
  updated_at: string
  avatar_mode?: string
}

interface Scenario {
  id: string
  track_id: string
  company_id: string
  title: string
  description: string
  scenario_type: string
  template_type: string
  client_behavior: string
  expected_response: string
  difficulty: string
  estimated_duration_minutes: number
  milestones: any[]
  is_active: boolean
  created_at: string
  updated_at: string
  knowledge_category_ids?: string[]
  knowledge_document_ids?: string[]
  avatar_mode?: boolean
  language?: string
}

interface Employee {
  id: string
  name: string
}

interface TrackAssignment {
  id: string
  track_id: string
  user_id: string
  status: string
  attempts_used: number
  created_at: string
  assigned_by: string
  assigned_at: string
}

interface AssignmentWithDetails extends TrackAssignment {
  track: Track & { scenarios: Scenario[] }
  employee: Employee
  scenario_progress: any[]
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { assignmentId } = await params

    console.log('🔍 Getting assignment with details for ID:', assignmentId)

    // Check if this is an individual scenario assignment (format: individual-<scenario-id>)
    if (assignmentId.startsWith('individual-')) {
      const scenarioId = assignmentId.replace('individual-', '')
      console.log('🎯 Individual scenario detected, scenario ID:', scenarioId)

      // Get scenario details directly (first result if multiple)
      const { data: scenarios, error: scenarioError } = await supabaseAdmin
        .from('scenarios')
        .select('*')
        .eq('id', scenarioId)
        .limit(1)

      const scenario = scenarios?.[0]

      if (scenarioError || !scenario) {
        console.log('❌ Individual scenario not found:', scenarioError?.message || 'No scenario data')
        console.log('🔍 Searched for scenario ID:', scenarioId)
        return NextResponse.json(
          { success: false, error: 'Individual scenario not found' },
          { status: 404 }
        )
      }

      console.log('✅ Individual scenario found:', scenario.title)

      // Create a mock assignment structure for individual scenarios
      const mockAssignment: AssignmentWithDetails = {
        id: assignmentId,
        track_id: 'individual',
        user_id: 'individual-user',
        status: 'active',
        attempts_used: 0,
        created_at: new Date().toISOString(),
        assigned_by: 'self',
        assigned_at: new Date().toISOString(),
        track: {
          id: 'individual',
          name: 'Individual Scenario',
          description: 'Single scenario practice',
          target_audience: 'individual',
          company_id: scenario.company_id,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          scenarios: [scenario]
        },
        employee: { id: 'individual-user', name: 'Individual Practice' },
        scenario_progress: []
      }

      console.log('✅ Individual scenario assignment created successfully')
      return NextResponse.json({
        success: true,
        assignment: mockAssignment
      })
    }

    // Regular track assignment handling
    const { data: assignment, error } = await supabaseAdmin
      .from('track_assignments')
      .select('*')
      .eq('id', assignmentId)
      .single()

    if (error) {
      console.log('❌ Assignment query error:', error.message)
      return NextResponse.json(
        { success: false, error: 'Assignment not found' },
        { status: 404 }
      )
    }
    if (!assignment) {
      console.log('❌ Assignment not found')
      return NextResponse.json(
        { success: false, error: 'Assignment not found' },
        { status: 404 }
      )
    }

    console.log('✅ Assignment found:', assignment.id, 'for user_id:', assignment.user_id)

    // Manually get track details (replacing failed JOIN)
    const { data: track, error: trackError } = await supabaseAdmin
      .from('tracks')
      .select('*')
      .eq('id', assignment.track_id)
      .single()

    if (trackError) {
      console.log('❌ Track query error:', trackError.message)
      return NextResponse.json(
        { success: false, error: 'Track not found' },
        { status: 404 }
      )
    }
    if (!track) {
      console.log('❌ Track not found for track_id:', assignment.track_id)
      return NextResponse.json(
        { success: false, error: 'Track not found' },
        { status: 404 }
      )
    }

    console.log('✅ Track found:', track.name)

    // Get scenarios for the track
    const { data: scenarios, error: scenariosError } = await supabaseAdmin
      .from('scenarios')
      .select('*')
      .eq('track_id', assignment.track_id)
      .eq('is_active', true)
      .order('created_at')

    if (scenariosError) {
      console.log('❌ Scenarios query error:', scenariosError.message)
      return NextResponse.json(
        { success: false, error: 'Failed to load scenarios' },
        { status: 500 }
      )
    }

    console.log('✅ Found', scenarios?.length || 0, 'scenarios for track')

    const result: AssignmentWithDetails = {
      ...assignment,
      track: {
        ...track,
        scenarios: scenarios || []
      },
      employee: { id: assignment.user_id, name: 'Employee' },
      scenario_progress: [] // Empty for now since we don't need it for basic functionality
    }

    console.log('✅ Assignment with details built successfully')
    return NextResponse.json({
      success: true,
      assignment: result
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

// DELETE /api/track-assignments-standalone/[assignmentId] - Delete a track assignment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { assignmentId } = await params

    console.log('🗑️ Deleting assignment:', assignmentId)

    // Delete the assignment
    const { error } = await supabaseAdmin
      .from('track_assignments')
      .delete()
      .eq('id', assignmentId)

    if (error) {
      console.log('❌ Error deleting assignment:', error.message)
      return NextResponse.json(
        { success: false, error: 'Failed to delete assignment' },
        { status: 500 }
      )
    }

    console.log('✅ Assignment deleted successfully')
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Delete assignment error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete assignment'
      },
      { status: 500 }
    )
  }
}