'use client'

import { CheckCircle, AlertCircle, TrendingUp, Heart, Briefcase, MessageCircle, Lightbulb, ThumbsDown, Package, Clock, Users } from 'lucide-react'

interface PerformanceMetrics {
  empathy: number
  professionalism: number
  problem_resolution: number
  clarity: number
  deescalation?: number
  product_knowledge_accuracy: number
  milestone_completion_rate: number
}

interface BehavioralMetrics {
  avg_response_time_seconds: number
  session_duration_seconds: number
  turn_balance: {
    employee: number
    customer: number
  }
}

interface PerformanceScoreCardProps {
  overallScore: number
  metrics: PerformanceMetrics
  behavioralMetrics: BehavioralMetrics
}

export default function PerformanceScoreCard({
  overallScore,
  metrics,
  behavioralMetrics
}: PerformanceScoreCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBackground = (score: number) => {
    if (score >= 80) return 'bg-green-50 border-green-200'
    if (score >= 60) return 'bg-yellow-50 border-yellow-200'
    return 'bg-red-50 border-red-200'
  }

  const getProgressBarColor = (score: number) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}m ${secs}s`
  }

  const metricsList = [
    { key: 'empathy', label: 'Empathy', value: metrics.empathy, icon: Heart },
    { key: 'professionalism', label: 'Professionalism', value: metrics.professionalism, icon: Briefcase },
    { key: 'problem_resolution', label: 'Problem Resolution', value: metrics.problem_resolution, icon: Lightbulb },
    { key: 'clarity', label: 'Communication Clarity', value: metrics.clarity, icon: MessageCircle },
    ...(metrics.deescalation !== undefined
      ? [{ key: 'deescalation', label: 'De-escalation', value: metrics.deescalation, icon: ThumbsDown }]
      : []
    ),
    { key: 'product_knowledge', label: 'Product Knowledge', value: metrics.product_knowledge_accuracy, icon: Package },
    { key: 'milestone_completion', label: 'Milestone Completion', value: metrics.milestone_completion_rate, icon: CheckCircle },
  ]

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center mb-6">
        <TrendingUp className="w-6 h-6 text-blue-600 mr-3" />
        <h3 className="text-lg font-semibold text-gray-900">Performance Analysis</h3>
      </div>

      {/* Overall Score */}
      <div className={`p-4 rounded-lg border-2 ${getScoreBackground(overallScore)} mb-6`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600 mb-1">Overall Performance</div>
            <div className={`text-3xl font-bold ${getScoreColor(overallScore)}`}>
              {overallScore}/100
            </div>
          </div>
          <div className="text-right">
            {overallScore >= 80 ? (
              <CheckCircle className="w-12 h-12 text-green-600" />
            ) : overallScore >= 60 ? (
              <AlertCircle className="w-12 h-12 text-yellow-600" />
            ) : (
              <AlertCircle className="w-12 h-12 text-red-600" />
            )}
            <div className={`text-sm font-medium mt-1 ${getScoreColor(overallScore)}`}>
              {overallScore >= 80 ? 'Excellent' : overallScore >= 60 ? 'Good' : 'Needs Work'}
            </div>
          </div>
        </div>
      </div>

      {/* Core Metrics */}
      <div className="space-y-4 mb-6">
        <h4 className="text-md font-semibold text-gray-900">Core Metrics</h4>
        {metricsList.map(({ key, label, value, icon: Icon }) => (
          <div key={key}>
            <div className="flex items-center justify-between text-sm mb-1">
              <div className="flex items-center">
                <Icon className="w-4 h-4 mr-2 text-gray-500" />
                <span className="font-medium text-gray-700">{label}</span>
              </div>
              <span className={`font-bold ${getScoreColor(value)}`}>{value}/100</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getProgressBarColor(value)}`}
                style={{ width: `${value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Behavioral Metrics */}
      <div className="border-t pt-4">
        <h4 className="text-md font-semibold text-gray-900 mb-3">Behavioral Metrics</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <Clock className="w-5 h-5 text-gray-600 mx-auto mb-1" />
            <div className="text-xs text-gray-600 mb-1">Avg Response Time</div>
            <div className="text-lg font-bold text-gray-900">
              {behavioralMetrics.avg_response_time_seconds.toFixed(1)}s
            </div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <Clock className="w-5 h-5 text-gray-600 mx-auto mb-1" />
            <div className="text-xs text-gray-600 mb-1">Session Duration</div>
            <div className="text-lg font-bold text-gray-900">
              {formatTime(behavioralMetrics.session_duration_seconds)}
            </div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <Users className="w-5 h-5 text-gray-600 mx-auto mb-1" />
            <div className="text-xs text-gray-600 mb-1">Turn Balance</div>
            <div className="text-sm font-bold text-gray-900">
              {behavioralMetrics.turn_balance.employee}% / {behavioralMetrics.turn_balance.customer}%
            </div>
            <div className="text-xs text-gray-500">Employee / Customer</div>
          </div>
        </div>
      </div>
    </div>
  )
}
