'use client'

import { useState, useEffect } from 'react'
import { KnowledgeBaseDocument, KnowledgeBaseCategory } from '@/lib/knowledge-base'

interface DocumentSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onGenerate: (selectedDocuments: KnowledgeBaseDocument[], questionCount: number) => void
  companyId: string
  isGenerating?: boolean
}

export default function DocumentSelectionModal({
  isOpen,
  onClose,
  onGenerate,
  companyId,
  isGenerating = false
}: DocumentSelectionModalProps) {
  const [categories, setCategories] = useState<KnowledgeBaseCategory[]>([])
  const [allDocuments, setAllDocuments] = useState<KnowledgeBaseDocument[]>([])
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [questionCount, setQuestionCount] = useState<number>(8)

  useEffect(() => {
    if (isOpen) {
      loadData()
      setSelectedDocuments(new Set())
      setSearchQuery('')
      setSelectedCategory('all')
    }
  }, [isOpen, companyId])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load categories
      const categoriesResponse = await fetch(`/api/knowledge-base/categories?company_id=${companyId}`)
      const categoriesData = await categoriesResponse.json()
      if (categoriesData.success) {
        setCategories(categoriesData.categories || [])
      }

      // Load all documents
      const documentsResponse = await fetch(`/api/knowledge-base/documents?company_id=${companyId}`)
      const documentsData = await documentsResponse.json()
      if (documentsData.success) {
        setAllDocuments(documentsData.documents || [])
      }
    } catch (error) {
      console.error('Failed to load documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredDocuments = allDocuments.filter(doc => {
    // Category filter
    if (selectedCategory !== 'all' && doc.category_id !== selectedCategory) {
      return false
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      return doc.title.toLowerCase().includes(query) ||
             doc.content.toLowerCase().includes(query)
    }

    return true
  })

  const toggleDocument = (documentId: string) => {
    const newSelected = new Set(selectedDocuments)
    if (newSelected.has(documentId)) {
      newSelected.delete(documentId)
    } else {
      newSelected.add(documentId)
    }
    setSelectedDocuments(newSelected)
  }

  const toggleAll = () => {
    if (selectedDocuments.size === filteredDocuments.length) {
      setSelectedDocuments(new Set())
    } else {
      setSelectedDocuments(new Set(filteredDocuments.map(doc => doc.id)))
    }
  }

  const handleGenerate = () => {
    const documentsToGenerate = allDocuments.filter(doc =>
      selectedDocuments.has(doc.id)
    )
    onGenerate(documentsToGenerate, questionCount)
  }

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId)
    return category ? category.name : 'Uncategorized'
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Select Documents for Question Generation
          </h2>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="text-gray-400 hover:text-gray-600 text-2xl disabled:opacity-50"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading documents...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Search and Filter Controls */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4 mb-6">
                <div className="flex-1 max-w-md">
                  <input
                    type="text"
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center space-x-4">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Categories</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={toggleAll}
                    className="text-sm text-blue-600 hover:text-blue-800 whitespace-nowrap"
                  >
                    {selectedDocuments.size === filteredDocuments.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>

              {/* Question Count Input */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <label htmlFor="questionCount" className="text-sm font-medium text-purple-900">
                    Questions per document:
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      id="questionCount"
                      type="number"
                      min="3"
                      max="20"
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Math.max(3, Math.min(20, parseInt(e.target.value) || 8)))}
                      className="w-20 px-3 py-2 border border-purple-300 rounded-md focus:ring-purple-500 focus:border-purple-500 text-center font-medium"
                    />
                    <span className="text-xs text-purple-600">
                      Total: <span className="font-semibold">{selectedDocuments.size * questionCount}</span> questions
                    </span>
                  </div>
                </div>
              </div>

              {/* Selection Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-blue-800">
                    <span className="font-medium">{selectedDocuments.size}</span> of {filteredDocuments.length} documents selected
                  </div>
                  <div className="text-xs text-blue-600">
                    AI will analyze selected documents to generate relevant questions
                  </div>
                </div>
              </div>

              {/* Documents List */}
              <div className="flex-1 overflow-y-auto border rounded-lg">
                {filteredDocuments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {searchQuery ? 'No documents match your search.' : 'No documents found.'}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {filteredDocuments.map(document => (
                      <label
                        key={document.id}
                        className="flex items-start p-4 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDocuments.has(document.id)}
                          onChange={() => toggleDocument(document.id)}
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="ml-3 flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-gray-900">
                              {document.title}
                            </h4>
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                              {getCategoryName(document.category_id)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {document.content.substring(0, 150)}
                            {document.content.length > 150 && '...'}
                          </p>
                          <div className="flex items-center mt-2 text-xs text-gray-500">
                            <span>{document.content.length} characters</span>
                            <span className="mx-2">•</span>
                            <span>Last updated {new Date(document.updated_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            {selectedDocuments.size > 0 && (
              <span>Selected documents will be analyzed by AI to generate training questions</span>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={selectedDocuments.size === 0 || isGenerating}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Generating Questions...</span>
                </>
              ) : (
                <>
                  <span>🤖</span>
                  <span>Generate Questions ({selectedDocuments.size})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}