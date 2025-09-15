'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { scenarioService, SCENARIO_TEMPLATES, type ScenarioType, type ScenarioTemplate, type Track, type Scenario } from '@/lib/scenarios'

interface EditScenarioFormData {
  track_id: string
  title: string
  description: string
  scenario_type: ScenarioType
  template_type: ScenarioTemplate
  client_behavior: string
  expected_response: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimated_duration_minutes: number
}

interface EditScenarioFormProps {
  scenario: Scenario
  companyId: string
  tracks: Track[]
  onSuccess?: () => void
  onCancel?: () => void
}

export default function EditScenarioForm({ scenario, companyId, tracks, onSuccess, onCancel }: EditScenarioFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState<EditScenarioFormData>({
    track_id: scenario.track_id,
    title: scenario.title,
    description: scenario.description,
    scenario_type: scenario.scenario_type,
    template_type: scenario.template_type,
    client_behavior: scenario.client_behavior,
    expected_response: scenario.expected_response,
    difficulty: scenario.difficulty,
    estimated_duration_minutes: scenario.estimated_duration_minutes
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availableTemplates, setAvailableTemplates] = useState(
    scenarioService.getScenarioTemplates(scenario.scenario_type)
  )

  const handleInputChange = (field: keyof EditScenarioFormData, value: any) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.track_id) {
      setError('Training track is required')
      return
    }

    if (formData.scenario_type === 'service_practice') {
      if (!formData.title.trim() || !formData.description.trim() || !formData.client_behavior.trim() || !formData.expected_response.trim()) {
        setError('Title, description, client behavior, and expected response are required for service practice scenarios')
        return
      }
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/scenarios/${scenario.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          ...formData
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to update scenario')
      }

      onSuccess?.()
      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update scenario')
    } finally {
      setIsSubmitting(false)
    }
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
          <h3 className="text-lg font-medium text-gray-900">Edit Scenario</h3>
          
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

          {formData.scenario_type === 'service_practice' && (
            <>
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
            </>
          )}
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
          </div>
        )}

        {formData.scenario_type === 'theory' && (
          /* Theory Settings - Only Duration */
          <div className="space-y-4">
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
                They focus on knowledge testing and theoretical understanding.
              </p>
            </div>
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
                <span>Updating...</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Update Scenario</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}