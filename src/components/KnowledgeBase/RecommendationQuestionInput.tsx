'use client'

import { useState } from 'react'
import { AudioTagsReference } from '@/components/AudioTagsReference'

interface RecommendationQuestionInputProps {
  companyId: string
  onQuestionsAdded: () => void
}

export default function RecommendationQuestionInput({ companyId, onQuestionsAdded }: RecommendationQuestionInputProps) {
  const [questions, setQuestions] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!questions.trim()) {
      setMessage('Please enter some questions')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/recommendation-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questions: questions.trim(),
          category: 'General',
          difficulty_level: 1,
          company_id: companyId
        })
      })

      const data = await response.json()

      if (data.success) {
        setMessage(`✅ Successfully added ${data.questionsSaved} recommendation questions!`)
        setQuestions('')
        onQuestionsAdded()
      } else {
        setMessage(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error adding recommendation questions:', error)
      setMessage('❌ Failed to add recommendation questions. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center space-x-2 mb-4">
        <span className="text-2xl">💡</span>
        <h2 className="text-xl font-semibold text-gray-900">Add Questions Manually</h2>
      </div>

      <p className="text-gray-600 mb-6">
        Enter your questions (one per line). AI will search your knowledge base documents to find answers.
      </p>

      {/* Audio Tags Reference for Emotional TTS Control */}
      <AudioTagsReference className="mb-6" defaultExpanded={true} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="questions" className="block text-sm font-medium text-gray-700 mb-2">
            Questions (one per line)
          </label>
          <textarea
            id="questions"
            value={questions}
            onChange={(e) => setQuestions(e.target.value)}
            rows={8}
            placeholder="Enter your questions here, one per line. Use audio tags for emotion control!

Examples:
[excited] Have you tried our seasonal special?
[curious] What flavors do you enjoy? [pause]
[professional] I'd recommend our signature blend."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            required
          />
        </div>

        <p className="text-sm text-gray-500">
          💡 <strong>Tip:</strong> Click audio tags above to copy them, then paste into your questions to control TTS emotion and delivery.
          Questions work best when specific to your knowledge base documents.
        </p>

        <div className="flex items-center space-x-3">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            <span className="text-xl">🔍</span>
            <span>{loading ? 'Adding Questions...' : 'Submit & Find Answers'}</span>
          </button>

          <button
            type="button"
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            Cancel
          </button>

          {loading && (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          )}
        </div>

        {message && (
          <div className={`p-3 rounded-md ${message.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message}
          </div>
        )}
      </form>
    </div>
  )
}