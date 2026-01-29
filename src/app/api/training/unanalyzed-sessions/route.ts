import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('company_id')

  if (!companyId) {
    return NextResponse.json({ error: 'company_id is required' }, { status: 400 })
  }

  console.log(`🔍 Fetching unanalyzed sessions for company: ${companyId}`)

  try {
    // Query for unanalyzed theory sessions
    const { data: theorySessions, error: theoryError } = await supabaseAdmin
      .from('training_sessions')
      .select('*')
      .eq('company_id', companyId)
      .eq('training_mode', 'theory')
      .not('conversation_transcript', 'is', null)
      .or('assessment_status.is.null,assessment_status.eq.pending')
      .order('created_at', { ascending: true })

    if (theoryError) {
      console.error('❌ Error fetching theory sessions:', theoryError)
      return NextResponse.json({ error: 'Failed to fetch theory sessions' }, { status: 500 })
    }

    // Query for unanalyzed service practice sessions
    const { data: serviceSessions, error: serviceError } = await supabaseAdmin
      .from('training_sessions')
      .select('*')
      .eq('company_id', companyId)
      .eq('training_mode', 'service_practice')
      .not('conversation_transcript', 'is', null)
      .or('service_assessment_status.is.null,service_assessment_status.eq.pending')
      .order('created_at', { ascending: true })

    if (serviceError) {
      console.error('❌ Error fetching service practice sessions:', serviceError)
      return NextResponse.json({ error: 'Failed to fetch service practice sessions' }, { status: 500 })
    }

    // Combine and sort by created_at
    const allUnanalyzedSessions = [
      ...(theorySessions || []),
      ...(serviceSessions || [])
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    if (allUnanalyzedSessions.length === 0) {
      console.log('✅ No unanalyzed sessions found')
      return NextResponse.json({
        success: true,
        sessions: []
      })
    }

    console.log(`📊 Found ${allUnanalyzedSessions.length} unanalyzed sessions (${theorySessions?.length || 0} theory, ${serviceSessions?.length || 0} service practice)`)

    // Get unique employee IDs
    const employeeIds = [...new Set(allUnanalyzedSessions.map(s => s.employee_id).filter(Boolean))]

    // Fetch employee information
    const { data: employees, error: employeesError } = await supabaseAdmin
      .from('users')
      .select('id, name, email')
      .in('id', employeeIds)

    if (employeesError) {
      console.error('❌ Error fetching employees:', employeesError)
      // Continue without employee names
    }

    // Get unique scenario IDs
    const scenarioIds = [...new Set(allUnanalyzedSessions.map(s => s.scenario_id).filter(Boolean))]

    // Fetch scenario information
    let scenarios: any[] = []
    if (scenarioIds.length > 0) {
      const { data: scenarioData, error: scenariosError } = await supabaseAdmin
        .from('scenarios')
        .select('id, title, scenario_type')
        .in('id', scenarioIds)

      if (scenariosError) {
        console.error('❌ Error fetching scenarios:', scenariosError)
        // Continue without scenario names
      } else {
        scenarios = scenarioData || []
      }
    }

    // Create employee lookup map
    const employeeMap = new Map(
      (employees || []).map(emp => [emp.id, emp])
    )

    // Create scenario lookup map
    const scenarioMap = new Map(
      scenarios.map(scenario => [scenario.id, scenario])
    )

    // Transform the data to include employee_name and scenario_name
    const sessionsWithMetadata = allUnanalyzedSessions.map(session => {
      const employee = employeeMap.get(session.employee_id)
      const scenario = scenarioMap.get(session.scenario_id)

      return {
        id: session.id,
        session_name: session.session_name || 'Unnamed Session',
        training_mode: session.training_mode,
        employee_id: session.employee_id,
        employee_name: employee?.name || employee?.email || 'Unknown Employee',
        scenario_name: scenario?.title || null,
        scenario_id: session.scenario_id,
        created_at: session.created_at,
        language: session.language || 'en',
        conversation_transcript: session.conversation_transcript
      }
    })

    console.log(`✅ Returning ${sessionsWithMetadata.length} unanalyzed sessions`)

    return NextResponse.json({
      success: true,
      sessions: sessionsWithMetadata
    })

  } catch (error) {
    console.error('❌ Error in unanalyzed-sessions API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
