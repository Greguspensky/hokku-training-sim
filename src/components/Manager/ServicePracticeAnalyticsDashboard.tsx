'use client'

import { useState, useEffect } from 'react'
import { Trophy, Users, BarChart3, TrendingUp, ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface EmployeeScore {
  score: number
  session_id: string
  completed_at: string
}

interface ScenarioAnalytics {
  scenario_id: string
  scenario_title: string
  customer_emotion_level: string
  total_attempts: number
  completion_count: number
  avg_score: number
  employee_scores: Record<string, EmployeeScore>
}

interface Employee {
  id: string
  name: string
  user_id: string
}

interface AnalyticsData {
  success: boolean
  company_id: string
  total_employees: number
  total_scenarios: number
  scenarios: ScenarioAnalytics[]
  employees: Employee[]
}

export default function ServicePracticeAnalyticsDashboard({
  companyId,
  showOpenButton = true
}: {
  companyId: string
  showOpenButton?: boolean
}) {
  const t = useTranslations()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAnalytics()
  }, [companyId])

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('📊 Loading Service Practice analytics')

      const response = await fetch(`/api/assessment/service-practice-analytics?company_id=${companyId}`)
      const result = await response.json()

      if (response.ok && result.success) {
        setData(result)
        console.log(`✅ Loaded analytics for ${result.total_scenarios} scenarios`)
      } else {
        setError(result.error || 'Failed to load analytics')
      }
    } catch (err) {
      console.error('❌ Error loading analytics:', err)
      setError('Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-green-50 border-green-200 text-green-700'
    if (score >= 60) return 'bg-yellow-50 border-yellow-200 text-yellow-700'
    return 'bg-red-50 border-red-200 text-red-700'
  }

  const getEmotionBadgeColor = (emotion: string) => {
    switch (emotion) {
      case 'normal': return 'bg-blue-100 text-blue-800'
      case 'cold': return 'bg-gray-100 text-gray-800'
      case 'in_a_hurry': return 'bg-yellow-100 text-yellow-800'
      case 'angry': return 'bg-orange-100 text-orange-800'
      case 'extremely_angry': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getEmotionLabel = (emotion: string) => {
    switch (emotion) {
      case 'normal': return 'Normal'
      case 'cold': return 'Cold'
      case 'in_a_hurry': return 'In a Hurry'
      case 'angry': return 'Angry'
      case 'extremely_angry': return 'Extremely Angry'
      default: return emotion
    }
  }

  const handleCellClick = (sessionId: string) => {
    window.open(`/employee/sessions/${sessionId}`, '_blank')
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('manager.progress.errorLoadingAnalytics')}</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={loadAnalytics}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            {t('manager.feed.tryAgain')}
          </button>
        </div>
      </div>
    )
  }

  if (!data || data.scenarios.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="text-gray-400 text-5xl mb-4">📊</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">{t('manager.progress.noServicePracticeData')}</h3>
        <p className="text-gray-500">
          Service Practice sessions with scores will appear here once employees complete and analyze them.
        </p>
      </div>
    )
  }

  // Calculate company-wide stats
  // Only include scenarios completed by more than 1 person for company average
  const scenariosWithMultipleCompletions = data.scenarios.filter(s => s.completion_count > 1)
  const companyAvgScore = scenariosWithMultipleCompletions.length > 0
    ? Math.round(scenariosWithMultipleCompletions.reduce((sum, s) => sum + s.avg_score, 0) / scenariosWithMultipleCompletions.length)
    : 0

  const totalAttempts = data.scenarios.reduce((sum, s) => sum + s.total_attempts, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('manager.progress.servicePracticeAnalytics')}</h2>
            <p className="text-gray-500 mt-1">{t('manager.progress.companyWidePerformance')}</p>
          </div>
          {showOpenButton && (
            <button
              onClick={() => window.open(`/manager/analytics/service-practice?company_id=${companyId}`, '_blank')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title="Open in new window"
            >
              <ExternalLink className="w-5 h-5" />
              <span className="text-sm font-medium">{t('manager.progress.openInNewWindow')}</span>
            </button>
          )}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">{t('manager.progress.scenarios')}</p>
                <p className="text-2xl font-bold text-blue-900">{data.total_scenarios}</p>
              </div>
              <Trophy className="w-8 h-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">{t('manager.progress.companyAvg')}</p>
                <p className="text-2xl font-bold text-green-900">{companyAvgScore}/100</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-400" />
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">{t('manager.progress.totalAttempts')}</p>
                <p className="text-2xl font-bold text-purple-900">{totalAttempts}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-400" />
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">{t('manager.progress.employees')}</p>
                <p className="text-2xl font-bold text-orange-900">{data.total_employees}</p>
              </div>
              <Users className="w-8 h-8 text-orange-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Score Matrix Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                  Scenario
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Emotion
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Score
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Completed
                </th>
                {data.employees.map(employee => (
                  <th key={employee.id} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {employee.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.scenarios.map((scenario) => (
                <tr key={scenario.scenario_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-white z-10">
                    <div className="text-sm font-medium text-gray-900" title={scenario.scenario_title}>
                      {scenario.scenario_title.length > 40
                        ? scenario.scenario_title.substring(0, 40) + '...'
                        : scenario.scenario_title}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getEmotionBadgeColor(scenario.customer_emotion_level)}`}>
                      {getEmotionLabel(scenario.customer_emotion_level)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-semibold ${getScoreBadgeColor(scenario.avg_score)}`}>
                      <Trophy className="w-3.5 h-3.5" />
                      {scenario.avg_score}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="text-sm text-gray-900">
                      {scenario.completion_count}/{data.total_employees}
                    </span>
                  </td>
                  {data.employees.map(employee => {
                    const employeeScore = scenario.employee_scores[employee.id]
                    return (
                      <td key={employee.id} className="px-4 py-4 whitespace-nowrap text-center">
                        {employeeScore ? (
                          <button
                            onClick={() => handleCellClick(employeeScore.session_id)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-sm font-semibold transition-all hover:shadow-md ${getScoreBadgeColor(employeeScore.score)}`}
                            title={`Click to view session\nCompleted: ${new Date(employeeScore.completed_at).toLocaleDateString()}`}
                          >
                            {employeeScore.score}
                          </button>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">{t('manager.progress.scoreColorLegend')}</h4>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-200 border border-green-300"></div>
            <span className="text-gray-600">{t('manager.progress.excellent')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-200 border border-yellow-300"></div>
            <span className="text-gray-600">{t('manager.progress.good')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-200 border border-red-300"></div>
            <span className="text-gray-600">{t('manager.progress.needsImprovement')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-300 font-bold">—</span>
            <span className="text-gray-600">{t('manager.progress.notAttempted')}</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">{t('manager.progress.clickToViewDetails')}</p>
      </div>
    </div>
  )
}
