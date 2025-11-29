import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface MetricSummary {
  empathy: number
  professionalism: number
  problem_resolution: number
  clarity: number
  deescalation?: number
  product_knowledge_accuracy: number
  milestone_completion_rate: number
}

interface StrengthWeakness {
  point: string
  frequency: number
  examples: string[]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employee_id')

    if (!employeeId) {
      return NextResponse.json(
        { success: false, error: 'Employee ID is required' },
        { status: 400 }
      )
    }

    console.log('📊 Loading Service Practice summary for employee:', employeeId)

    // Fetch all completed Service Practice sessions with assessments
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('training_sessions')
      .select('id, service_practice_assessment_results, service_assessment_completed_at, scenario_id, started_at')
      .eq('employee_id', employeeId)
      .eq('training_mode', 'service_practice')
      .eq('service_assessment_status', 'completed')
      .not('service_practice_assessment_results', 'is', null)
      .order('service_assessment_completed_at', { ascending: true })

    if (sessionsError) {
      console.error('❌ Error fetching sessions:', sessionsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch sessions' },
        { status: 500 }
      )
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        success: true,
        has_data: false,
        message: 'No completed Service Practice sessions found'
      })
    }

    console.log(`✅ Found ${sessions.length} completed Service Practice sessions`)

    // Aggregate metrics
    const metricSums: MetricSummary = {
      empathy: 0,
      professionalism: 0,
      problem_resolution: 0,
      clarity: 0,
      deescalation: 0,
      product_knowledge_accuracy: 0,
      milestone_completion_rate: 0
    }

    let deescalationCount = 0
    let overallScoreSum = 0

    const strengthsMap = new Map<string, { frequency: number; examples: string[] }>()
    const improvementsMap = new Map<string, { frequency: number; examples: string[] }>()

    // Aggregate data from all sessions
    sessions.forEach(session => {
      const results = session.service_practice_assessment_results as any

      if (results.overall_score) {
        overallScoreSum += results.overall_score
      }

      // Aggregate metrics
      if (results.metrics) {
        metricSums.empathy += results.metrics.empathy?.score || 0
        metricSums.professionalism += results.metrics.professionalism?.score || 0
        metricSums.problem_resolution += results.metrics.problem_resolution?.score || 0
        metricSums.clarity += results.metrics.clarity?.score || 0
        metricSums.product_knowledge_accuracy += results.metrics.product_knowledge_accuracy?.score || 0
        metricSums.milestone_completion_rate += results.metrics.milestone_completion_rate?.score || 0

        if (results.metrics.deescalation !== undefined) {
          metricSums.deescalation! += results.metrics.deescalation?.score || 0
          deescalationCount++
        }
      }

      // Aggregate strengths
      if (results.strengths && Array.isArray(results.strengths)) {
        results.strengths.forEach((strength: any) => {
          const point = strength.point || strength
          if (typeof point === 'string') {
            if (!strengthsMap.has(point)) {
              strengthsMap.set(point, { frequency: 0, examples: [] })
            }
            const entry = strengthsMap.get(point)!
            entry.frequency++
            if (strength.evidence && entry.examples.length < 3) {
              entry.examples.push(strength.evidence)
            }
          }
        })
      }

      // Aggregate improvements
      if (results.improvements && Array.isArray(results.improvements)) {
        results.improvements.forEach((improvement: any) => {
          const point = improvement.point || improvement
          if (typeof point === 'string') {
            if (!improvementsMap.has(point)) {
              improvementsMap.set(point, { frequency: 0, examples: [] })
            }
            const entry = improvementsMap.get(point)!
            entry.frequency++
            if (improvement.current && entry.examples.length < 3) {
              entry.examples.push(improvement.current)
            }
          }
        })
      }
    })

    // Calculate averages
    const sessionCount = sessions.length
    const averageMetrics: MetricSummary = {
      empathy: Math.round(metricSums.empathy / sessionCount),
      professionalism: Math.round(metricSums.professionalism / sessionCount),
      problem_resolution: Math.round(metricSums.problem_resolution / sessionCount),
      clarity: Math.round(metricSums.clarity / sessionCount),
      product_knowledge_accuracy: Math.round(metricSums.product_knowledge_accuracy / sessionCount),
      milestone_completion_rate: Math.round(metricSums.milestone_completion_rate / sessionCount)
    }

    if (deescalationCount > 0) {
      averageMetrics.deescalation = Math.round(metricSums.deescalation! / deescalationCount)
    }

    const averageOverallScore = Math.round(overallScoreSum / sessionCount)

    // Sort and format top strengths
    const topStrengths: StrengthWeakness[] = Array.from(strengthsMap.entries())
      .map(([point, data]) => ({ point, frequency: data.frequency, examples: data.examples }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5)

    // Sort and format top improvements
    const topImprovements: StrengthWeakness[] = Array.from(improvementsMap.entries())
      .map(([point, data]) => ({ point, frequency: data.frequency, examples: data.examples }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5)

    // Calculate trend (comparing first half vs second half of sessions)
    let trend: 'improving' | 'stable' | 'declining' = 'stable'
    if (sessionCount >= 4) {
      const midpoint = Math.floor(sessionCount / 2)
      const firstHalf = sessions.slice(0, midpoint)
      const secondHalf = sessions.slice(midpoint)

      const firstHalfAvg = firstHalf.reduce((sum, s) => sum + ((s.service_practice_assessment_results as any).overall_score || 0), 0) / firstHalf.length
      const secondHalfAvg = secondHalf.reduce((sum, s) => sum + ((s.service_practice_assessment_results as any).overall_score || 0), 0) / secondHalf.length

      const diff = secondHalfAvg - firstHalfAvg
      if (diff > 5) trend = 'improving'
      else if (diff < -5) trend = 'declining'
    }

    console.log(`📈 Summary: ${sessionCount} sessions, avg score ${averageOverallScore}, trend: ${trend}`)

    return NextResponse.json({
      success: true,
      has_data: true,
      employee_id: employeeId,
      summary: {
        total_sessions: sessionCount,
        average_overall_score: averageOverallScore,
        average_metrics: averageMetrics,
        trend,
        first_session_date: sessions[0].service_assessment_completed_at || sessions[0].started_at,
        last_session_date: sessions[sessionCount - 1].service_assessment_completed_at || sessions[sessionCount - 1].started_at
      },
      patterns: {
        top_strengths: topStrengths,
        top_improvements: topImprovements
      }
    })

  } catch (error) {
    console.error('❌ Error in employee-service-practice-summary API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
