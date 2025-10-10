import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Fix track assignments that were created with employee table IDs instead of auth user IDs
 * GET /api/fix-user-ids - Updates track_assignments.user_id from employee ID to auth user ID
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔧 Starting user ID fix for track assignments...')

    // Get all employees with their auth user IDs
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email')

    if (usersError) {
      console.error('❌ Failed to fetch users:', usersError)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    const { data: employees, error: employeesError } = await supabaseAdmin
      .from('employees')
      .select('id, email, user_id')

    if (employeesError) {
      console.error('❌ Failed to fetch employees:', employeesError)
      return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
    }

    console.log(`📊 Found ${users?.length || 0} users and ${employees?.length || 0} employees`)

    // Create mapping: employee.id -> user.id (auth ID)
    const employeeToUserMap = new Map<string, string>()

    for (const employee of employees || []) {
      const user = users?.find(u => u.email === employee.email)
      if (user) {
        employeeToUserMap.set(employee.id, user.id)
        console.log(`📍 Mapped employee ${employee.email}: ${employee.id} -> ${user.id}`)
      }
    }

    // Get all track assignments
    const { data: assignments, error: assignmentsError } = await supabaseAdmin
      .from('track_assignments')
      .select('id, user_id')

    if (assignmentsError) {
      console.error('❌ Failed to fetch assignments:', assignmentsError)
      return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
    }

    console.log(`📋 Found ${assignments?.length || 0} track assignments`)

    const updates: Array<{ id: string; old_user_id: string; new_user_id: string }> = []

    // Check each assignment
    for (const assignment of assignments || []) {
      // If the assignment's user_id is an employee ID, update it to the auth user ID
      const correctUserId = employeeToUserMap.get(assignment.user_id)
      if (correctUserId && correctUserId !== assignment.user_id) {
        console.log(`🔄 Updating assignment ${assignment.id}: ${assignment.user_id} -> ${correctUserId}`)

        const { error: updateError } = await supabaseAdmin
          .from('track_assignments')
          .update({ user_id: correctUserId })
          .eq('id', assignment.id)

        if (updateError) {
          console.error(`❌ Failed to update assignment ${assignment.id}:`, updateError)
        } else {
          updates.push({
            id: assignment.id,
            old_user_id: assignment.user_id,
            new_user_id: correctUserId
          })
        }
      }
    }

    console.log(`✅ Fixed ${updates.length} track assignments`)

    return NextResponse.json({
      success: true,
      message: `Fixed ${updates.length} track assignments`,
      updates
    })

  } catch (error) {
    console.error('❌ Error fixing user IDs:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
