'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { scenarioService, SCENARIO_TEMPLATES, type ScenarioType, type ScenarioTemplate, type Track, type Scenario } from '@/lib/scenarios'
import { type KnowledgeBaseCategory, type KnowledgeBaseDocument } from '@/lib/knowledge-base'
import { getEmotionOptions, type CustomerEmotionLevel } from '@/lib/customer-emotions'
import { getVoicesGroupedByLanguage, type ElevenLabsVoiceConfig } from '@/lib/voice-resolver'
import { VoiceSelector } from '@/components/Shared/VoiceSelector'
import { useFormState } from '@/hooks/useFormState'
import { useFetch } from '@/hooks/useFetch'

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
  knowledge_category_ids: string[] // Only used in create mode
  knowledge_document_ids: string[]  // Only used in create mode
  topic_ids: string[]
  recommendation_question_ids: string[]
  recommendation_question_durations: { [questionId: string]: number }
  instructions: string
  customer_emotion_level: CustomerEmotionLevel
  voice_ids: string[] // Multi-select voice support
  first_message: string
  employee_role: string // For Flipboard scenarios
}

interface BaseScenarioFormProps {
  mode: 'create' | 'edit'
  companyId: string
  tracks: Track[]
  scenario?: Scenario  // Required when mode is 'edit'
  onSuccess?: () => void
  onCancel?: () => void
}

export default function BaseScenarioForm({ mode, companyId, tracks, scenario, onSuccess, onCancel }: BaseScenarioFormProps) {
  const router = useRouter()
  const t = useTranslations()

  // Initialize form data based on mode
  const getInitialFormData = (): ScenarioFormData => {
    if (mode === 'edit' && scenario) {
      // Edit mode: populate from scenario
      return {
        track_id: scenario.track_id,
        title: scenario.title,
        description: scenario.description,
        scenario_type: scenario.scenario_type,
        template_type: scenario.template_type,
        client_behavior: scenario.client_behavior,
        expected_response: scenario.expected_response,
        difficulty: scenario.difficulty,
        estimated_duration_minutes: scenario.estimated_duration_minutes,
        session_time_limit_minutes: scenario.session_time_limit_minutes || 10,
        milestones: scenario.milestones || [],
        knowledge_category_ids: [], // Not editable in edit mode
        knowledge_document_ids: [],  // Not editable in edit mode
        topic_ids: scenario.topic_ids || [],
        recommendation_question_ids: scenario.recommendation_question_ids || [],
        recommendation_question_durations: scenario.recommendation_question_durations || {},
        instructions: scenario.instructions || '',
        customer_emotion_level: scenario.customer_emotion_level || 'normal',
        voice_ids: scenario.voice_ids || (scenario.voice_id ? [scenario.voice_id] : ['random']),
        first_message: scenario.first_message || '',
        employee_role: scenario.employee_role || ''
      }
    } else {
      // Create mode: empty defaults
      return {
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
        customer_emotion_level: 'normal',
        voice_ids: ['random'],
        first_message: '',
        employee_role: ''
      }
    }
  }

  // Form state management with useFormState hook
  const {
    formData,
    setFormData,
    updateField,
    isSubmitting,
    setIsSubmitting,
    error,
    setError
  } = useFormState<ScenarioFormData>(getInitialFormData())

  // UI-specific state (not part of form data)
  const [availableTemplates, setAvailableTemplates] = useState(
    mode === 'edit' && scenario
      ? scenarioService.getScenarioTemplates(scenario.scenario_type)
      : SCENARIO_TEMPLATES
  )
  const [newMilestone, setNewMilestone] = useState('')
  const [voicesByLanguage, setVoicesByLanguage] = useState<Record<string, ElevenLabsVoiceConfig[]>>({})

  // Data loading with useFetch hooks
  const { data: knowledgeCategoriesData, loading: loadingCategories } = useFetch<{ success: boolean; categories: KnowledgeBaseCategory[] }>(
    mode === 'create' && companyId ? `/api/knowledge-base/categories?company_id=${companyId}` : null
  )
  const { data: knowledgeDocumentsData, loading: loadingDocuments } = useFetch<{ success: boolean; documents: KnowledgeBaseDocument[] }>(
    mode === 'create' && companyId ? `/api/knowledge-base/documents?company_id=${companyId}` : null
  )
  const { data: knowledgeTopicsData, loading: loadingTopics } = useFetch<{ success: boolean; topics: KnowledgeTopic[] }>(
    companyId ? `/api/knowledge-assessment/topics?company_id=${companyId}` : null
  )
  const { data: recommendationQuestionsData, loading: loadingRecommendations } = useFetch<{ success: boolean; questions: RecommendationQuestion[] }>(
    companyId ? `/api/questions/recommendation-questions?company_id=${companyId}` : null
  )
  const { data: voicesData, loading: loadingVoices } = useFetch<{ success: boolean; voices: ElevenLabsVoiceConfig[] }>(
    '/api/settings/voice-settings'
  )

  // Extract data from fetch results
  const knowledgeCategories = knowledgeCategoriesData?.categories || []
  const knowledgeDocuments = knowledgeDocumentsData?.documents || []
  const knowledgeTopics = knowledgeTopicsData?.topics || []
  const recommendationQuestions = recommendationQuestionsData?.questions || []
  const loadingKnowledge = loadingCategories || loadingDocuments

  // Process voices into grouped format when data loads
  useEffect(() => {
    if (voicesData?.success && voicesData.voices) {
      const grouped: Record<string, ElevenLabsVoiceConfig[]> = {}
      voicesData.voices.forEach((voice: ElevenLabsVoiceConfig) => {
        if (!grouped[voice.language_code]) {
          grouped[voice.language_code] = []
        }
        grouped[voice.language_code].push(voice)
      })
      setVoicesByLanguage(grouped)
      console.log(`✅ Loaded ${voicesData.voices.length} voices from API`)
    }
  }, [voicesData])

  // Clean up stale recommendation question IDs when questions load
  useEffect(() => {
    if (recommendationQuestions.length > 0 && formData.recommendation_question_ids.length > 0) {
      const validQuestionIds = new Set(recommendationQuestions.map(q => q.id))
      const cleanedQuestionIds = formData.recommendation_question_ids.filter(id => validQuestionIds.has(id))

      // If some question IDs were removed (stale/deleted questions)
      if (cleanedQuestionIds.length !== formData.recommendation_question_ids.length) {
        const removedCount = formData.recommendation_question_ids.length - cleanedQuestionIds.length
        console.warn(`⚠️ Found ${removedCount} deleted/stale question IDs in this scenario`)
        console.log(`🧹 Auto-cleaning: ${formData.recommendation_question_ids.length} → ${cleanedQuestionIds.length} questions`)
        console.log(`   ⚠️ IMPORTANT: Click "Update Scenario" to save these changes!`)

        // Also clean up durations for removed questions
        const cleanedDurations: Record<string, number> = {}
        Object.keys(formData.recommendation_question_durations).forEach(id => {
          if (validQuestionIds.has(id)) {
            cleanedDurations[id] = formData.recommendation_question_durations[id]
          }
        })

        setFormData(prev => ({
          ...prev,
          recommendation_question_ids: cleanedQuestionIds,
          recommendation_question_durations: cleanedDurations
        }))
      }
    }
  }, [recommendationQuestions, formData.recommendation_question_ids, formData.recommendation_question_durations, setFormData])

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

  // Voice selection helper
  const toggleVoiceSelection = (voiceId: string) => {
    setFormData(prev => {
      const currentVoices = prev.voice_ids || []

      if (currentVoices.includes(voiceId)) {
        // Remove voice if already selected
        const updated = currentVoices.filter(id => id !== voiceId)
        // If no voices selected, default to 'random'
        return { ...prev, voice_ids: updated.length > 0 ? updated : ['random'] }
      } else {
        // Add voice (remove 'random' if it's the only selection)
        const filtered = currentVoices.filter(id => id !== 'random')
        return { ...prev, voice_ids: [...filtered, voiceId] }
      }
    })
  }

  // Drag and drop handlers for milestone reordering
  const [draggedMilestoneIndex, setDraggedMilestoneIndex] = useState<number | null>(null)

  const handleDragStart = (index: number) => {
    setDraggedMilestoneIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (draggedMilestoneIndex === null || draggedMilestoneIndex === dropIndex) return

    setFormData(prev => {
      const newMilestones = [...prev.milestones]
      const draggedItem = newMilestones[draggedMilestoneIndex]
      newMilestones.splice(draggedMilestoneIndex, 1)
      newMilestones.splice(dropIndex, 0, draggedItem)
      return { ...prev, milestones: newMilestones }
    })
    setDraggedMilestoneIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedMilestoneIndex(null)
  }

  // Custom handleInputChange with template logic (wraps updateField from hook)
  const handleInputChange = (field: keyof ScenarioFormData, value: any) => {
    updateField(field, value)

    // Update available templates when scenario type changes
    if (field === 'scenario_type') {
      const filteredTemplates = scenarioService.getScenarioTemplates(value as ScenarioType)
      setAvailableTemplates(filteredTemplates)
      // Reset template if current one isn't available for new type
      if (!filteredTemplates.some(t => t.id === formData.template_type)) {
        updateField('template_type', filteredTemplates[0]?.id || 'general_flow')
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

  // Initialize form with first track if available (create mode only)
  useEffect(() => {
    if (mode === 'create' && tracks.length > 0 && !formData.track_id) {
      setFormData(prev => ({ ...prev, track_id: tracks[0].id }))
    }
  }, [mode, tracks, formData.track_id, setFormData])

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

    // For flipboard scenarios, validate name
    if (formData.scenario_type === 'flipboard') {
      if (!formData.title.trim()) {
        setError('Name is required for flipboard scenarios')
        return
      }
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Determine API endpoint and method based on mode
      const url = mode === 'create'
        ? '/api/scenarios'
        : `/api/scenarios/${scenario!.id}`

      const method = mode === 'create' ? 'POST' : 'PATCH'

      // Prepare request body - exclude knowledge fields in edit mode
      const requestBody: any = {
        company_id: companyId,
        ...formData,
        voice_ids: formData.voice_ids.length > 0 ? formData.voice_ids : ['random'],
        topic_ids: formData.topic_ids.length > 0 ? formData.topic_ids : undefined,
        recommendation_question_ids: formData.recommendation_question_ids.length > 0 ? formData.recommendation_question_ids : undefined,
        recommendation_question_durations: formData.recommendation_question_ids.length > 0 ? formData.recommendation_question_durations : undefined,
        instructions: formData.instructions.trim() || undefined
      }

      // Only include knowledge fields in create mode
      if (mode === 'create') {
        requestBody.knowledge_category_ids = formData.knowledge_category_ids.length > 0 ? formData.knowledge_category_ids : undefined
        requestBody.knowledge_document_ids = formData.knowledge_document_ids.length > 0 ? formData.knowledge_document_ids : undefined
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || `Failed to ${mode} scenario`)
      }

      onSuccess?.()
      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : `Failed to ${mode} scenario`)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (tracks.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-600">
            {t('manager.tracks.createTrackFirst')}
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
          <h3 className="text-lg font-medium text-gray-900">
            {mode === 'create' ? t('scenario.createScenario') : t('scenario.editScenario')}
          </h3>

          <div>
            <label htmlFor="track_id" className="block text-sm font-medium text-gray-700 mb-2">
              {t('scenario.trainingTrack')} *
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
            {mode === 'edit' && (
              <p className="text-sm text-yellow-600 mt-1">
                ⚠️ Warning: Changing the track will move this scenario to a different training program.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="scenario_type" className="block text-sm font-medium text-gray-700 mb-2">
              {t('scenario.type')}
            </label>
            <select
              id="scenario_type"
              value={formData.scenario_type}
              onChange={(e) => handleInputChange('scenario_type', e.target.value as ScenarioType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={mode === 'edit'} // Disable in edit mode
            >
              <option value="theory">{t('scenario.theory')}</option>
              <option value="service_practice">{t('scenario.serviceRolePlay')}</option>
              <option value="recommendations">{t('scenario.recommendations')}</option>
              <option value="flipboard">{t('manager.scenarios.flipboard.title')}</option>
            </select>
            {mode === 'edit' && (
              <p className="text-sm text-gray-500 mt-1">
                Scenario type cannot be changed after creation.
              </p>
            )}
          </div>


          {/* Name field - for Theory Q&A, Recommendations, and Flipboard */}
          {(formData.scenario_type === 'theory' || formData.scenario_type === 'recommendations' || formData.scenario_type === 'flipboard') && (
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                {t('scenario.title')} *
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('scenario.titlePlaceholder')}
                required
              />
            </div>
          )}

          {/* Situation field - only for Service Practice */}
          {formData.scenario_type === 'service_practice' && (
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                {t('scenario.situation')} *
              </label>
              <textarea
                id="title"
                rows={4}
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('scenario.situationPlaceholder')}
                required
              />
            </div>
          )}

          {/* Employee Role field - only for Flipboard */}
          {formData.scenario_type === 'flipboard' && (
            <div>
              <label htmlFor="employee_role" className="block text-sm font-medium text-gray-700 mb-2">
                {t('manager.scenarios.flipboard.employeeRole')}
              </label>
              <input
                type="text"
                id="employee_role"
                value={formData.employee_role || ''}
                onChange={(e) => handleInputChange('employee_role', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('manager.scenarios.flipboard.employeeRoleDescription')}
              />
              <p className="mt-1 text-sm text-gray-500">
                {t('manager.scenarios.flipboard.employeeRoleDescription')}
              </p>
            </div>
          )}

        </div>

        {formData.scenario_type === 'flipboard' && (
          /* Flipboard Configuration */
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">{t('scenario.scenarioContent')}</h3>

            {/* Session Time Limit */}
            <div>
              <label htmlFor="session_time_limit_flipboard" className="block text-sm font-medium text-gray-700 mb-2">
                {t('scenario.sessionTimeLimit')}
              </label>
              <input
                type="number"
                id="session_time_limit_flipboard"
                min="1"
                max="60"
                value={formData.session_time_limit_minutes}
                onChange={(e) => handleInputChange('session_time_limit_minutes', parseInt(e.target.value) || 10)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="10"
              />
              <p className="text-sm text-gray-500 mt-1">
                {t('scenario.sessionTimeLimitNote')}
              </p>
            </div>

            {/* First Message - Optional custom opening */}
            <div>
              <label htmlFor="first_message_flipboard" className="block text-sm font-medium text-gray-700 mb-2">
                {t('scenario.firstMessage')}
              </label>
              <textarea
                id="first_message_flipboard"
                rows={3}
                value={formData.first_message}
                onChange={(e) => handleInputChange('first_message', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('scenario.firstMessagePlaceholder')}
              />
              <p className="text-sm text-gray-500 mt-1">
                {t('scenario.firstMessageNote')}
              </p>
            </div>

            {/* Voice Selection - Multi-select by Language */}
            <VoiceSelector
              voicesByLanguage={voicesByLanguage}
              selectedVoiceIds={formData.voice_ids}
              onVoiceToggle={toggleVoiceSelection}
              onRandomToggle={(checked) => {
                if (checked) {
                  setFormData(prev => ({ ...prev, voice_ids: ['random'] }))
                } else {
                  setFormData(prev => ({ ...prev, voice_ids: [] }))
                }
              }}
            />
          </div>
        )}

        {formData.scenario_type === 'service_practice' && (
          /* Scenario Content - Only for Service Practice */
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">{t('scenario.scenarioContent')}</h3>

            {/* Session Time Limit */}
            <div>
              <label htmlFor="session_time_limit" className="block text-sm font-medium text-gray-700 mb-2">
                {t('scenario.sessionTimeLimit')}
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
                {t('scenario.sessionTimeLimitNote')}
              </p>
            </div>

            {/* First Message - Optional custom opening */}
            <div>
              <label htmlFor="first_message" className="block text-sm font-medium text-gray-700 mb-2">
                {t('scenario.firstMessage')}
              </label>
              <textarea
                id="first_message"
                rows={3}
                value={formData.first_message}
                onChange={(e) => handleInputChange('first_message', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('scenario.firstMessagePlaceholder')}
              />
              <p className="text-sm text-gray-500 mt-1">
                {t('scenario.firstMessageNote')}
              </p>
            </div>

            <div>
              <label htmlFor="client_behavior" className="block text-sm font-medium text-gray-700 mb-2">
                {t('scenario.clientBehavior')} *
              </label>
              <textarea
                id="client_behavior"
                rows={3}
                value={formData.client_behavior}
                onChange={(e) => handleInputChange('client_behavior', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('scenario.clientBehaviorPlaceholder')}
                required
              />
            </div>

            <div>
              <label htmlFor="expected_response" className="block text-sm font-medium text-gray-700 mb-2">
                {t('scenario.expectedResponse')} *
              </label>
              <textarea
                id="expected_response"
                rows={3}
                value={formData.expected_response}
                onChange={(e) => handleInputChange('expected_response', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('scenario.expectedResponsePlaceholder')}
                required
              />
            </div>

            {/* Customer Emotion Level - Service Practice specific */}
            <div>
              <label htmlFor="customer_emotion_level" className="block text-sm font-medium text-gray-700 mb-2">
                {t('scenario.customerEmotion')} *
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

            {/* Voice Selection - Multi-select by Language */}
            <VoiceSelector
              voicesByLanguage={voicesByLanguage}
              selectedVoiceIds={formData.voice_ids}
              onVoiceToggle={toggleVoiceSelection}
              onRandomToggle={(checked) => {
                if (checked) {
                  setFormData(prev => ({ ...prev, voice_ids: ['random'] }))
                } else {
                  setFormData(prev => ({ ...prev, voice_ids: [] }))
                }
              }}
              loading={loadingVoices}
              showRandomOption={true}
            />

            {/* Milestones Section - Only for Service Practice */}
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900">{t('scenario.milestones')}</h4>
              <p className="text-sm text-gray-600">
                {t('scenario.milestonesNote')}
              </p>

              {/* Add new milestone */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMilestone}
                  onChange={(e) => setNewMilestone(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t('scenario.milestonePlaceholder')}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addMilestone())}
                />
                <button
                  type="button"
                  onClick={addMilestone}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  {t('scenario.addMilestone')}
                </button>
              </div>

              {/* Milestones list */}
              {formData.milestones.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">{t('scenario.currentMilestones')}</p>
                  {formData.milestones.map((milestone, index) => (
                    <div
                      key={index}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md cursor-move transition-all ${
                        draggedMilestoneIndex === index ? 'opacity-50 scale-95' : 'hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                        </svg>
                        <span className="text-sm text-gray-700">{milestone}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMilestone(index)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        {t('scenario.remove')}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {formData.milestones.length === 0 && (
                <p className="text-sm text-gray-500 italic">{t('scenario.noMilestones')}</p>
              )}
            </div>
          </div>
        )}

        {formData.scenario_type === 'recommendations' && (
          /* Recommendations Settings - Question Selection */
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">{t('scenario.recommendations')}</h3>

            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-700">
                {t('manager.recommendations.scenarioDescription')}
              </p>
            </div>

            {/* Voice Selection - Multi-select by Language */}
            <VoiceSelector
              voicesByLanguage={voicesByLanguage}
              selectedVoiceIds={formData.voice_ids}
              onVoiceToggle={toggleVoiceSelection}
              onRandomToggle={(checked) => {
                if (checked) {
                  setFormData(prev => ({ ...prev, voice_ids: ['random'] }))
                } else {
                  setFormData(prev => ({ ...prev, voice_ids: [] }))
                }
              }}
              loading={loadingVoices}
              showRandomOption={true}
            />

            {/* Question Selection */}
            {loadingRecommendations ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-600 mt-2">{t('common.loading')}...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-900">{t('scenario.selectQuestions')} *</h4>
                <p className="text-sm text-gray-600">
                  {t('scenario.questionsNote')}
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
                              <label className="text-sm font-medium text-gray-700">{t('employee.training.duration')}:</label>
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
                              <span className="text-sm text-gray-500">{t('employee.training.seconds')}</span>
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-700">
                      {t('knowledgeBase.noDocumentsDescription')}
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
            <h3 className="text-lg font-medium text-gray-900">{t('scenario.theory')}</h3>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-700">
                {t('employee.training.theoryDescription')}
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

            {/* Voice Selection - Multi-select by Language */}
            <VoiceSelector
              voicesByLanguage={voicesByLanguage}
              selectedVoiceIds={formData.voice_ids}
              onVoiceToggle={toggleVoiceSelection}
              onRandomToggle={(checked) => {
                if (checked) {
                  setFormData(prev => ({ ...prev, voice_ids: ['random'] }))
                } else {
                  setFormData(prev => ({ ...prev, voice_ids: [] }))
                }
              }}
              loading={loadingVoices}
              showRandomOption={true}
            />

            {/* Topic Selection */}
            {loadingTopics ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-600 mt-2">{t('common.loading')}...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-900">{t('scenario.selectTopics')} *</h4>
                <p className="text-sm text-gray-600">
                  {t('scenario.topicsNote')}
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
                      {t('manager.tracks.noTopicsAssigned')}
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
              {t('scenario.cancel')}
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
                <span>{t('common.saving')}...</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mode === 'create' ? "M12 4v16m8-8H4" : "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"} />
                </svg>
                <span>{mode === 'create' ? t('scenario.createScenarioButton') : t('scenario.updateScenarioButton')}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
