'use client'

import { useState, useEffect } from 'react'
import { Users, Brain, TrendingUp, Award, AlertTriangle, Calendar, BarChart3, PieChart, Filter } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase'
import { QuestionPoolManager } from '@/lib/question-pool-manager'
import { useAuth } from '@/contexts/AuthContext'

interface CompanyStats {
  totalEmployees: number
  activeEmployees: number
  totalTopics: number
  averageCompanyMastery: number
  totalAttempts: number
  recentSessions: number
}

interface EmployeeAnalytics {
  employee_id: string
  employee_name: string
  email: string
  totalTopics: number
  masteredTopics: number
  averageMastery: number
  totalAttempts: number
  lastActivity: Date | null
  riskLevel: 'low' | 'medium' | 'high'
}

interface TopicAnalytics {
  topic_id: string
  topic_name: string
  category: string
  difficulty: number
  totalEmployees: number
  masteredEmployees: number
  averageMastery: number
  totalAttempts: number
  successRate: number
}

export default function ManagerAnalyticsDashboard() {
  const { user } = useAuth()
  const [companyStats, setCompanyStats] = useState<CompanyStats>({
    totalEmployees: 0,
    activeEmployees: 0,
    totalTopics: 0,
    averageCompanyMastery: 0,
    totalAttempts: 0,
    recentSessions: 0
  })
  const [employeeAnalytics, setEmployeeAnalytics] = useState<EmployeeAnalytics[]>([])
  const [topicAnalytics, setTopicAnalytics] = useState<TopicAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'employees' | 'topics'>('overview')
  const [timeFilter, setTimeFilter] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

  const companyId = user?.company_id

  useEffect(() => {
    if (!companyId) return
    loadAnalyticsData()
  }, [companyId, timeFilter])

  const loadAnalyticsData = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('📊 Loading manager analytics for company:', companyId)

      // Load company overview stats
      await Promise.all([
        loadCompanyStats(),
        loadEmployeeAnalytics(),
        loadTopicAnalytics()
      ])

      console.log('✅ Analytics data loaded successfully')

    } catch (err) {
      console.error('❌ Error loading analytics:', err)
      setError('Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  const loadCompanyStats = async () => {
    try {
      // Get total employees for company
      const { data: employees, error: empError } = await supabaseAdmin
        .from('employees')
        .select('id, user:user_id(last_sign_in_at)')
        .eq('company_id', companyId)

      if (empError) {
        console.warn('⚠️ Could not load employees:', empError)
        return
      }

      const totalEmployees = employees?.length || 0
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - parseInt(timeFilter === 'all' ? '365' : timeFilter))

      const activeEmployees = employees?.filter(emp =>
        emp.user?.last_sign_in_at && new Date(emp.user.last_sign_in_at) > recentDate
      ).length || 0

      // Get topics count
      const { data: topics } = await supabaseAdmin
        .from('knowledge_topics')
        .select('id')
        .eq('company_id', companyId)
        .eq('is_active', true)

      const totalTopics = topics?.length || 0

      // Calculate aggregate stats from employee progress
      let totalAttempts = 0
      let totalMasterySum = 0
      let totalProgressRecords = 0

      for (const employee of employees || []) {
        const stats = await QuestionPoolManager.getEmployeeStats(employee.id)
        totalAttempts += stats.totalAttempts
        if (stats.totalTopics > 0) {
          totalMasterySum += stats.averageMastery
          totalProgressRecords++
        }
      }

      const averageCompanyMastery = totalProgressRecords > 0 ? totalMasterySum / totalProgressRecords : 0

      // Get recent training sessions
      const { data: recentSessions } = await supabaseAdmin
        .from('training_sessions')
        .select('id')
        .gte('created_at', recentDate.toISOString())
        .in('employee_id', employees?.map(e => e.id) || [])

      setCompanyStats({
        totalEmployees,
        activeEmployees,
        totalTopics,
        averageCompanyMastery,
        totalAttempts,
        recentSessions: recentSessions?.length || 0
      })

    } catch (error) {
      console.warn('⚠️ Error loading company stats:', error)
    }
  }

  const loadEmployeeAnalytics = async () => {
    try {
      const { data: employees, error } = await supabaseAdmin
        .from('employees')
        .select(`
          id,
          user:user_id(
            email,
            last_sign_in_at,
            profiles(full_name)
          )
        `)
        .eq('company_id', companyId)

      if (error || !employees) {
        console.warn('⚠️ Could not load employees for analytics:', error)
        return
      }

      const analytics: EmployeeAnalytics[] = []

      for (const employee of employees) {
        const stats = await QuestionPoolManager.getEmployeeStats(employee.id)

        const masteryPercentage = stats.averageMastery
        const activityRecency = stats.recentActivity

        // Determine risk level based on performance and activity
        let riskLevel: 'low' | 'medium' | 'high' = 'low'
        if (masteryPercentage < 0.4 || (activityRecency && Date.now() - activityRecency.getTime() > 14 * 24 * 60 * 60 * 1000)) {
          riskLevel = 'high'
        } else if (masteryPercentage < 0.7 || (activityRecency && Date.now() - activityRecency.getTime() > 7 * 24 * 60 * 60 * 1000)) {
          riskLevel = 'medium'
        }

        analytics.push({
          employee_id: employee.id,
          employee_name: employee.user?.profiles?.full_name || employee.user?.email || 'Unknown',
          email: employee.user?.email || '',
          totalTopics: stats.totalTopics,
          masteredTopics: stats.masteredTopics,
          averageMastery: masteryPercentage,
          totalAttempts: stats.totalAttempts,
          lastActivity: stats.recentActivity,
          riskLevel
        })
      }

      // Sort by risk level (high first), then by mastery level (low first)
      analytics.sort((a, b) => {
        const riskOrder = { high: 0, medium: 1, low: 2 }
        if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
          return riskOrder[a.riskLevel] - riskOrder[b.riskLevel]
        }
        return a.averageMastery - b.averageMastery
      })

      setEmployeeAnalytics(analytics)

    } catch (error) {
      console.warn('⚠️ Error loading employee analytics:', error)
    }
  }

  const loadTopicAnalytics = async () => {
    try {
      const { data: topics, error } = await supabaseAdmin
        .from('knowledge_topics')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)

      if (error || !topics) {
        console.warn('⚠️ Could not load topics for analytics:', error)
        return
      }

      const analytics: TopicAnalytics[] = []

      for (const topic of topics) {
        // Get all employee progress for this topic
        const { data: progressRecords } = await supabaseAdmin
          .from('employee_topic_progress')
          .select('*')
          .eq('topic_id', topic.id)

        const totalEmployees = progressRecords?.length || 0
        const masteredEmployees = progressRecords?.filter(p => p.mastery_level >= 0.8).length || 0
        const averageMastery = totalEmployees > 0
          ? progressRecords!.reduce((sum, p) => sum + p.mastery_level, 0) / totalEmployees
          : 0
        const totalAttempts = progressRecords?.reduce((sum, p) => sum + p.total_attempts, 0) || 0
        const totalCorrect = progressRecords?.reduce((sum, p) => sum + p.correct_attempts, 0) || 0
        const successRate = totalAttempts > 0 ? totalCorrect / totalAttempts : 0

        analytics.push({
          topic_id: topic.id,
          topic_name: topic.name,
          category: topic.category,
          difficulty: topic.difficulty_level,
          totalEmployees,
          masteredEmployees,
          averageMastery,
          totalAttempts,
          successRate
        })
      }

      // Sort by success rate (lowest first) to highlight problem areas
      analytics.sort((a, b) => {
        if (a.averageMastery !== b.averageMastery) {
          return a.averageMastery - b.averageMastery
        }
        return a.successRate - b.successRate
      })

      setTopicAnalytics(analytics)

    } catch (error) {
      console.warn('⚠️ Error loading topic analytics:', error)
    }
  }

  const getRiskColor = (riskLevel: 'low' | 'medium' | 'high'): string => {
    switch (riskLevel) {
      case 'high': return 'text-red-600 bg-red-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-green-600 bg-green-100'
    }
  }

  const getRiskLabel = (riskLevel: 'low' | 'medium' | 'high'): string => {
    switch (riskLevel) {
      case 'high': return 'Needs Attention'
      case 'medium': return 'Monitoring'
      case 'low': return 'On Track'
    }
  }

  const formatDate = (date: Date | null): string => {
    if (!date) return 'Never'

    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)

    if (diffDays < 1) return 'Today'
    if (diffDays < 7) return `${Math.floor(diffDays)} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6">
                <div className="h-4 bg-gray-200 rounded mb-2 w-1/3"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Analytics Dashboard</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={loadAnalyticsData}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Time Filter */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Company Analytics</h2>
            <p className="text-gray-500 mt-1">Training performance across your organization</p>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <Filter className="w-4 h-4 text-gray-400 mr-2" />
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as any)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="all">All time</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-blue-100">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Employees</p>
              <p className="text-2xl font-bold text-gray-900">{companyStats.totalEmployees}</p>
              <p className="text-xs text-gray-400">{companyStats.activeEmployees} active</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-purple-100">
              <Brain className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avg. Company Mastery</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(companyStats.averageCompanyMastery * 100)}%
              </p>
              <p className="text-xs text-gray-400">{companyStats.totalTopics} topics</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-green-100">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Training Activity</p>
              <p className="text-2xl font-bold text-gray-900">{companyStats.recentSessions}</p>
              <p className="text-xs text-gray-400">{companyStats.totalAttempts} total attempts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'employees', label: 'Employees', icon: Users },
              { id: 'topics', label: 'Topics', icon: Brain }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Performance Distribution */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Distribution</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <AlertTriangle className="w-6 h-6 text-red-600 mr-3" />
                      <div>
                        <p className="font-semibold text-red-900">Needs Attention</p>
                        <p className="text-2xl font-bold text-red-900">
                          {employeeAnalytics.filter(e => e.riskLevel === 'high').length}
                        </p>
                        <p className="text-sm text-red-700">employees</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <Calendar className="w-6 h-6 text-yellow-600 mr-3" />
                      <div>
                        <p className="font-semibold text-yellow-900">Monitoring</p>
                        <p className="text-2xl font-bold text-yellow-900">
                          {employeeAnalytics.filter(e => e.riskLevel === 'medium').length}
                        </p>
                        <p className="text-sm text-yellow-700">employees</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <Award className="w-6 h-6 text-green-600 mr-3" />
                      <div>
                        <p className="font-semibold text-green-900">On Track</p>
                        <p className="text-2xl font-bold text-green-900">
                          {employeeAnalytics.filter(e => e.riskLevel === 'low').length}
                        </p>
                        <p className="text-sm text-green-700">employees</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'employees' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Employee Performance</h3>
              <div className="space-y-4">
                {employeeAnalytics.map((employee) => (
                  <div key={employee.employee_id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <div>
                            <h4 className="font-medium text-gray-900">{employee.employee_name}</h4>
                            <p className="text-sm text-gray-500">{employee.email}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Mastery:</span>
                            <span className="ml-2 font-medium">
                              {Math.round(employee.averageMastery * 100)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Topics:</span>
                            <span className="ml-2 font-medium">
                              {employee.masteredTopics}/{employee.totalTopics}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Attempts:</span>
                            <span className="ml-2 font-medium">{employee.totalAttempts}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Last Activity:</span>
                            <span className="ml-2 font-medium">
                              {formatDate(employee.lastActivity)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className={`ml-4 px-3 py-1 rounded-full text-xs font-medium ${getRiskColor(employee.riskLevel)}`}>
                        {getRiskLabel(employee.riskLevel)}
                      </div>
                    </div>
                  </div>
                ))}

                {employeeAnalytics.length === 0 && (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No employee data available yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'topics' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Topic Performance</h3>
              <div className="space-y-4">
                {topicAnalytics.map((topic) => (
                  <div key={topic.topic_id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <span className="text-2xl mr-3">
                            {topic.category === 'menu' ? '🍽️' :
                             topic.category === 'procedures' ? '⚙️' :
                             topic.category === 'policies' ? '📋' : '📚'}
                          </span>
                          <div>
                            <h4 className="font-medium text-gray-900">{topic.topic_name}</h4>
                            <p className="text-sm text-gray-500">
                              {topic.category} • Difficulty {topic.difficulty}/3
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Avg. Mastery:</span>
                            <span className="ml-2 font-medium">
                              {Math.round(topic.averageMastery * 100)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Completed:</span>
                            <span className="ml-2 font-medium">
                              {topic.masteredEmployees}/{topic.totalEmployees}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Success Rate:</span>
                            <span className="ml-2 font-medium">
                              {Math.round(topic.successRate * 100)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Total Attempts:</span>
                            <span className="ml-2 font-medium">{topic.totalAttempts}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {topicAnalytics.length === 0 && (
                  <div className="text-center py-8">
                    <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No topic data available yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}