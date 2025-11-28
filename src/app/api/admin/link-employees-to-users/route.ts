import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Link employees table to users table by populating user_id
 * GET /api/link-employees-to-users
 */
export async function GET() {
  try {
    console.log('🔗 Linking employees to auth users...')

    // Get all users
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email')

    if (usersError) {
      console.error('❌ Failed to fetch users:', usersError)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    // Get all employees
    const { data: employees, error: employeesError } = await supabaseAdmin
      .from('employees')
      .select('id, email, user_id')

    if (employeesError) {
      console.error('❌ Failed to fetch employees:', employeesError)
      return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
    }

    console.log(`📊 Found ${users?.length || 0} users and ${employees?.length || 0} employees`)

    const updates: Array<{ employee_id: string; email: string; auth_user_id: string }> = []

    // Link each employee to their auth user
    for (const employee of employees || []) {
      const user = users?.find(u => u.email === employee.email)

      if (user && user.id !== employee.user_id) {
        console.log(`🔄 Linking employee ${employee.email}: employee.user_id = ${user.id}`)

        const { error: updateError } = await supabaseAdmin
          .from('employees')
          .update({ user_id: user.id })
          .eq('id', employee.id)

        if (updateError) {
          console.error(`❌ Failed to update employee ${employee.id}:`, updateError)
        } else {
          updates.push({
            employee_id: employee.id,
            email: employee.email,
            auth_user_id: user.id
          })
        }
      }
    }

    console.log(`✅ Linked ${updates.length} employees to auth users`)

    return NextResponse.json({
      success: true,
      message: `Linked ${updates.length} employees to auth users`,
      updates
    })

  } catch (error) {
    console.error('❌ Error linking employees:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
