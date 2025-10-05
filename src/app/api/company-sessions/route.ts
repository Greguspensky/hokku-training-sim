import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('company_id')

  if (!companyId) {
    return NextResponse.json({ error: 'company_id is required' }, { status: 400 })
  }

  console.log(`📰 Loading training sessions for company: ${companyId}`)

  try {
    // Get all training sessions for the company
    const { data: sessions, error } = await supabaseAdmin
      .from('training_sessions')
      .select('*')
      .eq('company_id', companyId)
      .order('started_at', { ascending: false })
      .limit(50) // Limit to last 50 sessions

    if (error) {
      console.error('❌ Error fetching company sessions:', error)
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
    }

    if (!sessions || sessions.length === 0) {
      console.log('ℹ️ No sessions found for company')
      return NextResponse.json({
        success: true,
        sessions: []
      })
    }

    // Get unique employee IDs
    const employeeIds = [...new Set(sessions.map(s => s.employee_id).filter(Boolean))]

    // Fetch employee information
    const { data: employees, error: employeesError } = await supabaseAdmin
      .from('users')
      .select('id, name, email')
      .in('id', employeeIds)

    if (employeesError) {
      console.error('❌ Error fetching employees:', employeesError)
      // Continue without employee names
    }

    // Create employee lookup map
    const employeeMap = new Map(
      (employees || []).map(emp => [emp.id, emp])
    )

    // Transform the data to include employee_name
    const sessionsWithEmployeeNames = sessions.map(session => {
      const employee = employeeMap.get(session.employee_id)
      return {
        ...session,
        employee_name: employee?.name || employee?.email || 'Unknown Employee'
      }
    })

    console.log(`✅ Loaded ${sessionsWithEmployeeNames.length} sessions`)

    return NextResponse.json({
      success: true,
      sessions: sessionsWithEmployeeNames
    })

  } catch (error) {
    console.error('❌ Error in company-sessions API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
