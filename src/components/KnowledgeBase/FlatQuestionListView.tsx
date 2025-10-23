'use client'

import { useState, useMemo } from 'react'

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

interface FlatQuestion extends Question {
  topic_name: string
  topic_category: string
}

interface FlatQuestionListViewProps {
  topics: Topic[]
  onDeleteQuestion: (questionId: string) => Promise<void>
  onEditQuestion: (questionId: string, currentQuestion: string, currentAnswer: string) => void
  editingQuestion: string | null
  editQuestionText: string
  setEditQuestionText: (value: string) => void
  editAnswer: string
  setEditAnswer: (value: string) => void
  onSaveQuestion: (questionId: string) => Promise<void>
  onCancelEdit: () => void
  deletingQuestion: string | null
}

export default function FlatQuestionListView({
  topics,
  onDeleteQuestion,
  onEditQuestion,
  editingQuestion,
  editQuestionText,
  setEditQuestionText,
  editAnswer,
  setEditAnswer,
  onSaveQuestion,
  onCancelEdit,
  deletingQuestion
}: FlatQuestionListViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'question' | 'topic' | 'category' | 'difficulty'>('question')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [filterCategory, setFilterCategory] = useState<string>('all')

  // Flatten questions from all topics
  const flatQuestions = useMemo(() => {
    const questions: FlatQuestion[] = []
    topics.forEach(topic => {
      if (topic.topic_questions) {
        topic.topic_questions.forEach(question => {
          questions.push({
            ...question,
            topic_name: topic.name,
            topic_category: topic.category
          })
        })
      }
    })
    return questions
  }, [topics])

  // Filter and search questions
  const filteredQuestions = useMemo(() => {
    let filtered = flatQuestions

    // Category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter(q => q.topic_category === filterCategory)
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(q =>
        q.question_template.toLowerCase().includes(query) ||
        q.correct_answer.toLowerCase().includes(query) ||
        q.topic_name.toLowerCase().includes(query)
      )
    }

    // Sort
    filtered.sort((a, b) => {
      let compareA: string | number
      let compareB: string | number

      switch (sortBy) {
        case 'question':
          compareA = a.question_template.toLowerCase()
          compareB = b.question_template.toLowerCase()
          break
        case 'topic':
          compareA = a.topic_name.toLowerCase()
          compareB = b.topic_name.toLowerCase()
          break
        case 'category':
          compareA = a.topic_category.toLowerCase()
          compareB = b.topic_category.toLowerCase()
          break
        case 'difficulty':
          compareA = a.difficulty_level
          compareB = b.difficulty_level
          break
        default:
          compareA = a.question_template.toLowerCase()
          compareB = b.question_template.toLowerCase()
      }

      if (typeof compareA === 'string' && typeof compareB === 'string') {
        const result = compareA.localeCompare(compareB)
        return sortOrder === 'asc' ? result : -result
      } else {
        const result = (compareA as number) - (compareB as number)
        return sortOrder === 'asc' ? result : -result
      }
    })

    return filtered
  }, [flatQuestions, searchQuery, sortBy, sortOrder, filterCategory])

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(new Set(flatQuestions.map(q => q.topic_category)))
    return ['all', ...uniqueCategories.sort()]
  }, [flatQuestions])

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

  const getDifficultyColor = (level: number) => {
    if (level <= 1) return 'bg-green-100 text-green-800'
    if (level <= 2) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  const getDifficultyLabel = (level: number) => {
    if (level <= 1) return 'Easy'
    if (level <= 2) return 'Medium'
    return 'Hard'
  }

  const handleSort = (field: 'question' | 'topic' | 'category' | 'difficulty') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  if (filteredQuestions.length === 0 && searchQuery.trim()) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No questions found</h3>
          <p className="text-gray-600">Try adjusting your search query or filters.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header with search and filters */}
      <div className="p-4 border-b">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search questions, answers, or topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          <div className="flex items-center space-x-4">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>

            <div className="text-sm text-gray-600">
              {filteredQuestions.length} questions
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('question')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>Question</span>
                  {sortBy === 'question' && (
                    <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Answer
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('topic')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>Topic</span>
                  {sortBy === 'topic' && (
                    <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('category')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>Category</span>
                  {sortBy === 'category' && (
                    <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('difficulty')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>Difficulty</span>
                  {sortBy === 'difficulty' && (
                    <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredQuestions.map(question => (
              <tr key={question.id} className="hover:bg-gray-50">
                <td className="px-4 py-4">
                  <div className="flex items-start space-x-2">
                    <span className="text-sm">{getQuestionTypeIcon(question.question_type)}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 leading-5">
                        {question.question_template}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4" colSpan={editingQuestion === question.id ? 5 : 1}>
                  {editingQuestion === question.id ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Question:</label>
                        <textarea
                          value={editQuestionText}
                          onChange={(e) => setEditQuestionText(e.target.value)}
                          rows={2}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Answer:</label>
                        <textarea
                          value={editAnswer}
                          onChange={(e) => setEditAnswer(e.target.value)}
                          rows={2}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => onSaveQuestion(question.id)}
                          className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs"
                        >
                          Save
                        </button>
                        <button
                          onClick={onCancelEdit}
                          className="bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-green-700 font-medium">
                      {question.correct_answer}
                    </p>
                  )}
                </td>
                {editingQuestion !== question.id && (
                  <>
                    <td className="px-4 py-4">
                      <p className="text-sm text-gray-900">{question.topic_name}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(question.topic_category)}`}>
                        {question.topic_category}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(question.difficulty_level)}`}>
                        {getDifficultyLabel(question.difficulty_level)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => onEditQuestion(question.id, question.question_template, question.correct_answer)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                          title="Edit question"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => onDeleteQuestion(question.id)}
                          disabled={deletingQuestion === question.id}
                          className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                          title="Delete question"
                        >
                          {deletingQuestion === question.id ? '⏳' : '🗑️'}
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredQuestions.length === 0 && !searchQuery.trim() && (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No questions available</h3>
          <p className="text-gray-600">Questions will appear here once generated.</p>
        </div>
      )}
    </div>
  )
}