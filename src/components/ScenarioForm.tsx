'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { scenarioService, SCENARIO_TEMPLATES, type ScenarioType, type ScenarioTemplate, type Track } from '@/lib/scenarios'
import { type KnowledgeBaseCategory, type KnowledgeBaseDocument } from '@/lib/knowledge-base'
import { getEmotionOptions, type CustomerEmotionLevel } from '@/lib/customer-emotions'
import { ELEVENLABS_VOICES, RANDOM_VOICE_OPTION } from '@/lib/elevenlabs-voices'

interface KnowledgeTopic {
  id: string
  name: string
  description: string
  category: string
  difficulty_level: number
  topic_questions: {
    id: string
    question_template: string
    question_type: string
    correct_answer: string
    explanation: string
  }[]
}

interface RecommendationQuestion {
  id: string
  question_text: string
  category: string
  difficulty_level: number
  created_at: string
  updated_at: string
  is_active: boolean
}

interface ScenarioFormData {
  track_id: string
  title: string
  description: string
  scenario_type: ScenarioType
  template_type: ScenarioTemplate
  client_behavior: string
  expected_response: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimated_duration_minutes: number
  session_time_limit_minutes: number
  milestones: string[]
  knowledge_category_ids: string[]
  knowledge_document_ids: string[]
  topic_ids: string[]
  recommendation_question_ids: string[]
  recommendation_question_durations: { [questionId: string]: number }
  instructions: string
  customer_emotion_level: CustomerEmotionLevel
  voice_id: string
  use_random_voice: boolean
}

interface ScenarioFormProps {
  companyId: string
  tracks: Track[]
  onSuccess?: () => void
  onCancel?: () => void
}

export default function ScenarioForm({ companyId, tracks, onSuccess, onCancel }: ScenarioFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState<ScenarioFormData>({
    track_id: tracks[0]?.id || '',
    title: '',
    description: '',
    scenario_type: 'service_practice',
    template_type: 'general_flow',
    client_behavior: '',
    expected_response: '',
    difficulty: 'beginner',
    estimated_duration_minutes: 30,
    session_time_limit_minutes: 10,
    milestones: [],
    knowledge_category_ids: [],
    knowledge_document_ids: [],
    topic_ids: [],
    recommendation_question_ids: [],
    recommendation_question_durations: {},
    instructions: '',
    customer_emotion_level: 'calm',
    voice_id: RANDOM_VOICE_OPTION,
    use_random_voice: true
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availableTemplates, setAvailableTemplates] = useState(SCENARIO_TEMPLATES)
  const [newMilestone, setNewMilestone] = useState('')
  const [knowledgeCategories, setKnowledgeCategories] = useState<KnowledgeBaseCategory[]>([])
  const [knowledgeDocuments, setKnowledgeDocuments] = useState<KnowledgeBaseDocument[]>([])
  const [loadingKnowledge, setLoadingKnowledge] = useState(false)
  const [knowledgeTopics, setKnowledgeTopics] = useState<KnowledgeTopic[]>([])
  const [loadingTopics, setLoadingTopics] = useState(false)
  const [recommendationQuestions, setRecommendationQuestions] = useState<RecommendationQuestion[]>([])
  const [loadingRecommendations, setLoadingRecommendations] = useState(false)

  const addMilestone = () => {
    if (newMilestone.trim() && !formData.milestones.includes(newMilestone.trim())) {
      setFormData(prev => ({
        ...prev,
        milestones: [...prev.milestones, newMilestone.trim()]
      }))
      setNewMilestone('')
    }
  }

  const removeMilestone = (index: number) => {
    setFormData(prev => ({
      ...prev,
      milestones: prev.milestones.filter((_, i) => i !== index)
    }))
  }

  const handleInputChange = (field: keyof ScenarioFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null)
    
    // Update available templates when scenario type changes
    if (field === 'scenario_type') {
      const filteredTemplates = scenarioService.getScenarioTemplates(value as ScenarioType)
      setAvailableTemplates(filteredTemplates)
      // Reset template if current one isn't available for new type
      if (!filteredTemplates.some(t => t.id === formData.template_type)) {
        setFormData(prev => ({ ...prev, template_type: filteredTemplates[0]?.id || 'general_flow' }))
      }
    }
    
    // Auto-fill template defaults when template changes
    if (field === 'template_type') {
      const template = scenarioService.getScenarioTemplate(value as ScenarioTemplate)
      if (template) {
        setFormData(prev => ({
          ...prev,
          title: template.name,
          description: template.description,
          client_behavior: template.defaultClientBehavior,
          expected_response: template.defaultExpectedResponse
        }))
      }
    }
  }

  // Initialize form with first track if available
  useEffect(() => {
    if (tracks.length > 0 && !formData.track_id) {
      setFormData(prev => ({ ...prev, track_id: tracks[0].id }))
    }
  }, [tracks, formData.track_id])

  // Load knowledge base data and topics
  useEffect(() => {
    const loadData = async () => {
      if (!companyId) return

      setLoadingKnowledge(true)
      setLoadingTopics(true)
      setLoadingRecommendations(true)
      try {
        const [categoriesResponse, documentsResponse, topicsResponse, recommendationsResponse] = await Promise.all([
          fetch(`/api/knowledge-base/categories?company_id=${companyId}`),
          fetch(`/api/knowledge-base/documents?company_id=${companyId}`),
          fetch(`/api/knowledge-assessment/topics?company_id=${companyId}`),
          fetch(`/api/recommendation-questions?company_id=${companyId}`)
        ])

        const [categoriesData, documentsData, topicsData, recommendationsData] = await Promise.all([
          categoriesResponse.json(),
          documentsResponse.json(),
          topicsResponse.json(),
          recommendationsResponse.json()
        ])

        if (categoriesData.success) {
          setKnowledgeCategories(categoriesData.categories)
        }
        if (documentsData.success) {
          setKnowledgeDocuments(documentsData.documents)
        }
        if (topicsData.success) {
          setKnowledgeTopics(topicsData.topics)
        }
        if (recommendationsData.success) {
          setRecommendationQuestions(recommendationsData.questions)
        }
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setLoadingKnowledge(false)
        setLoadingTopics(false)
        setLoadingRecommendations(false)
      }
    }

    loadData()
  }, [companyId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.track_id) {
      setError('Training track is required')
      return
    }

    // Validate required fields based on scenario type
    if (formData.scenario_type === 'service_practice') {
      if (!formData.title.trim()) {
        setError('Situation is required for service practice scenarios')
        return
      }
      if (!formData.client_behavior.trim() || !formData.expected_response.trim()) {
        setError('Client behavior and expected response are required for service practice scenarios')
        return
      }
    }

    // For theory scenarios, validate name and topic selection
    if (formData.scenario_type === 'theory') {
      if (!formData.title.trim()) {
        setError('Name is required for theory scenarios')
        return
      }
      if (formData.topic_ids.length === 0) {
        setError('At least one topic must be selected for theory scenarios')
        return
      }
    }

    // For recommendations scenarios, validate name and question selection
    if (formData.scenario_type === 'recommendations') {
      if (!formData.title.trim()) {
        setError('Name is required for recommendations scenarios')
        return
      }
      if (formData.recommendation_question_ids.length === 0) {
        setError('At least one recommendation question must be selected for recommendations scenarios')
        return
      }
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          ...formData,
          voice_id: formData.use_random_voice ? RANDOM_VOICE_OPTION : formData.voice_id,
          knowledge_category_ids: formData.knowledge_category_ids.length > 0 ? formData.knowledge_category_ids : undefined,
          knowledge_document_ids: formData.knowledge_document_ids.length > 0 ? formData.knowledge_document_ids : undefined,
          topic_ids: formData.topic_ids.length > 0 ? formData.topic_ids : undefined,
          recommendation_question_ids: formData.recommendation_question_ids.length > 0 ? formData.recommendation_question_ids : undefined,
          recommendation_question_durations: formData.recommendation_question_ids.length > 0 ? formData.recommendation_question_durations : undefined,
          instructions: formData.instructions.trim() || undefined
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to create scenario')
      }

      onSuccess?.()
      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create scenario')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (tracks.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-600">
            You need to create a training track first before adding scenarios.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Create Scenario</h3>
          
          <div>
            <label htmlFor="track_id" className="block text-sm font-medium text-gray-700 mb-2">
              Training Track *
            </label>
            <select
              id="track_id"
              value={formData.track_id}
              onChange={(e) => handleInputChange('track_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              {tracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.name} ({track.target_audience.replace('_', ' ')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="scenario_type" className="block text-sm font-medium text-gray-700 mb-2">
              Scenario Type
            </label>
            <select
              id="scenario_type"
              value={formData.scenario_type}
              onChange={(e) => handleInputChange('scenario_type', e.target.value as ScenarioType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="theory">Theory (Q&A)</option>
              <option value="service_practice">Service Practice (Role-play)</option>
              <option value="recommendations">Recommendations</option>
            </select>
          </div>


          {/* Name field - for Theory Q&A and Recommendations */}
          {(formData.scenario_type === 'theory' || formData.scenario_type === 'recommendations') && (
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Name *
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter a name for this theory scenario"
                required
              />
            </div>
          )}

          {/* Situation field - only for Service Practice */}
          {formData.scenario_type === 'service_practice' && (
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Situation *
              </label>
              <textarea
                id="title"
                rows={4}
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe the situation the employee will face"
                required
              />
            </div>
          )}

        </div>

        {formData.scenario_type === 'service_practice' && (
          /* Scenario Content - Only for Service Practice */
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Scenario Content</h3>

            {/* Session Time Limit */}
            <div>
              <label htmlFor="session_time_limit" className="block text-sm font-medium text-gray-700 mb-2">
                Session Time Limit (minutes)
              </label>
              <input
                type="number"
                id="session_time_limit"
                min="1"
                max="60"
                value={formData.session_time_limit_minutes}
                onChange={(e) => handleInputChange('session_time_limit_minutes', parseInt(e.target.value) || 10)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="10"
              />
              <p className="text-sm text-gray-500 mt-1">
                Maximum duration for this role-play session (1-60 minutes)
              </p>
            </div>

            <div>
              <label htmlFor="client_behavior" className="block text-sm font-medium text-gray-700 mb-2">
                Client Behavior *
              </label>
              <textarea
                id="client_behavior"
                rows={3}
                value={formData.client_behavior}
                onChange={(e) => handleInputChange('client_behavior', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe how the client/customer will behave in this scenario"
                required
              />
            </div>

            <div>
              <label htmlFor="expected_response" className="block text-sm font-medium text-gray-700 mb-2">
                Expected Employee Response *
              </label>
              <textarea
                id="expected_response"
                rows={3}
                value={formData.expected_response}
                onChange={(e) => handleInputChange('expected_response', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe the ideal way an employee should respond"
                required
              />
            </div>

            {/* Customer Emotion Level - Service Practice specific */}
            <div>
              <label htmlFor="customer_emotion_level" className="block text-sm font-medium text-gray-700 mb-2">
                Customer Emotion Level *
              </label>
              <select
                id="customer_emotion_level"
                value={formData.customer_emotion_level}
                onChange={(e) => handleInputChange('customer_emotion_level', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {getEmotionOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.icon} {option.label}
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-500 mt-1">
                {getEmotionOptions().find(o => o.value === formData.customer_emotion_level)?.description}
              </p>
            </div>

            {/* Voice Selection */}
            <div className="space-y-3">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.use_random_voice}
                  onChange={(e) => {
                    const useRandom = e.target.checked;
                    setFormData(prev => ({
                      ...prev,
                      use_random_voice: useRandom,
                      voice_id: useRandom ? RANDOM_VOICE_OPTION : (ELEVENLABS_VOICES[0]?.id || RANDOM_VOICE_OPTION)
                    }))
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Use a Random Voice</span>
              </label>
              <p className="text-sm text-gray-500">
                {formData.use_random_voice
                  ? 'A random voice will be selected each time this scenario is played'
                  : 'Select a specific voice for this scenario'}
              </p>

              {!formData.use_random_voice && (
                <div>
                  <label htmlFor="voice_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Select Voice
                  </label>
                  <select
                    id="voice_id"
                    value={formData.voice_id}
                    onChange={(e) => handleInputChange('voice_id', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {ELEVENLABS_VOICES.map(voice => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Milestones Section - Only for Service Practice */}
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900">Milestones</h4>
              <p className="text-sm text-gray-600">
                Add specific objectives that employees can achieve for bonus points during role-play.
              </p>
              
              {/* Add new milestone */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMilestone}
                  onChange={(e) => setNewMilestone(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Ask for Google review"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addMilestone())}
                />
                <button
                  type="button"
                  onClick={addMilestone}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Add
                </button>
              </div>
              
              {/* Milestones list */}
              {formData.milestones.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Current Milestones:</p>
                  {formData.milestones.map((milestone, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md">
                      <span className="text-sm text-gray-700">• {milestone}</span>
                      <button
                        type="button"
                        onClick={() => removeMilestone(index)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {formData.milestones.length === 0 && (
                <p className="text-sm text-gray-500 italic">No milestones added yet.</p>
              )}
            </div>
          </div>
        )}

        {formData.scenario_type === 'recommendations' && (
          /* Recommendations Settings - Question Selection */
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Recommendations Settings</h3>

            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-700">
                <strong>Recommendations scenarios</strong> are video response training where TTS asks questions and
                employees respond through voice and video. Select questions from your recommendation question pool.
              </p>
            </div>

            {/* Voice Selection */}
            <div className="space-y-3">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.use_random_voice}
                  onChange={(e) => {
                    const useRandom = e.target.checked;
                    setFormData(prev => ({
                      ...prev,
                      use_random_voice: useRandom,
                      voice_id: useRandom ? RANDOM_VOICE_OPTION : (ELEVENLABS_VOICES[0]?.id || RANDOM_VOICE_OPTION)
                    }))
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Use a Random Voice</span>
              </label>
              <p className="text-sm text-gray-500">
                {formData.use_random_voice
                  ? 'A random voice will be selected each time this scenario is played'
                  : 'Select a specific voice for this scenario'}
              </p>

              {!formData.use_random_voice && (
                <div>
                  <label htmlFor="voice_id_recommendations" className="block text-sm font-medium text-gray-700 mb-2">
                    Select Voice
                  </label>
                  <select
                    id="voice_id_recommendations"
                    value={formData.voice_id}
                    onChange={(e) => handleInputChange('voice_id', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {ELEVENLABS_VOICES.map(voice => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Question Selection */}
            {loadingRecommendations ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-600 mt-2">Loading recommendation questions...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-900">Question Selection *</h4>
                <p className="text-sm text-gray-600">
                  Select one or more questions from your recommendation questions pool. The agent will ask these questions during the session.
                </p>

                {recommendationQuestions.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {recommendationQuestions.map((question) => (
                      <label key={question.id} className="flex items-start p-4 border-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.recommendation_question_ids.includes(question.id)}
                          onChange={(e) => {
                            const questionIds = e.target.checked
                              ? [...formData.recommendation_question_ids, question.id]
                              : formData.recommendation_question_ids.filter(id => id !== question.id)
                            handleInputChange('recommendation_question_ids', questionIds)

                            // Add or remove duration for this question
                            const newDurations = { ...formData.recommendation_question_durations }
                            if (e.target.checked) {
                              newDurations[question.id] = 30 // Default 30 seconds
                            } else {
                              delete newDurations[question.id]
                            }
                            handleInputChange('recommendation_question_durations', newDurations)
                          }}
                          className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded mt-0.5"
                        />
                        <div className="ml-4 flex-1">
                          <p className="text-gray-900 leading-relaxed">{question.question_text}</p>

                          {/* Duration field - only show if question is selected */}
                          {formData.recommendation_question_ids.includes(question.id) && (
                            <div className="mt-3 flex items-center space-x-2">
                              <label className="text-sm font-medium text-gray-700">Duration:</label>
                              <input
                                type="number"
                                value={formData.recommendation_question_durations[question.id] || 30}
                                onChange={(e) => {
                                  const newDurations = {
                                    ...formData.recommendation_question_durations,
                                    [question.id]: Math.max(1, parseInt(e.target.value) || 30)
                                  }
                                  handleInputChange('recommendation_question_durations', newDurations)
                                }}
                                min="1"
                                max="300"
                                className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                              />
                              <span className="text-sm text-gray-500">seconds</span>
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-700">
                      No recommendation questions found. Create recommendation questions first in the Knowledge Base section to use them in recommendation scenarios.
                    </p>
                  </div>
                )}

                {/* Show selection summary */}
                {formData.recommendation_question_ids.length > 0 && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-700">
                      <strong>{formData.recommendation_question_ids.length} question{formData.recommendation_question_ids.length === 1 ? '' : 's'} selected</strong> for the recommendation session.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Instructions Field */}
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900">Manager Instructions</h4>
              <p className="text-sm text-gray-600">
                Optional instructions for the manager about this recommendation scenario. This field is not mandatory.
              </p>
              <textarea
                id="instructions"
                rows={4}
                value={formData.instructions}
                onChange={(e) => handleInputChange('instructions', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                placeholder="Enter any special instructions or notes for managers about this recommendation scenario..."
              />
            </div>
          </div>
        )}

        {formData.scenario_type === 'theory' && (
          /* Theory Settings - Topic Selection */
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Theory Settings</h3>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-700">
                <strong>Theory scenarios</strong> are Q&A based and don't require role-playing elements.
                They focus on knowledge testing using questions from selected topics in your question pool.
              </p>
            </div>

            {/* Session Time Limit */}
            <div>
              <label htmlFor="session_time_limit" className="block text-sm font-medium text-gray-700 mb-2">
                Session Time Limit (minutes)
              </label>
              <input
                type="number"
                id="session_time_limit"
                min="1"
                max="60"
                value={formData.session_time_limit_minutes}
                onChange={(e) => handleInputChange('session_time_limit_minutes', parseInt(e.target.value) || 10)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="10"
              />
              <p className="text-sm text-gray-500 mt-1">
                Maximum duration for this theory session (1-60 minutes)
              </p>
            </div>

            {/* Voice Selection */}
            <div className="space-y-3">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.use_random_voice}
                  onChange={(e) => {
                    const useRandom = e.target.checked;
                    setFormData(prev => ({
                      ...prev,
                      use_random_voice: useRandom,
                      voice_id: useRandom ? RANDOM_VOICE_OPTION : (ELEVENLABS_VOICES[0]?.id || RANDOM_VOICE_OPTION)
                    }))
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Use a Random Voice</span>
              </label>
              <p className="text-sm text-gray-500">
                {formData.use_random_voice
                  ? 'A random voice will be selected each time this scenario is played'
                  : 'Select a specific voice for this scenario'}
              </p>

              {!formData.use_random_voice && (
                <div>
                  <label htmlFor="voice_id_theory" className="block text-sm font-medium text-gray-700 mb-2">
                    Select Voice
                  </label>
                  <select
                    id="voice_id_theory"
                    value={formData.voice_id}
                    onChange={(e) => handleInputChange('voice_id', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {ELEVENLABS_VOICES.map(voice => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Topic Selection */}
            {loadingTopics ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-600 mt-2">Loading topics...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-900">Topic Selection *</h4>
                <p className="text-sm text-gray-600">
                  Select one or more topics from your question pool. All questions from selected topics will be available during the session.
                </p>

                {knowledgeTopics.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {knowledgeTopics.map((topic) => (
                      <label key={topic.id} className="flex items-start p-4 border-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.topic_ids.includes(topic.id)}
                          onChange={(e) => {
                            const topicIds = e.target.checked
                              ? [...formData.topic_ids, topic.id]
                              : formData.topic_ids.filter(id => id !== topic.id)
                            handleInputChange('topic_ids', topicIds)
                          }}
                          className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
                        />
                        <div className="ml-4 flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-lg font-medium text-gray-900">{topic.name}</span>
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                topic.category === 'menu' ? 'bg-green-100 text-green-800' :
                                topic.category === 'procedures' ? 'bg-blue-100 text-blue-800' :
                                topic.category === 'policies' ? 'bg-purple-100 text-purple-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {topic.category}
                              </span>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                Level {topic.difficulty_level}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{topic.description}</p>
                          <div className="flex items-center text-sm text-gray-500">
                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {topic.topic_questions?.length || 0} questions available
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-700">
                      No topics found in your question pool. Create topics with questions first to use them in theory scenarios.
                    </p>
                  </div>
                )}

                {/* Show selection summary */}
                {formData.topic_ids.length > 0 && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-700">
                      <strong>{formData.topic_ids.length} topic{formData.topic_ids.length === 1 ? '' : 's'} selected</strong> with a total of{' '}
                      <strong>
                        {knowledgeTopics
                          .filter(topic => formData.topic_ids.includes(topic.id))
                          .reduce((sum, topic) => sum + (topic.topic_questions?.length || 0), 0)}
                      </strong>{' '}
                      questions available for the session.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}


        {/* Form Actions */}
        <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
          )}
          
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Creating...</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Create Scenario</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}