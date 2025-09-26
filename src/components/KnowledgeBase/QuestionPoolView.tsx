'use client'

import { useState, useEffect } from 'react'
import ManualQuestionInput from './ManualQuestionInput'

interface Question {
  id: string
  question_template: string
  question_type: string
  correct_answer: string
  answer_options?: string[]
  points: number
  explanation: string
  difficulty_level: number
}

interface Topic {
  id: string
  name: string
  description: string
  category: string
  difficulty_level: number
  topic_questions: Question[]
}

interface QuestionPoolViewProps {
  companyId: string
}

export default function QuestionPoolView({ companyId }: QuestionPoolViewProps) {
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set())
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [clearing, setClearing] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null)
  const [editAnswer, setEditAnswer] = useState('')
  const [deletingQuestion, setDeletingQuestion] = useState<string | null>(null)

  useEffect(() => {
    loadTopics()
  }, [companyId])

  const loadTopics = async () => {
    try {
      const response = await fetch(`/api/knowledge-assessment/topics?company_id=${companyId}`)
      const data = await response.json()
      if (data.success) {
        setTopics(data.topics || [])
      }
    } catch (error) {
      console.error('Failed to load topics:', error)
    } finally {
      setLoading(false)
    }
  }

  const clearAllQuestions = async () => {
    if (!confirm('Are you sure you want to clear all AI-generated questions and topics? This action cannot be undone.')) {
      return
    }

    try {
      setClearing(true)
      const response = await fetch('/api/clear-questions', {
        method: 'DELETE'
      })

      if (response.ok) {
        setTopics([])
        alert('All questions and topics have been cleared successfully!')
      } else {
        const error = await response.json()
        alert(`Failed to clear questions: ${error.error}`)
      }
    } catch (error) {
      console.error('Error clearing questions:', error)
      alert('Failed to clear questions. Please try again.')
    } finally {
      setClearing(false)
    }
  }

  const toggleTopic = (topicId: string) => {
    const newExpanded = new Set(expandedTopics)
    if (newExpanded.has(topicId)) {
      newExpanded.delete(topicId)
    } else {
      newExpanded.add(topicId)
    }
    setExpandedTopics(newExpanded)
  }

  const deleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
      return
    }

    try {
      setDeletingQuestion(questionId)
      const response = await fetch(`/api/questions/${questionId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Reload topics to refresh the UI
        await loadTopics()
        alert('Question deleted successfully!')
      } else {
        const error = await response.json()
        alert(`Failed to delete question: ${error.error}`)
      }
    } catch (error) {
      console.error('Error deleting question:', error)
      alert('Failed to delete question. Please try again.')
    } finally {
      setDeletingQuestion(null)
    }
  }

  const startEditAnswer = (questionId: string, currentAnswer: string) => {
    setEditingQuestion(questionId)
    setEditAnswer(currentAnswer)
  }

  const cancelEdit = () => {
    setEditingQuestion(null)
    setEditAnswer('')
  }

  const saveAnswer = async (questionId: string) => {
    if (!editAnswer.trim()) {
      alert('Answer cannot be empty')
      return
    }

    try {
      const response = await fetch(`/api/questions/${questionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ correct_answer: editAnswer.trim() })
      })

      if (response.ok) {
        // Reload topics to refresh the UI
        await loadTopics()
        setEditingQuestion(null)
        setEditAnswer('')
        alert('Answer updated successfully!')
      } else {
        const error = await response.json()
        alert(`Failed to update answer: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating answer:', error)
      alert('Failed to update answer. Please try again.')
    }
  }

  const getQuestionTypeIcon = (type: string) => {
    switch (type) {
      case 'multiple_choice': return '📝'
      case 'true_false': return '✓'
      case 'open_ended': return '💭'
      default: return '❓'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'prices': return 'bg-green-100 text-green-800'
      case 'drinks_info': return 'bg-blue-100 text-blue-800'
      case 'manual': return 'bg-yellow-100 text-yellow-800'
      case 'menu': return 'bg-blue-100 text-blue-800'
      case 'procedures': return 'bg-green-100 text-green-800'
      case 'policies': return 'bg-purple-100 text-purple-800'
      case 'general': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredTopics = selectedCategory === 'all'
    ? topics
    : topics.filter(topic => topic.category === selectedCategory)

  const categories = ['all', ...Array.from(new Set(topics.map(t => t.category)))]
  const totalQuestions = topics.reduce((sum, topic) => sum + (topic.topic_questions?.length || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading question pool...</p>
        </div>
      </div>
    )
  }

  if (topics.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🤖</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Questions Generated Yet</h3>
          <p className="text-gray-600 mb-6">Click "🤖 Generate Questions" to create an AI-powered question pool from your documents.</p>
        </div>

        <ManualQuestionInput onQuestionsAdded={loadTopics} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">AI-Generated Question Pool</h2>
          <div className="flex items-center space-x-4">
            <div className="flex space-x-4 text-sm text-gray-600">
              <span className="bg-blue-50 px-3 py-1 rounded-full">
                📚 {topics.length} Topics
              </span>
              <span className="bg-green-50 px-3 py-1 rounded-full">
                ❓ {totalQuestions} Questions
              </span>
            </div>
            {topics.length > 0 && (
              <button
                onClick={clearAllQuestions}
                disabled={clearing}
                className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors flex items-center space-x-1"
              >
                <span>🗑️</span>
                <span>{clearing ? 'Clearing...' : 'Clear All'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Manual Question Input */}
      <ManualQuestionInput onQuestionsAdded={loadTopics} />

      {/* Topics List */}
      <div className="space-y-4">
        {filteredTopics.map(topic => (
          <div key={topic.id} className="bg-white rounded-lg shadow-sm border">
            <div
              className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => toggleTopic(topic.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="font-medium text-gray-900">{topic.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(topic.category)}`}>
                      {topic.category}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{topic.description}</p>
                  <div className="text-sm text-gray-500">
                    {topic.topic_questions?.length || 0} questions
                  </div>
                </div>
                <div className="text-gray-400">
                  {expandedTopics.has(topic.id) ? '▼' : '▶'}
                </div>
              </div>
            </div>

            {/* Questions */}
            {expandedTopics.has(topic.id) && topic.topic_questions && (
              <div className="border-t bg-gray-50">
                <div className="p-4 space-y-4">
                  {topic.topic_questions.map(question => (
                    <div key={question.id} className="bg-white rounded-lg p-4 border">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 mb-3">{question.question_template}</h4>

                          {editingQuestion === question.id ? (
                            <div className="mb-3">
                              <label className="block text-xs text-gray-500 mb-1">Answer:</label>
                              <textarea
                                value={editAnswer}
                                onChange={(e) => setEditAnswer(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                              />
                              <div className="flex items-center space-x-2 mt-2">
                                <button
                                  onClick={() => saveAnswer(question.id)}
                                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mb-3">
                              <p className="text-xs text-gray-500 mb-1">Answer:</p>
                              <p className="text-sm font-medium text-green-700">{question.correct_answer}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 ml-4">
                          {editingQuestion !== question.id && (
                            <>
                              <button
                                onClick={() => startEditAnswer(question.id, question.correct_answer)}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                                title="Edit answer"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => deleteQuestion(question.id)}
                                disabled={deletingQuestion === question.id}
                                className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                                title="Delete question"
                              >
                                {deletingQuestion === question.id ? '⏳' : '🗑️'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}