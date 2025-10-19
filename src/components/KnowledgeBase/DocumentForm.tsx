'use client'

import { useState } from 'react'
import { KnowledgeBaseDocument, KnowledgeBaseCategory } from '@/lib/knowledge-base'

interface DocumentFormProps {
  document?: KnowledgeBaseDocument | null
  companyId: string
  categories: KnowledgeBaseCategory[]
  selectedCategoryId?: string
  onSuccess?: () => void
  onCancel?: () => void
}

export default function DocumentForm({ document, companyId, categories, selectedCategoryId, onSuccess, onCancel }: DocumentFormProps) {
  const [formData, setFormData] = useState({
    title: document?.title || '',
    content: document?.content || '',
    category_id: document?.category_id || selectedCategoryId || (categories[0]?.id || ''),
    file_type: document?.file_type || 'text' as const,
    item_type: document?.item_type || 'info' as const
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim() || !formData.content.trim() || !formData.category_id) {
      setError('Title, content, and category are required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const url = document 
        ? `/api/knowledge-base/documents/${document.id}`
        : '/api/knowledge-base/documents'
      
      const method = document ? 'PATCH' : 'POST'
      
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
        throw new Error(data.error || `Failed to ${document ? 'update' : 'create'} document`)
      }

      onSuccess?.()
    } catch (error) {
      setError(error instanceof Error ? error.message : `Failed to ${document ? 'update' : 'create'} document`)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (categories.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-600">
            You need to create at least one category before adding documents.
          </p>
          <div className="mt-3">
            <button
              onClick={onCancel}
              className="text-sm font-medium text-yellow-800 underline hover:text-yellow-900"
            >
              Go back
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Document Title *
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Employee Handbook 2024"
              required
            />
          </div>

          <div>
            <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 mb-2">
              Category *
            </label>
            <select
              id="category_id"
              value={formData.category_id}
              onChange={(e) => handleInputChange('category_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="file_type" className="block text-sm font-medium text-gray-700 mb-2">
              Document Type
            </label>
            <select
              id="file_type"
              value={formData.file_type}
              onChange={(e) => handleInputChange('file_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="text">Text Document</option>
              <option value="pdf">PDF</option>
              <option value="doc">Word Document</option>
              <option value="docx">Word Document (DOCX)</option>
              <option value="txt">Plain Text</option>
            </select>
          </div>

          <div>
            <label htmlFor="item_type" className="block text-sm font-medium text-gray-700 mb-2">
              Item Type *
            </label>
            <select
              id="item_type"
              value={formData.item_type}
              onChange={(e) => handleInputChange('item_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="menu_item">Menu Item (orderable product)</option>
              <option value="add_on">Add-on (modifier/extra)</option>
              <option value="sop">SOP (standard procedure)</option>
              <option value="info">Info (general information)</option>
            </select>
            <div className="mt-1 text-xs text-gray-500">
              Classifies how this knowledge is used in training
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
            Document Content *
          </label>
          <div className="mb-2 text-sm text-gray-600">
            Copy and paste your document content here. This will be used to help generate more accurate training scenarios.
          </div>
          <textarea
            id="content"
            rows={15}
            value={formData.content}
            onChange={(e) => handleInputChange('content', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="Paste your document content here... 

For example:
- Standard operating procedures
- Pricing information  
- Company policies
- Menu items
- Training materials
- etc."
            required
          />
          <div className="mt-1 text-xs text-gray-500">
            {formData.content.length} characters
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <svg className="h-5 w-5 text-blue-400 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="text-sm text-blue-700">
              <strong>Tip:</strong> The more detailed and accurate your documents are, the better the system can create realistic training scenarios that reflect your company's actual procedures and policies.
            </div>
          </div>
        </div>

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
                <span>{document ? 'Updating...' : 'Creating...'}</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={document ? "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" : "M12 4v16m8-8H4"} />
                </svg>
                <span>{document ? 'Update Document' : 'Add Document'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}