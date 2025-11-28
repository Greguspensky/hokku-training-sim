'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, ArrowRight, ArrowLeft, RotateCcw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

interface PracticeQuestion {
  id: string
  question_template: string
  correct_answer: string
  topic_name: string
  topic_category: string
  difficulty_level: number
  status: 'correct' | 'incorrect' | 'unanswered'
  previous_answer?: string
  attempts: number
  last_attempt_at?: string
}

interface PracticeSummary {
  total_available: number
  needs_practice: number
  incorrect_answers: number
  unanswered: number
}

interface TheoryPracticeSessionProps {
  assignmentId: string
  onSessionComplete?: (results: any) => void
}

export default function TheoryPracticeSession({
  assignmentId,
  onSessionComplete
}: TheoryPracticeSessionProps) {
  const { user } = useAuth()
  const t = useTranslations('training')
  const [questions, setQuestions] = useState<PracticeQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [sessionResults, setSessionResults] = useState<{[key: string]: boolean}>({})
  const [sessionComplete, setSessionComplete] = useState(false)
  const [summary, setSummary] = useState<PracticeSummary | null>(null)
  const [startTime, setStartTime] = useState<Date>(new Date())
  const [questionStartTime, setQuestionStartTime] = useState<Date>(new Date())

  useEffect(() => {
    if (user?.id) {
      loadPracticeQuestions()
    }
  }, [user?.id, assignmentId])

  const loadPracticeQuestions = async () => {
    try {
      setLoading(true)

      const response = await fetch(
        `/api/theory-practice?user_id=${user?.id}&assignment_id=${assignmentId}`
      )

      const data = await response.json()

      if (response.ok) {
        setQuestions(data.questions || [])
        setSummary(data.summary)
        setStartTime(new Date())
        setQuestionStartTime(new Date())

        console.log('📚 Loaded practice questions:', {
          total: data.questions?.length || 0,
          summary: data.summary
        })
      } else {
        console.error('❌ Failed to load practice questions:', data.error)
      }
    } catch (error) {
      console.error('❌ Error loading practice questions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim()) return

    const currentQuestion = questions[currentIndex]
    if (!currentQuestion) return

    setSubmitting(true)

    try {
      // Simple answer checking - you can enhance this with NLP later
      const userAnswerNormalized = userAnswer.toLowerCase().trim()
      const correctAnswerNormalized = currentQuestion.correct_answer.toLowerCase().trim()

      // Check if answer is correct (basic keyword matching)
      const isCorrect =
        userAnswerNormalized === correctAnswerNormalized ||
        userAnswerNormalized.includes(correctAnswerNormalized) ||
        correctAnswerNormalized.includes(userAnswerNormalized) ||
        // Additional fuzzy matching for common variations
        (userAnswerNormalized.length > 10 && correctAnswerNormalized.length > 10 &&
         userAnswerNormalized.split(' ').some(word =>
           word.length > 3 && correctAnswerNormalized.includes(word)
         ))

      const timeSpent = Math.round((new Date().getTime() - questionStartTime.getTime()) / 1000)

      // Record the attempt
      const response = await fetch('/api/assessment/theory-practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id,
          question_id: currentQuestion.id,
          topic_id: questions.find(q => q.topic_name === currentQuestion.topic_name)?.id, // We'll need to pass this
          question_asked: currentQuestion.question_template,
          user_answer: userAnswer.trim(),
          correct_answer: currentQuestion.correct_answer,
          is_correct: isCorrect,
          assignment_id: assignmentId,
          time_spent_seconds: timeSpent
        })
      })

      if (response.ok) {
        const result = await response.json()

        // Store result for session summary
        setSessionResults(prev => ({
          ...prev,
          [currentQuestion.id]: isCorrect
        }))

        setShowResult(true)

        console.log(`✅ Answer recorded: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`)
      } else {
        console.error('❌ Failed to record answer')
      }
    } catch (error) {
      console.error('❌ Error submitting answer:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleNextQuestion = () => {
    setShowResult(false)
    setUserAnswer('')
    setQuestionStartTime(new Date())

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      // Session complete
      completeSession()
    }
  }

  const handlePreviousQuestion = () => {
    if (currentIndex > 0) {
      setShowResult(false)
      setUserAnswer('')
      setCurrentIndex(currentIndex - 1)
      setQuestionStartTime(new Date())
    }
  }

  const completeSession = () => {
    const totalTime = Math.round((new Date().getTime() - startTime.getTime()) / 1000 / 60) // minutes
    const correctAnswers = Object.values(sessionResults).filter(Boolean).length
    const accuracy = questions.length > 0 ? Math.round((correctAnswers / questions.length) * 100) : 0

    const results = {
      questions_attempted: questions.length,
      correct_answers: correctAnswers,
      accuracy_percentage: accuracy,
      total_time_minutes: totalTime,
      assignment_id: assignmentId
    }

    setSessionComplete(true)

    if (onSessionComplete) {
      onSessionComplete(results)
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'incorrect': return <RotateCcw className="w-5 h-5 text-orange-600" />
      case 'unanswered': return <Clock className="w-5 h-5 text-blue-600" />
      default: return <Clock className="w-5 h-5 text-gray-400" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('theoryPractice.loadingQuestions')}</p>
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('theoryPractice.allMastered')}</h2>
          <p className="text-gray-600 mb-6">
            {t('theoryPractice.allMasteredDescription')}
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-green-900 mb-2">{t('theoryPractice.yourProgress')}</h3>
            <div className="text-sm text-green-800">
              <p>{t('theoryPractice.totalQuestions', { count: summary?.total_available || 0 })}</p>
              <p>{t('theoryPractice.allCorrect')}</p>
              <p>{t('theoryPractice.readyAdvanced')}</p>
            </div>
          </div>
          <Link
            href="/employee"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            {t('theoryPractice.returnDashboard')}
          </Link>
        </div>
      </div>
    )
  }

  if (sessionComplete) {
    const correctAnswers = Object.values(sessionResults).filter(Boolean).length
    const accuracy = Math.round((correctAnswers / questions.length) * 100)
    const totalTime = Math.round((new Date().getTime() - startTime.getTime()) / 1000 / 60)

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('theoryPractice.sessionComplete')}</h2>
            <p className="text-gray-600 mb-6">
              {t('theoryPractice.sessionCompleteDescription')}
            </p>

            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{questions.length}</div>
                  <div className="text-sm text-gray-600">{t('theoryPractice.questionsPracticed')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{correctAnswers}</div>
                  <div className="text-sm text-gray-600">{t('theoryPractice.correctAnswers')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{accuracy}%</div>
                  <div className="text-sm text-gray-600">{t('theoryPractice.accuracy')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{totalTime}</div>
                  <div className="text-sm text-gray-600">{t('theoryPractice.minutes')}</div>
                </div>
              </div>
            </div>

            {accuracy < 80 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                <p className="text-orange-800">
                  {t('theoryPractice.improvementTip')}
                </p>
              </div>
            )}

            {accuracy >= 80 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <p className="text-green-800">
                  {t('theoryPractice.excellentWork')}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={loadPracticeQuestions}
                className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                {t('theoryPractice.practiceAgain')}
              </button>
              <Link
                href="/employee"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                {t('theoryPractice.returnDashboard')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentIndex]
  const currentResult = sessionResults[currentQuestion.id]
  const progress = Math.round(((currentIndex + (showResult ? 1 : 0)) / questions.length) * 100)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{t('theoryPractice.title')}</h1>
          <p className="text-gray-600">
            {t('theoryPractice.questionProgress', {
              current: currentIndex + 1,
              total: questions.length,
              needsPractice: summary?.needs_practice || 0
            })}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>{t('theoryPractice.progress')}</span>
            <span>{t('theoryPractice.percentComplete', { percent: progress })}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="flex items-center mb-4">
            {getStatusIcon(currentQuestion.status)}
            <div className="ml-3">
              <div className="flex items-center space-x-2">
                <span className="text-lg">
                  {getCategoryIcon(currentQuestion.topic_category)}
                </span>
                <span className="font-medium text-gray-900">
                  {currentQuestion.topic_name}
                </span>
                <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                  {t('theoryPractice.difficultyLevel', { level: currentQuestion.difficulty_level })}
                </span>
              </div>
              {currentQuestion.status === 'incorrect' && (
                <p className="text-sm text-orange-600 mt-1">
                  {t('theoryPractice.tryAgainHint')}
                </p>
              )}
            </div>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            {currentQuestion.question_template}
          </h2>

          <div className="mb-6">
            <textarea
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder={t('theoryPractice.answerPlaceholder')}
              className="w-full p-4 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={4}
              disabled={showResult}
            />
          </div>

          {showResult && (
            <div className={`p-4 rounded-lg mb-6 ${
              sessionResults[currentQuestion.id]
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-start space-x-2">
                {sessionResults[currentQuestion.id] ? (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <h3 className={`font-medium mb-2 ${
                    sessionResults[currentQuestion.id] ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {sessionResults[currentQuestion.id] ? t('theoryPractice.resultCorrect') : t('theoryPractice.resultIncorrect')}
                  </h3>
                  <p className={`text-sm mb-2 ${
                    sessionResults[currentQuestion.id] ? 'text-green-800' : 'text-red-800'
                  }`}>
                    <strong>{t('theoryPractice.correctAnswer')}</strong> {currentQuestion.correct_answer}
                  </p>
                  {!sessionResults[currentQuestion.id] && (
                    <p className="text-red-800 text-sm">
                      <strong>{t('theoryPractice.yourAnswer')}</strong> {userAnswer}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <button
                onClick={handlePreviousQuestion}
                disabled={currentIndex === 0}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('theoryPractice.previousQuestion')}
              </button>

              <Link
                href="/employee"
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
              >
                {t('theoryPractice.exitPractice')}
              </Link>
            </div>

            <div>
              {!showResult ? (
                <button
                  onClick={handleSubmitAnswer}
                  disabled={!userAnswer.trim() || submitting}
                  className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {submitting ? t('theoryPractice.submitting') : t('theoryPractice.submitAnswer')}
                </button>
              ) : (
                <button
                  onClick={handleNextQuestion}
                  className="inline-flex items-center px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  {currentIndex < questions.length - 1 ? t('theoryPractice.nextQuestion') : t('theoryPractice.completeSession')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Session Progress Summary */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{t('theoryPractice.sessionProgress')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {Object.keys(sessionResults).length}
              </div>
              <div className="text-sm text-gray-600">{t('theoryPractice.answered')}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {Object.values(sessionResults).filter(Boolean).length}
              </div>
              <div className="text-sm text-gray-600">{t('theoryPractice.correct')}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {Object.values(sessionResults).filter(result => !result).length}
              </div>
              <div className="text-sm text-gray-600">{t('theoryPractice.incorrect')}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-600">
                {questions.length - Object.keys(sessionResults).length}
              </div>
              <div className="text-sm text-gray-600">{t('theoryPractice.remaining')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}