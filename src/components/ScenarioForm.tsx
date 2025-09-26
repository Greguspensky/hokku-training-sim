'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { scenarioService, SCENARIO_TEMPLATES, type ScenarioType, type ScenarioTemplate, type Track } from '@/lib/scenarios'
import { type KnowledgeBaseCategory, type KnowledgeBaseDocument } from '@/lib/knowledge-base'

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
  milestones: string[]
  knowledge_category_ids: string[]
  knowledge_document_ids: string[]
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
    milestones: [],
    knowledge_category_ids: [],
    knowledge_document_ids: []
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availableTemplates, setAvailableTemplates] = useState(SCENARIO_TEMPLATES)
  const [newMilestone, setNewMilestone] = useState('')
  const [knowledgeCategories, setKnowledgeCategories] = useState<KnowledgeBaseCategory[]>([])
  const [knowledgeDocuments, setKnowledgeDocuments] = useState<KnowledgeBaseDocument[]>([])
  const [loadingKnowledge, setLoadingKnowledge] = useState(false)

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

  // Load knowledge base data
  useEffect(() => {
    const loadKnowledgeBase = async () => {
      if (!companyId) return

      setLoadingKnowledge(true)
      try {
        const [categoriesResponse, documentsResponse] = await Promise.all([
          fetch(`/api/knowledge-base/categories?company_id=${companyId}`),
          fetch(`/api/knowledge-base/documents?company_id=${companyId}`)
        ])

        const [categoriesData, documentsData] = await Promise.all([
          categoriesResponse.json(),
          documentsResponse.json()
        ])

        if (categoriesData.success) {
          setKnowledgeCategories(categoriesData.categories)
        }
        if (documentsData.success) {
          setKnowledgeDocuments(documentsData.documents)
        }
      } catch (error) {
        console.error('Failed to load knowledge base:', error)
      } finally {
        setLoadingKnowledge(false)
      }
    }

    loadKnowledgeBase()
  }, [companyId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.track_id) {
      setError('Training track is required')
      return
    }

    // Validate required fields for all scenarios
    if (!formData.title.trim() || !formData.description.trim()) {
      setError('Title and description are required')
      return
    }

    // Additional validation for service practice scenarios
    if (formData.scenario_type === 'service_practice') {
      if (!formData.client_behavior.trim() || !formData.expected_response.trim()) {
        setError('Client behavior and expected response are required for service practice scenarios')
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
          knowledge_category_ids: formData.knowledge_category_ids.length > 0 ? formData.knowledge_category_ids : undefined,
          knowledge_document_ids: formData.knowledge_document_ids.length > 0 ? formData.knowledge_document_ids : undefined
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
            </select>
          </div>

          {/* Template selection only for service practice */}
          {formData.scenario_type === 'service_practice' && (
            <div>
              <label htmlFor="template_type" className="block text-sm font-medium text-gray-700 mb-2">
                Template
              </label>
              <select
                id="template_type"
                value={formData.template_type}
                onChange={(e) => handleInputChange('template_type', e.target.value as ScenarioTemplate)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {availableTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Title and Description for all scenario types */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Scenario Title *
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter scenario title"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              id="description"
              rows={3}
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Describe the training scenario and objectives"
              required
            />
          </div>
        </div>

        {formData.scenario_type === 'service_practice' && (
          /* Scenario Content - Only for Service Practice */
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Scenario Content</h3>
            
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700 mb-2">
                  Difficulty Level
                </label>
                <select
                  id="difficulty"
                  value={formData.difficulty}
                  onChange={(e) => handleInputChange('difficulty', e.target.value as 'beginner' | 'intermediate' | 'advanced')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div>
                <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated Duration (minutes)
                </label>
                <input
                  type="number"
                  id="duration"
                  min="5"
                  max="180"
                  value={formData.estimated_duration_minutes}
                  onChange={(e) => handleInputChange('estimated_duration_minutes', parseInt(e.target.value) || 30)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
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

        {formData.scenario_type === 'theory' && (
          /* Theory Settings - Duration and Knowledge Base Selection */
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Theory Settings</h3>

            <div className="max-w-sm">
              <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
                Estimated Duration (minutes)
              </label>
              <input
                type="number"
                id="duration"
                min="5"
                max="180"
                value={formData.estimated_duration_minutes}
                onChange={(e) => handleInputChange('estimated_duration_minutes', parseInt(e.target.value) || 30)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-700">
                <strong>Theory scenarios</strong> are Q&A based and don't require role-playing elements.
                They focus on knowledge testing and theoretical understanding using your knowledge base.
              </p>
            </div>

            {/* Knowledge Base Selection */}
            {loadingKnowledge ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-600 mt-2">Loading knowledge base...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-900">Knowledge Base Selection</h4>
                <p className="text-sm text-gray-600">
                  Select knowledge categories and/or specific documents to generate questions from.
                </p>

                {/* Category Selection */}
                {knowledgeCategories.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Knowledge Categories
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {knowledgeCategories.map((category) => (
                        <label key={category.id} className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.knowledge_category_ids.includes(category.id)}
                            onChange={(e) => {
                              const categoryIds = e.target.checked
                                ? [...formData.knowledge_category_ids, category.id]
                                : formData.knowledge_category_ids.filter(id => id !== category.id)
                              handleInputChange('knowledge_category_ids', categoryIds)
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <div className="ml-3">
                            <span className="text-sm font-medium text-gray-900">{category.name}</span>
                            <p className="text-xs text-gray-500">{category.document_count || 0} documents</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Document Selection */}
                {knowledgeDocuments.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Specific Documents
                    </label>
                    <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                      <div className="grid grid-cols-1 gap-1 p-2">
                        {knowledgeDocuments.map((document) => (
                          <label key={document.id} className="flex items-start p-2 hover:bg-gray-50 cursor-pointer rounded">
                            <input
                              type="checkbox"
                              checked={formData.knowledge_document_ids.includes(document.id)}
                              onChange={(e) => {
                                const documentIds = e.target.checked
                                  ? [...formData.knowledge_document_ids, document.id]
                                  : formData.knowledge_document_ids.filter(id => id !== document.id)
                                handleInputChange('knowledge_document_ids', documentIds)
                              }}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
                            />
                            <div className="ml-3 flex-1">
                              <span className="text-sm font-medium text-gray-900">{document.title}</span>
                              <p className="text-xs text-gray-500">{document.category?.name}</p>
                              <p className="text-xs text-gray-400 truncate">
                                {document.content.substring(0, 80)}...
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {knowledgeCategories.length === 0 && knowledgeDocuments.length === 0 && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-700">
                      No knowledge base content found. Add knowledge base categories and documents first to generate AI-powered questions.
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