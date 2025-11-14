import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'company_id is required' },
        { status: 400 }
      )
    }

    console.log('📊 Fetching employee skill comparison for company:', companyId)

    // Fetch all completed Service Practice sessions with assessment results
    // Note: We don't join users here - we'll match them separately like service-practice-analytics does
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('training_sessions')
      .select('id, employee_id, service_practice_assessment_results, service_assessment_completed_at')
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

    if (!sessions || sessions.length === 0) {
      console.log('📭 No completed sessions found')
      return NextResponse.json({
        success: true,
        employees: []
      })
    }

    console.log(`📚 Found ${sessions.length} completed sessions`)

    // Fetch employees to get names
    const { data: employeesRaw, error: employeesError } = await supabaseAdmin
      .from('employees')
      .select('id, name, user_id, email')
      .eq('company_id', companyId)
      .eq('is_active', true)

    if (employeesError) {
      console.warn('⚠️ Error fetching employees:', employeesError)
    }

    // Fetch users to match with employees
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('company_id', companyId)
      .eq('role', 'employee')

    if (usersError) {
      console.warn('⚠️ Error fetching users:', usersError)
    }

    // Merge employee data with user_id from users table
    const employees = employeesRaw?.map(emp => {
      const user = users?.find(u => u.email === emp.email)
      return {
        ...emp,
        user_id: emp.user_id || user?.id // Use employee.user_id if set, otherwise match by email
      }
    }) || []

    // Create user lookup map by user_id -> employee name
    const userLookup = new Map(employees.map(e => [e.user_id, e.name]) || [])

    console.log(`👥 Found ${employees.length} employees with ${employees.filter(e => e.user_id).length} having user_ids`)

    // Group sessions by employee
    const employeeMap = new Map<string, {
      employee_id: string
      employee_name: string
      email: string
      sessions: any[]
    }>()

    sessions.forEach(session => {
      const employeeName = userLookup.get(session.employee_id)
      if (!employeeName) {
        console.warn(`⚠️ No employee found for session ${session.id} with employee_id ${session.employee_id}`)
        return
      }

      const employee = employees.find(e => e.user_id === session.employee_id)
      const employeeId = session.employee_id

      if (!employeeMap.has(employeeId)) {
        employeeMap.set(employeeId, {
          employee_id: employeeId,
          employee_name: employeeName,
          email: employee?.email || 'unknown@email.com',
          sessions: []
        })
      }

      employeeMap.get(employeeId)!.sessions.push(session)
    })

    console.log(`👥 Processing ${employeeMap.size} employees`)

    // Calculate average metrics for each employee
    const employeeStats = Array.from(employeeMap.values()).map(employee => {
      const sessions = employee.sessions
      const sessionsCount = sessions.length

      // Initialize metric accumulators
      const metrics = {
        empathy: { sum: 0, count: 0 },
        professionalism: { sum: 0, count: 0 },
        problem_resolution: { sum: 0, count: 0 },
        clarity: { sum: 0, count: 0 },
        deescalation: { sum: 0, count: 0 },
        product_knowledge_accuracy: { sum: 0, count: 0 },
        milestone_completion_rate: { sum: 0, count: 0 }
      }

      // Aggregate metrics from all sessions
      sessions.forEach(session => {
        const results = session.service_practice_assessment_results as any
        if (!results?.metrics) return

        const sessionMetrics = results.metrics

        // Add each metric if it exists
        if (sessionMetrics.empathy !== undefined && sessionMetrics.empathy !== null) {
          metrics.empathy.sum += sessionMetrics.empathy
          metrics.empathy.count++
        }
        if (sessionMetrics.professionalism !== undefined && sessionMetrics.professionalism !== null) {
          metrics.professionalism.sum += sessionMetrics.professionalism
          metrics.professionalism.count++
        }
        if (sessionMetrics.problem_resolution !== undefined && sessionMetrics.problem_resolution !== null) {
          metrics.problem_resolution.sum += sessionMetrics.problem_resolution
          metrics.problem_resolution.count++
        }
        if (sessionMetrics.clarity !== undefined && sessionMetrics.clarity !== null) {
          metrics.clarity.sum += sessionMetrics.clarity
          metrics.clarity.count++
        }
        if (sessionMetrics.deescalation !== undefined && sessionMetrics.deescalation !== null) {
          metrics.deescalation.sum += sessionMetrics.deescalation
          metrics.deescalation.count++
        }
        if (sessionMetrics.product_knowledge_accuracy !== undefined && sessionMetrics.product_knowledge_accuracy !== null) {
          metrics.product_knowledge_accuracy.sum += sessionMetrics.product_knowledge_accuracy
          metrics.product_knowledge_accuracy.count++
        }

        // Calculate milestone completion rate from milestones array
        if (results.milestones && Array.isArray(results.milestones)) {
          const completed = results.milestones.filter((m: any) => m.achieved).length
          const total = results.milestones.length
          const completionRate = total > 0 ? (completed / total) * 100 : 0
          metrics.milestone_completion_rate.sum += completionRate
          metrics.milestone_completion_rate.count++
        }
      })

      // Calculate averages
      const averages = {
        empathy: metrics.empathy.count > 0 ? Math.round(metrics.empathy.sum / metrics.empathy.count) : null,
        professionalism: metrics.professionalism.count > 0 ? Math.round(metrics.professionalism.sum / metrics.professionalism.count) : null,
        problem_resolution: metrics.problem_resolution.count > 0 ? Math.round(metrics.problem_resolution.sum / metrics.problem_resolution.count) : null,
        clarity: metrics.clarity.count > 0 ? Math.round(metrics.clarity.sum / metrics.clarity.count) : null,
        deescalation: metrics.deescalation.count > 0 ? Math.round(metrics.deescalation.sum / metrics.deescalation.count) : null,
        product_knowledge_accuracy: metrics.product_knowledge_accuracy.count > 0 ? Math.round(metrics.product_knowledge_accuracy.sum / metrics.product_knowledge_accuracy.count) : null,
        milestone_completion_rate: metrics.milestone_completion_rate.count > 0 ? Math.round(metrics.milestone_completion_rate.sum / metrics.milestone_completion_rate.count) : null
      }

      // Calculate overall average (excluding null values)
      const validMetrics = Object.values(averages).filter(v => v !== null) as number[]
      const overallAverage = validMetrics.length > 0
        ? Math.round(validMetrics.reduce((sum, val) => sum + val, 0) / validMetrics.length)
        : 0

      return {
        employee_id: employee.employee_id,
        employee_name: employee.employee_name,
        email: employee.email,
        sessions_completed: sessionsCount,
        overall_average: overallAverage,
        metrics: averages
      }
    })

    // Sort by overall average (descending)
    employeeStats.sort((a, b) => b.overall_average - a.overall_average)

    // Add rank
    const rankedEmployees = employeeStats.map((emp, index) => ({
      ...emp,
      rank: index + 1
    }))

    // Calculate company-wide statistics
    const companyStats = {
      total_employees: rankedEmployees.length,
      total_sessions: sessions.length,
      company_average: rankedEmployees.length > 0
        ? Math.round(rankedEmployees.reduce((sum, emp) => sum + emp.overall_average, 0) / rankedEmployees.length)
        : 0,
      best_performer: rankedEmployees[0] || null,
      distribution: {
        excellent: rankedEmployees.filter(emp => emp.overall_average >= 80).length,
        good: rankedEmployees.filter(emp => emp.overall_average >= 60 && emp.overall_average < 80).length,
        needs_work: rankedEmployees.filter(emp => emp.overall_average < 60).length
      }
    }

    console.log('✅ Employee skill comparison calculated:', {
      employees: rankedEmployees.length,
      company_average: companyStats.company_average,
      best_performer: companyStats.best_performer?.employee_name
    })

    return NextResponse.json({
      success: true,
      employees: rankedEmployees,
      company_stats: companyStats
    })

  } catch (error) {
    console.error('❌ Error generating employee skill comparison:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
