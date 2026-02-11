'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, TrendingUp, BookOpen, Target, Brain, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

interface QuestionProgress {
  id: string
  question_template: string
  correct_answer: string
  topic_name: string
  topic_category: string
  difficulty_level: number
  status: 'correct' | 'incorrect' | 'partially_correct' | 'unanswered'
  attempts?: number
  last_answer?: string
  last_attempt_at?: string
  manager_override?: boolean
  manager_override_status?: string
}

interface TopicSummary {
  topic_id: string
  topic_name: string
  topic_category: string
  total_questions: number
  correct_questions: number
  incorrect_questions: number
  partially_correct_questions: number
  unanswered_questions: number
  mastery_percentage: number
}

interface QuestionProgressDashboardProps {
  userId?: string
  companyId?: string
  managerView?: boolean  // NEW: Enable manager actions like status override
}

export default function QuestionProgressDashboard({ userId: propUserId, companyId: propCompanyId, managerView = false }: QuestionProgressDashboardProps = {}) {
  const t = useTranslations()
  const { user } = useAuth()
  const [questions, setQuestions] = useState<QuestionProgress[]>([])
  const [topics, setTopics] = useState<TopicSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTopic, setSelectedTopic] = useState<string>('all')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'correct' | 'incorrect' | 'partially_correct'>('all')
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [updatingQuestionId, setUpdatingQuestionId] = useState<string | null>(null)
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null)
  const [editedAnswer, setEditedAnswer] = useState<string>('')

  // Use props if provided, otherwise fall back to auth context
  const userId = propUserId || user?.id
  const companyId = propCompanyId || user?.company_id

  useEffect(() => {
    if (!userId) return
    loadQuestionProgress()
  }, [userId, companyId])

  // Auto-refresh when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && userId && companyId) {
        console.log('👁️ Tab visible - refreshing progress data')
        loadQuestionProgress()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [userId, companyId])

  const loadQuestionProgress = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('📚 Loading question-level progress for user:', userId, 'company:', companyId)

      // Add cache-busting timestamp to ensure fresh data
      const timestamp = new Date().getTime()
      const companyParam = companyId ? `&company_id=${companyId}` : ''
      const response = await fetch(`/api/questions/question-progress?user_id=${userId}${companyParam}&_t=${timestamp}`)
      const data = await response.json()

      if (response.ok) {
        setQuestions(data.questions || [])
        setTopics(data.topics || [])
        setLastRefresh(new Date())
        console.log('✅ Loaded progress:', { questions: data.questions?.length, topics: data.topics?.length })
      } else {
        setError(data.error || 'Failed to load progress')
      }
    } catch (err) {
      console.error('❌ Error loading progress:', err)
      setError('Failed to load progress data')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (questionId: string, newStatus: 'correct' | 'incorrect' | 'partially_correct' | 'unanswered') => {
    if (!userId) {
      console.error('❌ Cannot update status: userId is missing')
      return
    }

    try {
      setUpdatingQuestionId(questionId)

      console.log('🔄 Updating question status:', { questionId, newStatus, userId })

      const response = await fetch('/api/questions/update-question-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: userId,
          question_id: questionId,
          new_status: newStatus,
          manager_id: user?.id
        })
      })

      const data = await response.json()

      if (response.ok) {
        console.log('✅ Status updated successfully')

        // Update local state optimistically
        setQuestions(prevQuestions =>
          prevQuestions.map(q =>
            q.id === questionId
              ? { ...q, status: newStatus as 'correct' | 'incorrect' | 'partially_correct' | 'unanswered' }
              : q
          )
        )

        // Reload fresh data to get updated topic summaries
        await loadQuestionProgress()
      } else {
        console.error('❌ Failed to update status:', data.error)
        alert(`Failed to update status: ${data.error}`)
      }
    } catch (error) {
      console.error('❌ Error updating status:', error)
      alert('Failed to update question status')
    } finally {
      setUpdatingQuestionId(null)
    }
  }

  const handleEditAnswer = (questionId: string, currentAnswer: string) => {
    setEditingAnswerId(questionId)
    setEditedAnswer(currentAnswer || '')
  }

  const handleCancelEdit = () => {
    setEditingAnswerId(null)
    setEditedAnswer('')
  }

  const handleSaveAnswer = async (questionId: string) => {
    if (!userId) {
      console.error('❌ Cannot update answer: userId is missing')
      return
    }

    try {
      setUpdatingQuestionId(questionId)

      console.log('🔄 Updating question answer:', { questionId, editedAnswer, userId })

      const response = await fetch('/api/questions/update-question-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: userId,
          question_id: questionId,
          new_answer: editedAnswer,
          manager_id: user?.id
        })
      })

      const data = await response.json()

      if (response.ok) {
        console.log('✅ Answer updated successfully')

        // Update local state optimistically
        setQuestions(prevQuestions =>
          prevQuestions.map(q =>
            q.id === questionId
              ? { ...q, last_answer: editedAnswer }
              : q
          )
        )

        // Clear editing state
        setEditingAnswerId(null)
        setEditedAnswer('')

        // Reload fresh data
        await loadQuestionProgress()
      } else {
        console.error('❌ Failed to update answer:', data.error)
        alert(`Failed to update answer: ${data.error}`)
      }
    } catch (error) {
      console.error('❌ Error updating answer:', error)
      alert('Failed to update answer')
    } finally {
      setUpdatingQuestionId(null)
    }
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'correct': return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'incorrect': return <XCircle className="w-5 h-5 text-red-600" />
      case 'partially_correct': return <CheckCircle className="w-5 h-5 text-orange-500" />
      case 'unanswered': return <Clock className="w-5 h-5 text-gray-400" />
      default: return <Clock className="w-5 h-5 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'correct': return 'bg-green-50 border-green-200'
      case 'incorrect': return 'bg-red-50 border-red-200'
      case 'partially_correct': return 'bg-orange-50 border-orange-200'
      case 'unanswered': return 'bg-gray-50 border-gray-200'
      default: return 'bg-gray-50 border-gray-200'
    }
  }

  // Apply topic filter
  let filteredQuestions = selectedTopic === 'all'
    ? questions
    : questions.filter(q => q.topic_name === selectedTopic)

  // Apply status filter
  if (selectedStatusFilter !== 'all') {
    filteredQuestions = filteredQuestions.filter(q => q.status === selectedStatusFilter)
  }

  const totalQuestions = questions.length
  const correctQuestions = questions.filter(q => q.status === 'correct').length
  const incorrectQuestions = questions.filter(q => q.status === 'incorrect').length
  const partiallyCorrectQuestions = questions.filter(q => q.status === 'partially_correct').length
  const unansweredQuestions = questions.filter(q => q.status === 'unanswered').length

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
          <div className="text-red-500 text-4xl mb-4">📚</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('questionProgress.title')}</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={loadQuestionProgress}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            {t('questionProgress.tryAgain')}
          </button>
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <div className="text-gray-400 text-4xl mb-4">📚</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('questionProgress.noQuestionsTitle')}</h3>
          <p className="text-gray-500">{t('questionProgress.noQuestionsDescription')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t('questionProgress.title')}</h2>
          <p className="text-sm text-gray-500">
            {t('questionProgress.lastUpdated')} {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={loadQuestionProgress}
          disabled={loading}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {t('questionProgress.refresh')}
        </button>
      </div>

      {/* Summary Stats - Clickable Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          onClick={() => setSelectedStatusFilter('all')}
          className={`bg-white rounded-lg shadow p-6 text-left transition-all hover:shadow-lg ${
            selectedStatusFilter === 'all' ? 'ring-2 ring-blue-500' : ''
          }`}
        >
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-blue-100">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">{t('questionProgress.totalQuestions')}</p>
              <p className="text-2xl font-bold text-gray-900">{totalQuestions}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setSelectedStatusFilter('correct')}
          className={`bg-white rounded-lg shadow p-6 text-left transition-all hover:shadow-lg ${
            selectedStatusFilter === 'correct' ? 'ring-2 ring-green-500' : ''
          }`}
        >
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-green-100">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">{t('questionProgress.correct')}</p>
              <p className="text-2xl font-bold text-green-600">{correctQuestions}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setSelectedStatusFilter('partially_correct')}
          className={`bg-white rounded-lg shadow p-6 text-left transition-all hover:shadow-lg ${
            selectedStatusFilter === 'partially_correct' ? 'ring-2 ring-orange-500' : ''
          }`}
        >
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-orange-100">
              <CheckCircle className="w-6 h-6 text-orange-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">{t('questionProgress.partiallyCorrect')}</p>
              <p className="text-2xl font-bold text-orange-600">{partiallyCorrectQuestions}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setSelectedStatusFilter('incorrect')}
          className={`bg-white rounded-lg shadow p-6 text-left transition-all hover:shadow-lg ${
            selectedStatusFilter === 'incorrect' ? 'ring-2 ring-red-500' : ''
          }`}
        >
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-red-100">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">{t('questionProgress.incorrect')}</p>
              <p className="text-2xl font-bold text-red-600">{incorrectQuestions}</p>
            </div>
          </div>
        </button>
      </div>

      {/* Theory Practice Integration Note */}
      {(incorrectQuestions > 0 || partiallyCorrectQuestions > 0 || unansweredQuestions > 0) && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6 text-center">
          <div className="mb-4">
            <Brain className="w-12 h-12 text-blue-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-blue-900 mb-2">{t('questionProgress.readyToPractice')}</h3>
            <p className="text-blue-700 mb-1">
              {t('questionProgress.questionsNeedPractice', { count: incorrectQuestions + partiallyCorrectQuestions + unansweredQuestions })}
            </p>
            <p className="text-sm text-blue-600">
              {incorrectQuestions > 0 && t('questionProgress.incorrectCount', { count: incorrectQuestions })}
              {incorrectQuestions > 0 && (partiallyCorrectQuestions > 0 || unansweredQuestions > 0) && ' • '}
              {partiallyCorrectQuestions > 0 && `${partiallyCorrectQuestions} ${t('questionProgress.partiallyCorrect').toLowerCase()}`}
              {partiallyCorrectQuestions > 0 && unansweredQuestions > 0 && ' • '}
              {unansweredQuestions > 0 && t('questionProgress.unansweredCount', { count: unansweredQuestions })}
            </p>
          </div>

          <div className="text-center">
            <p className="text-sm text-blue-700 mb-2">
              💡 {t('questionProgress.useStartTraining')}
            </p>
            <p className="text-xs text-blue-600">
              {t('questionProgress.aiTrainerNote')}
            </p>
          </div>
        </div>
      )}

      {/* Topic Summaries */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('questionProgress.title')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {topics.map(topic => (
            <div key={topic.topic_id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <span className="text-2xl mr-2">
                  {getCategoryIcon(topic.topic_category)}
                </span>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{topic.topic_name}</h4>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(topic.topic_category)}`}>
                    {topic.topic_category}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-green-600">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    {t('questionProgress.correct')}
                  </span>
                  <span className="font-medium">{topic.correct_questions}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-orange-600">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    {t('questionProgress.partiallyCorrect')}
                  </span>
                  <span className="font-medium">{topic.partially_correct_questions}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-red-600">
                    <XCircle className="w-4 h-4 mr-1" />
                    {t('questionProgress.incorrect')}
                  </span>
                  <span className="font-medium">{topic.incorrect_questions}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600">
                    <Clock className="w-4 h-4 mr-1" />
                    {t('questionProgress.unanswered')}
                  </span>
                  <span className="font-medium">{topic.unanswered_questions}</span>
                </div>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium">{t('questionProgress.progress')}</span>
                  <span>{Math.round(topic.mastery_percentage)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      topic.mastery_percentage >= 80 ? 'bg-green-500' :
                      topic.mastery_percentage >= 60 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${topic.mastery_percentage}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Topic Filter */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setSelectedTopic('all')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedTopic === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('questionProgress.allQuestions')} ({totalQuestions})
          </button>
          {topics.map(topic => (
            <button
              key={topic.topic_name}
              onClick={() => setSelectedTopic(topic.topic_name)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedTopic === topic.topic_name
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {getCategoryIcon(topic.topic_category)} {topic.topic_name} ({topic.total_questions})
            </button>
          ))}
        </div>

        {/* Questions List */}
        <div className="space-y-3">
          {filteredQuestions.map(question => (
            <div
              key={question.id}
              className={`p-4 rounded-lg border-2 ${getStatusColor(question.status)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    {getStatusIcon(question.status)}
                    <h4 className="font-medium text-gray-900 ml-2">
                      {question.question_template}
                    </h4>
                  </div>

                  {/* Show user's latest answer if they have answered */}
                  {question.last_answer && (
                    <div className="mb-3 p-2 rounded-lg bg-gray-50 border-l-4 border-gray-300">
                      {editingAnswerId === question.id ? (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-700 font-semibold mb-1">{t('questionProgress.editAnswer')}</p>
                          <textarea
                            value={editedAnswer}
                            onChange={(e) => setEditedAnswer(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            rows={2}
                            disabled={updatingQuestionId === question.id}
                          />
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleSaveAnswer(question.id)}
                              disabled={updatingQuestionId === question.id || !editedAnswer.trim()}
                              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {updatingQuestionId === question.id ? t('questionProgress.saving') : t('questionProgress.save')}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={updatingQuestionId === question.id}
                              className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {t('questionProgress.cancel')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-gray-700">
                            <strong className="text-gray-900">{t('questionProgress.yourAnswer')}</strong> {question.last_answer}
                          </p>
                          {managerView && (
                            <button
                              onClick={() => handleEditAnswer(question.id, question.last_answer || '')}
                              className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                              {t('questionProgress.editAnswer')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(question.topic_category)}`}>
                      {question.topic_category}
                    </span>
                    <span className="flex items-center">
                      <Target className="w-4 h-4 mr-1" />
                      {t('questionProgress.level')} {question.difficulty_level}/3
                    </span>
                    {question.attempts && (
                      <span>{question.attempts} {t('questionProgress.attempts')}</span>
                    )}
                  </div>

                  {managerView && question.status !== 'unanswered' && (
                    <div className="text-sm">
                      <p className="text-gray-600">
                        <strong>{t('questionProgress.correctAnswer')}</strong> {question.correct_answer}
                      </p>
                      {question.manager_override && (
                        <p className="text-orange-600 mt-2 text-xs italic">
                          ⚠️ {t('questionProgress.managerOverride', { status: question.manager_override_status })}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="ml-4 text-right">
                  {managerView ? (
                    <div className="flex flex-col space-y-2">
                      <select
                        value={question.status}
                        onChange={(e) => handleStatusChange(question.id, e.target.value as 'correct' | 'incorrect' | 'partially_correct' | 'unanswered')}
                        disabled={updatingQuestionId === question.id}
                        className={`px-3 py-1 rounded-md text-sm font-medium border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          question.status === 'correct' ? 'bg-green-50 border-green-300 text-green-800' :
                          question.status === 'incorrect' ? 'bg-red-50 border-red-300 text-red-800' :
                          question.status === 'partially_correct' ? 'bg-orange-50 border-orange-300 text-orange-800' :
                          'bg-gray-50 border-gray-300 text-gray-800'
                        } ${updatingQuestionId === question.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}`}
                      >
                        <option value="unanswered">{t('questionProgress.unanswered')}</option>
                        <option value="incorrect">{t('questionProgress.incorrect')}</option>
                        <option value="partially_correct">{t('questionProgress.partiallyCorrect')}</option>
                        <option value="correct">{t('questionProgress.correct')}</option>
                      </select>
                      {updatingQuestionId === question.id && (
                        <span className="text-xs text-blue-600">{t('questionProgress.updating')}</span>
                      )}
                    </div>
                  ) : (
                    <>
                      {question.status === 'unanswered' && (
                        <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-medium">
                          {t('questionProgress.unanswered')}
                        </span>
                      )}
                      {question.status === 'incorrect' && (
                        <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                          {t('questionProgress.incorrect')}
                        </span>
                      )}
                      {question.status === 'partially_correct' && (
                        <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
                          {t('questionProgress.partiallyCorrect')}
                        </span>
                      )}
                      {question.status === 'correct' && (
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                          {t('questionProgress.correct')}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}