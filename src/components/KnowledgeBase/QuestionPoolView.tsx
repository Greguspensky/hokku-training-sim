'use client'

import { useState, useEffect } from 'react'
import ManualQuestionInput from './ManualQuestionInput'
import FlatQuestionListView from './FlatQuestionListView'

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
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped')
  const [editingTopic, setEditingTopic] = useState<string | null>(null)
  const [editTopicName, setEditTopicName] = useState('')

  // New state for topic creation
  const [showCreateTopic, setShowCreateTopic] = useState(false)
  const [newTopicName, setNewTopicName] = useState('')
  const [newTopicDescription, setNewTopicDescription] = useState('')
  const [newTopicCategory, setNewTopicCategory] = useState('manual')
  const [creatingTopic, setCreatingTopic] = useState(false)

  // New state for question selection and moving
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const [targetTopicId, setTargetTopicId] = useState('')
  const [movingQuestions, setMovingQuestions] = useState(false)

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

  const startEditTopic = (topicId: string, currentName: string) => {
    setEditingTopic(topicId)
    setEditTopicName(currentName)
  }

  const cancelEditTopic = () => {
    setEditingTopic(null)
    setEditTopicName('')
  }

  const saveTopicName = async (topicId: string) => {
    if (!editTopicName.trim()) {
      alert('Topic name cannot be empty')
      return
    }

    try {
      const response = await fetch(`/api/knowledge-assessment/topics/${topicId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: editTopicName.trim() })
      })

      if (response.ok) {
        // Reload topics to refresh the UI
        await loadTopics()
        setEditingTopic(null)
        setEditTopicName('')
        alert('Topic name updated successfully!')
      } else {
        const error = await response.json()
        alert(`Failed to update topic name: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating topic name:', error)
      alert('Failed to update topic name. Please try again.')
    }
  }

  const createTopic = async () => {
    if (!newTopicName.trim()) {
      alert('Topic name is required')
      return
    }

    try {
      setCreatingTopic(true)
      const response = await fetch('/api/knowledge-assessment/topics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newTopicName.trim(),
          description: newTopicDescription.trim(),
          category: newTopicCategory,
          company_id: companyId
        })
      })

      if (response.ok) {
        await loadTopics()
        setShowCreateTopic(false)
        setNewTopicName('')
        setNewTopicDescription('')
        setNewTopicCategory('manual')
        alert('Topic created successfully!')
      } else {
        const error = await response.json()
        alert(`Failed to create topic: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating topic:', error)
      alert('Failed to create topic. Please try again.')
    } finally {
      setCreatingTopic(false)
    }
  }

  const toggleQuestionSelection = (questionId: string) => {
    const newSelected = new Set(selectedQuestions)
    if (newSelected.has(questionId)) {
      newSelected.delete(questionId)
    } else {
      newSelected.add(questionId)
    }
    setSelectedQuestions(newSelected)
  }

  const selectAllQuestionsInTopic = (topicId: string) => {
    const topic = topics.find(t => t.id === topicId)
    if (!topic || !topic.topic_questions) return

    const newSelected = new Set(selectedQuestions)
    topic.topic_questions.forEach(q => newSelected.add(q.id))
    setSelectedQuestions(newSelected)
  }

  const deselectAllQuestions = () => {
    setSelectedQuestions(new Set())
  }

  const moveSelectedQuestions = async () => {
    if (selectedQuestions.size === 0) {
      alert('No questions selected')
      return
    }

    if (!targetTopicId) {
      alert('Please select a target topic')
      return
    }

    try {
      setMovingQuestions(true)

      // Move each selected question
      const movePromises = Array.from(selectedQuestions).map(questionId =>
        fetch(`/api/questions/${questionId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ topic_id: targetTopicId })
        })
      )

      const results = await Promise.all(movePromises)
      const failedMoves = results.filter(r => !r.ok)

      if (failedMoves.length === 0) {
        alert(`Successfully moved ${selectedQuestions.size} question(s)!`)
        await loadTopics()
        setSelectedQuestions(new Set())
        setShowMoveDialog(false)
        setTargetTopicId('')
      } else {
        alert(`Failed to move ${failedMoves.length} question(s). Please try again.`)
      }
    } catch (error) {
      console.error('Error moving questions:', error)
      alert('Failed to move questions. Please try again.')
    } finally {
      setMovingQuestions(false)
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

        <ManualQuestionInput companyId={companyId} onQuestionsAdded={loadTopics} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">AI-Generated Question Pool</h2>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
            {/* View Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grouped')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'grouped'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>📁</span>
                <span>Grouped by Topic</span>
              </button>
              <button
                onClick={() => setViewMode('flat')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'flat'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>📄</span>
                <span>Flat List</span>
              </button>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex space-x-4 text-sm text-gray-600">
                <span className="bg-blue-50 px-3 py-1 rounded-full">
                  📚 {topics.length} Topics
                </span>
                <span className="bg-green-50 px-3 py-1 rounded-full">
                  ❓ {totalQuestions} Questions
                </span>
                {selectedQuestions.size > 0 && (
                  <span className="bg-purple-50 px-3 py-1 rounded-full">
                    ✅ {selectedQuestions.size} Selected
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowCreateTopic(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors flex items-center space-x-1"
                >
                  <span>➕</span>
                  <span>Create Topic</span>
                </button>
                {selectedQuestions.size > 0 && (
                  <>
                    <button
                      onClick={() => setShowMoveDialog(true)}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors flex items-center space-x-1"
                    >
                      <span>📦</span>
                      <span>Move Selected</span>
                    </button>
                    <button
                      onClick={deselectAllQuestions}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors"
                    >
                      Clear Selection
                    </button>
                  </>
                )}
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
          </div>
        </div>

        {/* Category Filter - only show for grouped view */}
        {viewMode === 'grouped' && (
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
        )}
      </div>

      {/* Manual Question Input */}
      <ManualQuestionInput companyId={companyId} onQuestionsAdded={loadTopics} />

      {/* Conditional View Rendering */}
      {viewMode === 'flat' ? (
        <FlatQuestionListView
          topics={topics}
          onDeleteQuestion={deleteQuestion}
          onEditAnswer={startEditAnswer}
          editingQuestion={editingQuestion}
          editAnswer={editAnswer}
          setEditAnswer={setEditAnswer}
          onSaveAnswer={saveAnswer}
          onCancelEdit={cancelEdit}
          deletingQuestion={deletingQuestion}
        />
      ) : (
        /* Topics List */
        <div className="space-y-4">
          {filteredTopics.map(topic => (
            <div key={topic.id} className="bg-white rounded-lg shadow-sm border">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div
                    className="flex-1 cursor-pointer hover:bg-gray-50 transition-colors -m-4 p-4"
                    onClick={() => editingTopic !== topic.id && toggleTopic(topic.id)}
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      {editingTopic === topic.id ? (
                        <div className="flex-1">
                          <input
                            type="text"
                            value={editTopicName}
                            onChange={(e) => setEditTopicName(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-base font-medium"
                            placeholder="Topic name"
                          />
                          <div className="flex items-center space-x-2 mt-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                saveTopicName(topic.id)
                              }}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs"
                            >
                              Save
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                cancelEditTopic()
                              }}
                              className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <h3 className="font-medium text-gray-900">{topic.name}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(topic.category)}`}>
                            {topic.category}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              startEditTopic(topic.id, topic.name)
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm ml-2"
                            title="Edit topic name"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              selectAllQuestionsInTopic(topic.id)
                            }}
                            className="text-purple-600 hover:text-purple-800 text-sm ml-2"
                            title="Select all questions in this topic"
                          >
                            ☑️ Select All
                          </button>
                        </>
                      )}
                    </div>
                    {editingTopic !== topic.id && (
                      <>
                        <p className="text-sm text-gray-600 mb-2">{topic.description}</p>
                        <div className="text-sm text-gray-500">
                          {topic.topic_questions?.length || 0} questions
                        </div>
                      </>
                    )}
                  </div>
                  {editingTopic !== topic.id && (
                    <div className="text-gray-400">
                      {expandedTopics.has(topic.id) ? '▼' : '▶'}
                    </div>
                  )}
                </div>
              </div>

              {/* Questions */}
              {expandedTopics.has(topic.id) && topic.topic_questions && (
                <div className="border-t bg-gray-50">
                  <div className="p-4 space-y-4">
                    {topic.topic_questions.map(question => (
                      <div key={question.id} className="bg-white rounded-lg p-4 border">
                        <div className="flex items-start space-x-3">
                          <input
                            type="checkbox"
                            checked={selectedQuestions.has(question.id)}
                            onChange={() => toggleQuestionSelection(question.id)}
                            className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded cursor-pointer"
                          />
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

                            <div className="flex items-center space-x-2">
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
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Topic Modal */}
      {showCreateTopic && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Topic</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Topic Name *
                </label>
                <input
                  type="text"
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  placeholder="e.g., Coffee Brewing Techniques"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newTopicDescription}
                  onChange={(e) => setNewTopicDescription(e.target.value)}
                  placeholder="Brief description of this topic..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={newTopicCategory}
                  onChange={(e) => setNewTopicCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="manual">Manual</option>
                  <option value="menu">Menu</option>
                  <option value="procedures">Procedures</option>
                  <option value="policies">Policies</option>
                  <option value="general">General</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateTopic(false)
                  setNewTopicName('')
                  setNewTopicDescription('')
                  setNewTopicCategory('manual')
                }}
                disabled={creatingTopic}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={createTopic}
                disabled={creatingTopic || !newTopicName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingTopic ? 'Creating...' : 'Create Topic'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Questions Modal */}
      {showMoveDialog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Move {selectedQuestions.size} Question{selectedQuestions.size !== 1 ? 's' : ''}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Target Topic *
                </label>
                <select
                  value={targetTopicId}
                  onChange={(e) => setTargetTopicId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  autoFocus
                >
                  <option value="">-- Select a topic --</option>
                  {topics.map(topic => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name} ({topic.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-md p-3">
                <p className="text-sm text-purple-800">
                  <strong>{selectedQuestions.size}</strong> question{selectedQuestions.size !== 1 ? 's' : ''} will be moved to the selected topic.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowMoveDialog(false)
                  setTargetTopicId('')
                }}
                disabled={movingQuestions}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={moveSelectedQuestions}
                disabled={movingQuestions || !targetTopicId}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {movingQuestions ? 'Moving...' : 'Move Questions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}