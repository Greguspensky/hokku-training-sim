'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Track } from '@/lib/scenarios'

interface TrackFormData {
  name: string
  description: string
  target_audience: 'new_hire' | 'existing_employee'
}

interface TrackFormProps {
  companyId: string
  track?: Track // Optional track for editing
  onSuccess?: () => void
  onCancel?: () => void
}

export default function TrackForm({ companyId, track, onSuccess, onCancel }: TrackFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState<TrackFormData>({
    name: track?.name || '',
    description: track?.description || '',
    target_audience: (track?.target_audience as 'new_hire' | 'existing_employee') || 'new_hire'
  })
  const isEditing = !!track

  useEffect(() => {
    if (track) {
      setFormData({
        name: track.name,
        description: track.description,
        target_audience: track.target_audience as 'new_hire' | 'existing_employee'
      })
    }
  }, [track])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleInputChange = (field: keyof TrackFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !formData.description.trim()) {
      setError('Name and description are required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const url = isEditing ? `/api/tracks/${track.id}` : '/api/tracks'
      const method = isEditing ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          ...formData
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || `Failed to ${isEditing ? 'update' : 'create'} track`)
      }

      onSuccess?.()
      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : `Failed to ${isEditing ? 'update' : 'create'} track`)
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

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">{isEditing ? 'Edit' : 'Create'} Training Track</h3>
          
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Track Name *
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., New Hire Customer Service Training"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              id="description"
              rows={4}
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Describe the training track objectives and what employees will learn"
              required
            />
          </div>

          <div>
            <label htmlFor="target_audience" className="block text-sm font-medium text-gray-700 mb-2">
              Target Audience
            </label>
            <select
              id="target_audience"
              value={formData.target_audience}
              onChange={(e) => handleInputChange('target_audience', e.target.value as 'new_hire' | 'existing_employee')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="new_hire">New Hire</option>
              <option value="existing_employee">Existing Employee</option>
            </select>
          </div>
        </div>

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
                <span>{isEditing ? 'Updating...' : 'Creating...'}</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isEditing ? "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" : "M12 4v16m8-8H4"} />
                </svg>
                <span>{isEditing ? 'Update Track' : 'Create Track'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}