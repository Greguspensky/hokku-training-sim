'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, Target, TrendingUp, BookOpen, Brain } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface AssessmentResult {
  questionId: string
  questionAsked: string
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
  score: number
  feedback: string
  topicName: string
  topicCategory: string
  difficultyLevel: number
}

interface AssessmentSummary {
  totalQuestions: number
  correctAnswers: number
  incorrectAnswers: number
  score: number
  accuracy: number
}

interface TheoryAssessmentResultsProps {
  sessionId: string
  userId: string
  transcript: Array<{ role: 'user' | 'assistant', content: string, timestamp: number }>
  onComplete?: (results: any) => void
}

export default function TheoryAssessmentResults({
  sessionId,
  userId,
  transcript,
  onComplete
}: TheoryAssessmentResultsProps) {
  const t = useTranslations('sessionHistory.theoryAssessment')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assessmentResults, setAssessmentResults] = useState<AssessmentResult[]>([])
  const [summary, setSummary] = useState<AssessmentSummary | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    assessSession()
  }, [sessionId, userId, transcript])

  const assessSession = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('🎯 Starting theory assessment for session:', sessionId)
      console.log('📝 Transcript data received by TheoryAssessmentResults:', {
        length: transcript.length,
        sample: transcript.slice(0, 3)
      })

      const response = await fetch('/api/assessment/assess-theory-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          userId,
          transcript
        })
      })

      const data = await response.json()

      if (response.ok) {
        setAssessmentResults(data.assessmentResults || [])
        setSummary(data.summary || null)
        console.log('✅ Assessment completed:', data.summary)
        onComplete?.(data)
      } else {
        setError(data.error || 'Failed to assess session')
        console.error('❌ Assessment failed:', data.error)
      }
    } catch (err) {
      console.error('❌ Assessment error:', err)
      setError('Failed to assess theory session')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = (questionId: string) => {
    const newExpanded = new Set(expanded)
    if (newExpanded.has(questionId)) {
      newExpanded.delete(questionId)
    } else {
      newExpanded.add(questionId)
    }
    setExpanded(newExpanded)
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'prices': return 'bg-green-100 text-green-800'
      case 'drinks_info': return 'bg-blue-100 text-blue-800'
      case 'manual': return 'bg-yellow-100 text-yellow-800'
      case 'menu': return 'bg-purple-100 text-purple-800'
      case 'procedures': return 'bg-indigo-100 text-indigo-800'
      case 'policies': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

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

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="flex items-center mb-4">
            <Brain className="w-6 h-6 text-blue-600 mr-3" />
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          </div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
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
        <div className="flex items-center mb-4">
          <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">{t('assessmentError')}</h3>
        </div>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={assessSession}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          {t('retryAssessment')}
        </button>
      </div>
    )
  }

  if (!summary || assessmentResults.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('noAssessmentAvailable')}</h3>
          <p className="text-gray-600">
            {t('noQuestionsMatched')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Assessment Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <Brain className="w-6 h-6 text-blue-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">{t('title')}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{summary.totalQuestions}</div>
            <div className="text-sm text-gray-600">{t('questionsAssessed')}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{summary.correctAnswers}</div>
            <div className="text-sm text-gray-600">{t('correct')}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{summary.incorrectAnswers}</div>
            <div className="text-sm text-gray-600">{t('incorrect')}</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${getScoreColor(summary.accuracy)}`}>
              {summary.accuracy}%
            </div>
            <div className="text-sm text-gray-600">{t('overallAccuracy')}</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="font-medium">{t('accuracy')}</span>
            <span>{summary.accuracy}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                summary.accuracy >= 80 ? 'bg-green-500' :
                summary.accuracy >= 60 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${summary.accuracy}%` }}
            />
          </div>
        </div>

        {/* Performance Indicator */}
        <div className={`p-3 rounded-lg border-2 ${getScoreBackground(summary.accuracy)}`}>
          <div className="flex items-center">
            {summary.accuracy >= 80 ? (
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            ) : summary.accuracy >= 60 ? (
              <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 mr-2" />
            )}
            <div>
              <div className={`font-medium ${getScoreColor(summary.accuracy)}`}>
                {summary.accuracy >= 80 ? t('excellentPerformance') :
                 summary.accuracy >= 60 ? t('goodPerformance') :
                 t('needsImprovement')}
              </div>
              <div className="text-sm text-gray-600">
                {summary.accuracy >= 80
                  ? t('excellentMessage')
                  : summary.accuracy >= 60
                  ? t('goodMessage')
                  : t('needsImprovementMessage')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Individual Question Results */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">{t('questionResults')}</h4>

        <div className="space-y-4">
          {assessmentResults.map((result, index) => (
            <div
              key={`${result.questionId}-${index}`}
              className={`border-2 rounded-lg p-4 ${getScoreBackground(result.score)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    {result.isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 mr-2" />
                    )}
                    <span className="font-medium text-gray-900">
                      {t('question')} {index + 1}
                    </span>
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(result.topicCategory)}`}>
                      {result.topicName}
                    </span>
                    <span className="ml-2 flex items-center text-sm text-gray-600">
                      <Target className="w-4 h-4 mr-1" />
                      {t('level')} {result.difficultyLevel}/3
                    </span>
                  </div>

                  <div className="mb-2">
                    <div className="text-sm text-gray-600 mb-1">{t('questionPrompt')}</div>
                    <div className="text-gray-900">{result.questionAsked}</div>
                  </div>

                  <div className="mb-2">
                    <div className="text-sm text-gray-600 mb-1">{t('yourAnswer')}</div>
                    <div className={`${result.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                      {result.userAnswer}
                    </div>
                  </div>

                  {expanded.has(result.questionId) && (
                    <>
                      <div className="mb-2">
                        <div className="text-sm text-gray-600 mb-1">{t('correctAnswer')}</div>
                        <div className="text-gray-900">{result.correctAnswer}</div>
                      </div>

                      <div className="mb-2">
                        <div className="text-sm text-gray-600 mb-1">{t('feedback')}</div>
                        <div className="text-gray-700">{result.feedback}</div>
                      </div>
                    </>
                  )}
                </div>

                <div className="ml-4 text-right">
                  <div className={`text-lg font-bold ${getScoreColor(result.score)}`}>
                    {result.score}%
                  </div>
                  <button
                    onClick={() => toggleExpanded(result.questionId)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {expanded.has(result.questionId) ? t('showLess') : t('showDetails')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}