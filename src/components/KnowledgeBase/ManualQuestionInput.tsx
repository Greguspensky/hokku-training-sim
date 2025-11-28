'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface ManualQuestionInputProps {
  companyId: string
  onQuestionsAdded: () => void
}

export default function ManualQuestionInput({ companyId, onQuestionsAdded }: ManualQuestionInputProps) {
  const t = useTranslations('knowledgeBase')
  const [questions, setQuestions] = useState('')
  const [loading, setLoading] = useState(false)
  const [showInput, setShowInput] = useState(false)
  const [results, setResults] = useState<any>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!questions.trim()) {
      alert('Please enter some questions')
      return
    }

    if (!companyId) {
      alert('Error: Company ID is not available. Please refresh the page and try again.')
      return
    }

    try {
      setLoading(true)
      setResults(null)

      const response = await fetch('/api/add-manual-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questions: questions.trim(),
          companyId: companyId
        })
      })

      const data = await response.json()

      if (response.ok) {
        setResults(data)
        setQuestions('')
        setShowInput(false)
        onQuestionsAdded() // Refresh the questions list

        alert(`Success! Added ${data.questionsSaved} questions to the "Added Manually" category.`)
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error adding manual questions:', error)
      alert('Failed to add questions. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setShowInput(false)
    setQuestions('')
    setResults(null)
  }

  if (!showInput) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-center">
          <div className="text-4xl mb-4">✋</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('addQuestionsManually')}</h3>
          <p className="text-gray-600 mb-6">
            {t('addQuestionsDescription')}
          </p>
          <button
            onClick={() => setShowInput(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium transition-colors"
          >
            ✋ {t('addManualQuestions')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <span className="text-2xl mr-2">✋</span>
          {t('addQuestionsManually')}
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {t('enterQuestionsDescription')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        <div className="mb-4">
          <label htmlFor="questions" className="block text-sm font-medium text-gray-700 mb-2">
            {t('questionsOnePerLine')}
          </label>
          <textarea
            id="questions"
            value={questions}
            onChange={(e) => setQuestions(e.target.value)}
            placeholder={t('questionPlaceholder')}
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-1">
            {t('questionsShouldEndWithMark')}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="submit"
            disabled={loading || !questions.trim()}
            className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-md font-medium transition-colors flex items-center space-x-2"
          >
            <span>🔍</span>
            <span>{loading ? t('findingAnswers') : t('submitAndFindAnswers')}</span>
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            {t('cancel')}
          </button>
        </div>

        {loading && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
              <div>
                <p className="text-blue-800 font-medium">{t('processingQuestions')}</p>
                <p className="text-blue-600 text-sm">{t('aiSearchingKnowledgeBase')}</p>
              </div>
            </div>
          </div>
        )}
      </form>

      {results && (
        <div className="border-t bg-green-50 p-6">
          <div className="flex items-center mb-3">
            <span className="text-2xl mr-2">✅</span>
            <div>
              <h4 className="font-medium text-green-800">{t('questionsAddedSuccessfully')}</h4>
              <p className="text-sm text-green-600">
                {t('processedAndSaved', { processed: results.questionsProcessed, saved: results.questionsSaved })}
              </p>
            </div>
          </div>

          <div className="text-sm text-green-700">
            <p><strong>{t('topic')}</strong> {results.topic.name}</p>
            <p><strong>{t('category')}</strong> {results.topic.category}</p>
          </div>
        </div>
      )}
    </div>
  )
}