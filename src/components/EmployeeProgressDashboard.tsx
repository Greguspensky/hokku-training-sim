'use client'

import { useState, useEffect } from 'react'
import { Brain, CheckCircle, Clock, TrendingUp, Award, BookOpen, Target, BarChart3 } from 'lucide-react'
import { QuestionPoolManager, type EmployeeProgress } from '@/lib/question-pool-manager'
import { useAuth } from '@/contexts/AuthContext'

interface ProgressStats {
  totalTopics: number
  masteredTopics: number
  totalAttempts: number
  averageMastery: number
  recentActivity: Date | null
}

interface TopicProgressDisplay extends EmployeeProgress {
  topic_name?: string
  topic_category?: string
  topic_difficulty?: number
}

export default function EmployeeProgressDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<ProgressStats>({
    totalTopics: 0,
    masteredTopics: 0,
    totalAttempts: 0,
    averageMastery: 0,
    recentActivity: null
  })
  const [topicProgress, setTopicProgress] = useState<TopicProgressDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const employeeId = user?.id // Use user ID directly since the table uses user_id

  useEffect(() => {
    if (!employeeId) return
    loadProgressData()
  }, [employeeId])

  const loadProgressData = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('📊 Loading employee progress dashboard for:', employeeId)

      // Get overall stats
      const statsData = await QuestionPoolManager.getEmployeeStats(employeeId)
      setStats(statsData)

      // Get detailed topic progress
      const progressData = await QuestionPoolManager.getEmployeeProgress(employeeId)
      setTopicProgress(progressData as TopicProgressDisplay[])

      console.log('✅ Progress data loaded:', { stats: statsData, topics: progressData.length })

    } catch (err) {
      console.error('❌ Error loading progress:', err)
      setError('Failed to load progress data')
    } finally {
      setLoading(false)
    }
  }

  const getMasteryColor = (mastery: number): string => {
    if (mastery >= 0.8) return 'text-green-600 bg-green-100'
    if (mastery >= 0.6) return 'text-yellow-600 bg-yellow-100'
    if (mastery >= 0.4) return 'text-orange-600 bg-orange-100'
    return 'text-red-600 bg-red-100'
  }

  const getMasteryLabel = (mastery: number): string => {
    if (mastery >= 0.8) return 'Mastered'
    if (mastery >= 0.6) return 'Proficient'
    if (mastery >= 0.4) return 'Learning'
    return 'Beginner'
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'prices': return '💰'
      case 'drinks_info': return '☕'
      case 'manual': return '✋'
      case 'menu': return '🍽️'
      case 'procedures': return '⚙️'
      case 'policies': return '📋'
      default: return '📚'
    }
  }

  const formatDate = (date: Date | null): string => {
    if (!date) return 'Never'

    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    const diffDays = diffMs / (1000 * 60 * 60 * 24)

    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${Math.floor(diffHours)} hours ago`
    if (diffDays < 7) return `${Math.floor(diffDays)} days ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Progress Dashboard</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={loadProgressData}
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
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-blue-100">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Topics</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalTopics}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-green-100">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Mastered</p>
              <p className="text-2xl font-bold text-gray-900">{stats.masteredTopics}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-purple-100">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Attempts</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalAttempts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-yellow-100">
              <TrendingUp className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avg. Mastery</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(stats.averageMastery * 100)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Overall Progress
          </h3>
          <span className="text-sm text-gray-500">
            Last activity: {formatDate(stats.recentActivity)}
          </span>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Knowledge Mastery</span>
            <span className="text-sm text-gray-500">
              {stats.masteredTopics} of {stats.totalTopics} topics mastered
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${stats.totalTopics > 0 ? (stats.masteredTopics / stats.totalTopics) * 100 : 0}%`
              }}
            ></div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Average Performance</span>
            <span className="text-sm text-gray-500">
              {Math.round(stats.averageMastery * 100)}% mastery level
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                stats.averageMastery >= 0.8 ? 'bg-green-600' :
                stats.averageMastery >= 0.6 ? 'bg-yellow-500' :
                stats.averageMastery >= 0.4 ? 'bg-orange-500' : 'bg-red-500'
              }`}
              style={{ width: `${stats.averageMastery * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Topic Progress Details */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Brain className="w-5 h-5 mr-2" />
            Topic Progress
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Detailed progress for each knowledge topic
          </p>
        </div>

        <div className="p-6">
          {topicProgress.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-4xl mb-4">📚</div>
              <p className="text-gray-500">No progress data available yet.</p>
              <p className="text-sm text-gray-400 mt-2">
                Start a training session to begin tracking your progress!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {topicProgress.map((progress, index) => (
                <div key={progress.id || index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <span className="text-2xl mr-3">
                          {getCategoryIcon(progress.topic_category || 'general')}
                        </span>
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {progress.topic_name || `Topic ${progress.topic_id.substring(0, 8)}...`}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {progress.topic_category || 'General'} •
                            Difficulty {progress.topic_difficulty || 1}/3
                          </p>
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">Progress</span>
                          <span className="text-sm text-gray-500">
                            {Math.round(progress.mastery_level * 100)}% mastery
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              progress.mastery_level >= 0.8 ? 'bg-green-500' :
                              progress.mastery_level >= 0.6 ? 'bg-yellow-500' :
                              progress.mastery_level >= 0.4 ? 'bg-orange-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${progress.mastery_level * 100}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span className="flex items-center">
                          <Target className="w-4 h-4 mr-1" />
                          {progress.correct_attempts}/{progress.total_attempts} correct
                        </span>
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {formatDate(progress.last_attempt_at ? new Date(progress.last_attempt_at) : null)}
                        </span>
                      </div>
                    </div>

                    <div className={`ml-4 px-3 py-1 rounded-full text-xs font-medium ${getMasteryColor(progress.mastery_level)}`}>
                      {getMasteryLabel(progress.mastery_level)}
                    </div>
                  </div>

                  {progress.mastered_at && (
                    <div className="mt-3 flex items-center text-sm text-green-600">
                      <Award className="w-4 h-4 mr-1" />
                      Mastered on {new Date(progress.mastered_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Learning Recommendations */}
      {stats.totalTopics > 0 && stats.masteredTopics < stats.totalTopics && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start">
            <div className="p-2 rounded-lg bg-blue-100">
              <Brain className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                Keep Learning!
              </h3>
              <p className="text-blue-800 mb-3">
                You have {stats.totalTopics - stats.masteredTopics} topics left to master.
                {stats.averageMastery < 0.6 && " Focus on practicing more to improve your overall performance."}
                {stats.averageMastery >= 0.6 && stats.averageMastery < 0.8 && " You're doing great! Keep practicing to achieve mastery."}
                {stats.averageMastery >= 0.8 && " Excellent progress! Focus on the remaining topics to complete your training."}
              </p>
              <button
                onClick={() => window.location.href = '/employee/training'}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Start Practice Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mastery Achievement */}
      {stats.totalTopics > 0 && stats.masteredTopics === stats.totalTopics && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-start">
            <div className="p-2 rounded-lg bg-green-100">
              <Award className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-green-900 mb-2">
                🎉 Congratulations!
              </h3>
              <p className="text-green-800 mb-3">
                You have mastered all available knowledge topics!
                Your dedication to learning is impressive.
                Continue practicing to maintain your expertise.
              </p>
              <button
                onClick={() => window.location.href = '/employee/training'}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
              >
                Practice More
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}