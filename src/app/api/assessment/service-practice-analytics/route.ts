import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Company ID is required' },
        { status: 400 }
      )
    }

    console.log('📊 Loading Service Practice analytics for company:', companyId)

    // Get all employees - join with users table to get user_id
    const { data: employeesRaw, error: employeesError } = await supabaseAdmin
      .from('employees')
      .select('id, name, user_id, company_id, email')
      .eq('company_id', companyId)
      .eq('is_active', true)

    if (employeesError) {
      console.error('❌ Error fetching employees:', employeesError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch employees' },
        { status: 500 }
      )
    }

    // Get users to match with employees (to get user_id)
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('company_id', companyId)
      .eq('role', 'employee')

    // Merge employee data with user_id from users table
    const employees = employeesRaw?.map(emp => {
      const user = users?.find(u => u.email === emp.email)
      return {
        ...emp,
        user_id: emp.user_id || user?.id // Use employee.user_id if set, otherwise match by email
      }
    }) || []

    console.log(`👥 Merged employees with user_ids: ${employees.filter(e => e.user_id).length}/${employees.length}`)

    // Get all Service Practice sessions with scores for this company
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('training_sessions')
      .select('id, employee_id, scenario_id, service_practice_assessment_results, service_assessment_status, service_assessment_completed_at, started_at')
      .eq('company_id', companyId)
      .eq('training_mode', 'service_practice')
      .eq('service_assessment_status', 'completed')
      .not('service_practice_assessment_results', 'is', null)

    if (sessionsError) {
      console.error('❌ Error fetching sessions:', sessionsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch sessions' },
        { status: 500 }
      )
    }

    // Fetch ALL Service Practice scenarios for this company (even if not attempted yet)
    const { data: scenarios, error: scenariosError } = await supabaseAdmin
      .from('scenarios')
      .select('id, title, customer_emotion_level')
      .eq('company_id', companyId)
      .eq('scenario_type', 'service_practice')
      .eq('is_active', true)

    if (scenariosError) {
      console.error('❌ Error fetching scenarios:', scenariosError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch scenarios' },
        { status: 500 }
      )
    }

    console.log(`📚 Found ${scenarios?.length || 0} Service Practice scenarios (scenario_type='service_practice')`)

    // Create a map for quick scenario lookup
    const scenarioLookup = new Map(scenarios?.map(s => [s.id, s]) || [])

    console.log(`✅ Found ${sessions?.length || 0} analyzed Service Practice sessions`)

    // Get all employees who have joined (even if they haven't completed sessions yet)
    const relevantEmployees = employees.filter(emp => emp.user_id) // All joined employees

    console.log(`👥 Total employees (including those without sessions): ${relevantEmployees.length}`)
    console.log(`📝 Employee names:`, relevantEmployees.map(e => `${e.name} (${e.user_id?.substring(0, 8)}...)`))

    // Create a mapping from user_id to employee for score lookup
    const userIdToEmployee = new Map(relevantEmployees.map(e => [e.user_id, e]))
    const employeeIdToEmployee = new Map(relevantEmployees.map(e => [e.id, e]))

    // Aggregate data by scenario
    const scenarioAggregateMap = new Map<string, {
      scenario_id: string
      scenario_title: string
      customer_emotion_level: string
      total_attempts: number
      completion_count: number
      scores: number[]
      employee_scores: Record<string, {
        score: number
        session_id: string
        completed_at: string
      }>
    }>()

    // Pre-populate map with ALL scenarios (including those without sessions)
    scenarios?.forEach(scenario => {
      scenarioAggregateMap.set(scenario.id, {
        scenario_id: scenario.id,
        scenario_title: scenario.title,
        customer_emotion_level: scenario.customer_emotion_level || 'normal',
        total_attempts: 0,
        completion_count: 0,
        scores: [],
        employee_scores: {}
      })
    })

    // Now add session data to the scenarios that have sessions
    sessions?.forEach(session => {
      const scenarioId = session.scenario_id

      if (!scenarioId || !scenarioAggregateMap.has(scenarioId)) return

      const scenarioData = scenarioAggregateMap.get(scenarioId)!
      const results = session.service_practice_assessment_results as any
      const score = results?.overallScore || results?.overall_score

      if (typeof score === 'number' && !isNaN(score)) {
        scenarioData.total_attempts++
        scenarioData.scores.push(score)

        // Map session.employee_id (which is actually user_id) to employee.id
        const employee = userIdToEmployee.get(session.employee_id) || employeeIdToEmployee.get(session.employee_id)

        if (employee) {
          const employeeKey = employee.id

          // Store employee's best score for this scenario
          if (!scenarioData.employee_scores[employeeKey] ||
              scenarioData.employee_scores[employeeKey].score < score) {
            scenarioData.employee_scores[employeeKey] = {
              score,
              session_id: session.id,
              completed_at: session.service_assessment_completed_at || session.started_at
            }
          }
        }
      }
    })

    // Convert map to array and calculate completion counts
    const aggregatedScenarios = Array.from(scenarioAggregateMap.values()).map(scenario => {
      scenario.completion_count = Object.keys(scenario.employee_scores).length
      return scenario
    })

    // Sort by completion count (descending) - most completed first
    aggregatedScenarios.sort((a, b) => b.completion_count - a.completion_count)

    // Calculate average scores
    const scenariosWithAverages = aggregatedScenarios.map(scenario => ({
      ...scenario,
      avg_score: scenario.scores.length > 0
        ? Math.round(scenario.scores.reduce((a, b) => a + b, 0) / scenario.scores.length)
        : 0
    }))

    console.log(`📈 Aggregated ${aggregatedScenarios.length} scenarios`)

    return NextResponse.json({
      success: true,
      company_id: companyId,
      total_employees: relevantEmployees.length,
      total_scenarios: aggregatedScenarios.length,
      scenarios: scenariosWithAverages,
      employees: relevantEmployees.map(emp => ({
        id: emp.id,
        name: emp.name,
        user_id: emp.user_id
      }))
    })

  } catch (error) {
    console.error('❌ Error in service-practice-analytics API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
