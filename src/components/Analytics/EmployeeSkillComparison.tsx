'use client'

import React, { useState, useEffect } from 'react'
import { TrendingUp, Users, Award, BarChart3 } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface EmployeeMetrics {
  empathy: number | null
  professionalism: number | null
  problem_resolution: number | null
  clarity: number | null
  deescalation: number | null
  product_knowledge_accuracy: number | null
  milestone_completion_rate: number | null
}

interface EmployeeSkillData {
  employee_id: string
  employee_name: string
  email: string
  sessions_completed: number
  overall_average: number
  metrics: EmployeeMetrics
  rank: number
}

interface CompanyStats {
  total_employees: number
  total_sessions: number
  company_average: number
  best_performer: EmployeeSkillData | null
  distribution: {
    excellent: number
    good: number
    needs_work: number
  }
}

interface EmployeeSkillComparisonProps {
  companyId: string
}

type MetricKey = keyof EmployeeMetrics | 'overall_average'

const EmployeeSkillComparison: React.FC<EmployeeSkillComparisonProps> = ({ companyId }) => {
  const t = useTranslations()
  const [employees, setEmployees] = useState<EmployeeSkillData[]>([])
  const [companyStats, setCompanyStats] = useState<CompanyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('overall_average')
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart')

  const METRIC_LABELS: Record<MetricKey, string> = {
    overall_average: t('manager.progress.overallAverage'),
    empathy: t('manager.progress.empathy'),
    professionalism: t('manager.progress.professionalism'),
    problem_resolution: t('manager.progress.problemResolution'),
    clarity: t('manager.progress.clarity'),
    deescalation: t('manager.progress.deescalation'),
    product_knowledge_accuracy: t('manager.progress.productKnowledge'),
    milestone_completion_rate: t('manager.progress.milestoneCompletion')
  }

  useEffect(() => {
    loadSkillComparison()
  }, [companyId])

  const loadSkillComparison = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/employees/employee-skill-comparison?company_id=${companyId}`)
      const result = await response.json()

      if (!result.success) {
        setError(result.error || 'Failed to load skill comparison')
        return
      }

      setEmployees(result.employees || [])
      setCompanyStats(result.company_stats || null)
    } catch (err) {
      console.error('Error loading skill comparison:', err)
      setError('Failed to load skill comparison data')
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score: number | null): string => {
    if (score === null) return 'bg-gray-300'
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getScoreBadge = (score: number | null): string => {
    if (score === null) return t('manager.progress.noData')
    if (score >= 80) return t('manager.progress.excellent').split(' ')[0] // Just "Excellent" without range
    if (score >= 60) return t('manager.progress.good').split(' ')[0] // Just "Good" without range
    return t('manager.progress.needsWork')
  }

  const getScoreBadgeColor = (score: number | null): string => {
    if (score === null) return 'bg-gray-100 text-gray-600'
    if (score >= 80) return 'bg-green-100 text-green-800'
    if (score >= 60) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  const getMetricValue = (employee: EmployeeSkillData, metric: MetricKey): number | null => {
    if (metric === 'overall_average') {
      return employee.overall_average
    }
    return employee.metrics[metric]
  }

  const getSortedEmployees = (): EmployeeSkillData[] => {
    return [...employees].sort((a, b) => {
      const aValue = getMetricValue(a, selectedMetric) || 0
      const bValue = getMetricValue(b, selectedMetric) || 0
      return bValue - aValue
    })
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <p className="text-red-600 mb-2">❌ {error}</p>
          <button
            onClick={loadSkillComparison}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            {t('manager.feed.tryAgain')}
          </button>
        </div>
      </div>
    )
  }

  if (employees.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">{t('manager.progress.noServicePracticeData')}</p>
          <p className="text-sm text-gray-500">
            {t('manager.progress.skillComparisonDescription')}
          </p>
        </div>
      </div>
    )
  }

  const sortedEmployees = getSortedEmployees()

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6" />
            {t('manager.progress.employeeSkillComparison')}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {t('manager.progress.performanceMetrics')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('chart')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'chart'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('manager.progress.chart')}
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'table'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('manager.progress.table')}
          </button>
        </div>
      </div>

      {/* Company Statistics */}
      {companyStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-medium text-blue-900">{t('manager.progress.employees')}</p>
            </div>
            <p className="text-2xl font-bold text-blue-600">{companyStats.total_employees}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <p className="text-sm font-medium text-green-900">{t('manager.progress.companyAvg')}</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{companyStats.company_average}/100</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Award className="w-4 h-4 text-purple-600" />
              <p className="text-sm font-medium text-purple-900">{t('manager.progress.bestPerformer')}</p>
            </div>
            <p className="text-lg font-bold text-purple-600 truncate">
              {companyStats.best_performer?.employee_name || 'N/A'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-900 mb-2">{t('manager.progress.distribution')}</p>
            <div className="flex gap-2 text-xs">
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                {companyStats.distribution.excellent} Excellent
              </span>
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                {companyStats.distribution.good} Good
              </span>
              <span className="px-2 py-1 bg-red-100 text-red-800 rounded">
                {companyStats.distribution.needs_work} Need Work
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Metric Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('manager.progress.selectMetricToCompare')}
        </label>
        <select
          value={selectedMetric}
          onChange={(e) => setSelectedMetric(e.target.value as MetricKey)}
          className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {Object.entries(METRIC_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Chart View */}
      {viewMode === 'chart' && (
        <div className="space-y-3">
          {sortedEmployees.map((employee, index) => {
            const score = getMetricValue(employee, selectedMetric)
            const scoreColor = getScoreColor(score)
            const scoreBadge = getScoreBadge(score)
            const scoreBadgeColor = getScoreBadgeColor(score)
            const percentage = score !== null ? score : 0

            return (
              <div
                key={employee.employee_id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-lg font-bold text-gray-400 w-8">
                      #{index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {employee.employee_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {employee.sessions_completed} session{employee.sessions_completed !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${scoreBadgeColor}`}>
                      {scoreBadge}
                    </span>
                    <span className="text-lg font-bold text-gray-900 w-16 text-right">
                      {score !== null ? `${score}/100` : 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full ${scoreColor} transition-all duration-500 ease-out`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Sessions
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Overall
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Empathy
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Professional
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Resolution
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Clarity
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  De-escalation
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Product Know.
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Milestones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map((employee) => (
                <tr key={employee.employee_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{employee.rank}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {employee.employee_name}
                    </div>
                    <div className="text-xs text-gray-500">{employee.email}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-700">
                    {employee.sessions_completed}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <span className={`px-2 py-1 rounded text-sm font-semibold ${getScoreBadgeColor(employee.overall_average)}`}>
                      {employee.overall_average}
                    </span>
                  </td>
                  {(['empathy', 'professionalism', 'problem_resolution', 'clarity', 'deescalation', 'product_knowledge_accuracy', 'milestone_completion_rate'] as const).map((metric) => {
                    const value = employee.metrics[metric]
                    return (
                      <td key={metric} className="px-4 py-3 whitespace-nowrap text-center text-sm">
                        {value !== null ? (
                          <span className={`px-2 py-1 rounded font-medium ${getScoreBadgeColor(value)}`}>
                            {value}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <p className="text-sm font-medium text-gray-700 mb-2">{t('manager.progress.scoreLegend')}</p>
        <div className="flex gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-sm text-gray-600">{t('manager.progress.excellentRange')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <span className="text-sm text-gray-600">{t('manager.progress.goodRange')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span className="text-sm text-gray-600">{t('manager.progress.needsWorkRange')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-300 rounded"></div>
            <span className="text-sm text-gray-600">{t('manager.progress.noData')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmployeeSkillComparison
