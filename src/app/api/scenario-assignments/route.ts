import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employee_id')

    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'Employee ID is required' }, { status: 400 })
    }

    const { data: assignments, error } = await supabaseAdmin
      .from('scenario_assignments')
      .select(`
        id,
        scenario_id,
        employee_id,
        assigned_by,
        assigned_at,
        status,
        notes,
        scenarios (
          id,
          title,
          description,
          scenario_type,
          session_time_limit_minutes,
          track_id,
          tracks (
            id,
            name
          )
        )
      `)
      .eq('employee_id', employeeId)
      .order('assigned_at', { ascending: false })

    if (error) {
      console.error('Error fetching scenario assignments:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      assignments: assignments || []
    })
  } catch (error) {
    console.error('Error in scenario assignments API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { employee_id, scenario_id, assigned_by, notes } = body

    console.log('📋 Creating scenario assignment:', { employee_id, scenario_id, assigned_by })
    console.log('📋 Employee ID type:', typeof employee_id, 'value:', employee_id)

    if (!employee_id || !scenario_id || !assigned_by) {
      return NextResponse.json(
        { success: false, error: 'Employee ID, scenario ID, and assigned_by are required' },
        { status: 400 }
      )
    }

    // Verify employee exists
    const { data: employeeCheck, error: employeeCheckError } = await supabaseAdmin
      .from('employees')
      .select('id, name, email')
      .eq('id', employee_id)
      .single()

    if (employeeCheckError || !employeeCheck) {
      console.error('❌ Employee not found in database:', employee_id, employeeCheckError)
      return NextResponse.json(
        { success: false, error: `Employee not found in database. Employee ID: ${employee_id}` },
        { status: 400 }
      )
    }

    console.log('✅ Employee verified:', employeeCheck.name, employeeCheck.email)

    // Verify that the scenario exists in the database
    const { data: existingScenario, error: scenarioError } = await supabaseAdmin
      .from('scenarios')
      .select('id')
      .eq('id', scenario_id)
      .single()

    if (scenarioError || !existingScenario) {
      console.log('🚫 Scenario not found in database:', scenario_id)
      return NextResponse.json(
        { success: false, error: 'Scenario not found. Please select a valid scenario.' },
        { status: 400 }
      )
    }

    // Check if assignment already exists
    const { data: existingAssignment } = await supabaseAdmin
      .from('scenario_assignments')
      .select('id')
      .eq('employee_id', employee_id)
      .eq('scenario_id', scenario_id)
      .single()

    if (existingAssignment) {
      return NextResponse.json(
        { success: false, error: 'This scenario is already assigned to this employee' },
        { status: 400 }
      )
    }

    // Create the assignment
    const { data: assignment, error } = await supabaseAdmin
      .from('scenario_assignments')
      .insert({
        employee_id,
        scenario_id,
        assigned_by,
        assigned_at: new Date().toISOString(),
        status: 'assigned',
        notes: notes || null
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating scenario assignment:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    console.log('✅ Successfully created scenario assignment')

    return NextResponse.json({
      success: true,
      assignment
    })
  } catch (error) {
    console.error('Error in scenario assignments POST:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const assignmentId = searchParams.get('assignment_id')

    if (!assignmentId) {
      return NextResponse.json({ success: false, error: 'Assignment ID is required' }, { status: 400 })
    }

    // First check if the assignment exists
    const { data: existingAssignment, error: fetchError } = await supabaseAdmin
      .from('scenario_assignments')
      .select('id, scenarios(title), employee_id')
      .eq('id', assignmentId)
      .single()

    if (fetchError || !existingAssignment) {
      return NextResponse.json(
        { success: false, error: 'Scenario assignment not found' },
        { status: 404 }
      )
    }

    // Delete the assignment
    const { error: deleteError } = await supabaseAdmin
      .from('scenario_assignments')
      .delete()
      .eq('id', assignmentId)

    if (deleteError) {
      console.error('Error deleting scenario assignment:', deleteError)
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Scenario assignment removed successfully'
    })
  } catch (error) {
    console.error('Error in scenario assignments DELETE:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}