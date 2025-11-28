'use client'

import { useState, useEffect } from 'react'

interface RecommendationQuestion {
  id: string
  question_text: string
  category: string
  difficulty_level: number
  created_at: string
  updated_at: string
  is_active: boolean
}

interface RecommendationQuestionsListProps {
  companyId: string
  refreshTrigger: number
}

export default function RecommendationQuestionsList({ companyId, refreshTrigger }: RecommendationQuestionsListProps) {
  const [questions, setQuestions] = useState<RecommendationQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [editingQuestion, setEditingQuestion] = useState<RecommendationQuestion | null>(null)
  const [editText, setEditText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [audioPreviewLoading, setAudioPreviewLoading] = useState(false)
  const [currentlyPlayingAudio, setCurrentlyPlayingAudio] = useState<HTMLAudioElement | null>(null)

  const loadQuestions = async () => {
    try {
      const response = await fetch(`/api/questions/recommendation-questions?company_id=${companyId}`)
      const data = await response.json()

      if (data.success) {
        setQuestions(data.questions || [])
      } else {
        console.error('Failed to load recommendation questions:', data.error)
      }
    } catch (error) {
      console.error('Error loading recommendation questions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQuestions()
  }, [companyId, refreshTrigger])

  const handleEdit = (question: RecommendationQuestion) => {
    setEditingQuestion(question)
    setEditText(question.question_text)
  }

  const handlePreviewAudio = async (text: string) => {
    if (!text.trim()) {
      alert('⚠️ Please enter question text to preview')
      return
    }

    // Stop any currently playing audio
    if (currentlyPlayingAudio) {
      currentlyPlayingAudio.pause()
      currentlyPlayingAudio.currentTime = 0
      setCurrentlyPlayingAudio(null)
    }

    setAudioPreviewLoading(true)

    try {
      console.log('🎵 Previewing audio for:', text)

      const response = await fetch('/api/elevenlabs/elevenlabs-tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          language: 'en'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate audio preview')
      }

      // Create audio blob and play
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)

      audio.onended = () => {
        setCurrentlyPlayingAudio(null)
        URL.revokeObjectURL(audioUrl)
      }

      audio.onerror = () => {
        alert('❌ Failed to play audio preview')
        setCurrentlyPlayingAudio(null)
        URL.revokeObjectURL(audioUrl)
      }

      setCurrentlyPlayingAudio(audio)
      await audio.play()

    } catch (error) {
      console.error('Error generating audio preview:', error)
      alert('❌ Failed to generate audio preview. Please try again.')
    } finally {
      setAudioPreviewLoading(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editingQuestion) return

    try {
      const response = await fetch(`/api/questions/recommendation-questions/${editingQuestion.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question_text: editText,
          category: editingQuestion.category,
          difficulty_level: editingQuestion.difficulty_level
        })
      })

      if (response.ok) {
        await loadQuestions()
        setEditingQuestion(null)
        setEditText('')
      } else {
        const data = await response.json()
        alert(`Failed to update question: ${data.error}`)
      }
    } catch (error) {
      console.error('Error updating question:', error)
      alert('Failed to update question. Please try again.')
    }
  }

  const handleDelete = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this recommendation question?')) return

    try {
      const response = await fetch(`/api/questions/recommendation-questions/${questionId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await loadQuestions()
      } else {
        const data = await response.json()
        alert(`Failed to delete question: ${data.error}`)
      }
    } catch (error) {
      console.error('Error deleting question:', error)
      alert('Failed to delete question. Please try again.')
    }
  }

  const handleCancelEdit = () => {
    setEditingQuestion(null)
    setEditText('')
  }

  // Filter questions based on search only
  const filteredQuestions = questions.filter(question => {
    const matchesSearch = question.question_text.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch && question.is_active
  })

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-4"></div>
          <div className="h-20 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Questions List */}
      {filteredQuestions.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className="text-4xl mb-4">💡</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No recommendation questions found</h3>
          <p className="text-gray-600">
            {questions.length === 0
              ? "Start by adding some recommendation questions for training sessions."
              : "Try adjusting your search to find questions."
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map(question => (
            <div key={question.id} className="bg-white rounded-lg shadow border p-6">
              {editingQuestion?.id === question.id ? (
                // Edit Mode
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Question Text</label>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    />
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => handlePreviewAudio(editText)}
                      disabled={audioPreviewLoading || !editText.trim()}
                      className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md font-medium transition-colors"
                    >
                      <span className="text-xl">{currentlyPlayingAudio ? '🔊' : '▶️'}</span>
                      <span>
                        {audioPreviewLoading ? 'Generating...' : currentlyPlayingAudio ? 'Playing...' : 'Preview Audio'}
                      </span>
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    {audioPreviewLoading && (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    )}
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-gray-900 mb-3 leading-relaxed font-mono text-sm">
                      {question.question_text}
                    </p>
                    <div className="text-xs text-gray-500">
                      Created: {new Date(question.created_at).toLocaleDateString()}
                      {question.updated_at !== question.created_at && (
                        <span> • Updated: {new Date(question.updated_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0 flex space-x-2">
                    <button
                      onClick={() => handlePreviewAudio(question.question_text)}
                      disabled={audioPreviewLoading}
                      className="inline-flex items-center px-3 py-2 border border-blue-300 shadow-sm text-sm leading-4 font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <span className="mr-1.5">{currentlyPlayingAudio ? '🔊' : '▶️'}</span>
                      {audioPreviewLoading ? 'Loading...' : currentlyPlayingAudio ? 'Playing...' : 'Preview'}
                    </button>
                    <button
                      onClick={() => handleEdit(question)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(question.id)}
                      className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {questions.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-600">
            Showing {filteredQuestions.length} of {questions.length} total recommendation questions
          </div>
        </div>
      )}
    </div>
  )
}