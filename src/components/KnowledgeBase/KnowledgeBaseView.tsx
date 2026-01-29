'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { KnowledgeBaseCategory, KnowledgeBaseDocument } from '@/lib/knowledge-base'
import CategoryFolder from './CategoryFolder'
import DocumentForm from './DocumentForm'
import CategoryForm from './CategoryForm'
import DocumentViewer from './DocumentViewer'
import QuestionPoolView from './QuestionPoolView'
import DocumentSelectionModal from './DocumentSelectionModal'
import RecommendationQuestionsView from './RecommendationQuestionsView'
import UserHeader from '@/components/Shared/UserHeader'

interface KnowledgeBaseViewProps {
  companyId: string
}

export default function KnowledgeBaseView({ companyId }: KnowledgeBaseViewProps) {
  const router = useRouter()
  const t = useTranslations()
  const [categories, setCategories] = useState<KnowledgeBaseCategory[]>([])
  const [documents, setDocuments] = useState<KnowledgeBaseDocument[]>([])
  const [selectedCategory, setSelectedCategory] = useState<KnowledgeBaseCategory | null>(null)
  const [selectedDocument, setSelectedDocument] = useState<KnowledgeBaseDocument | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showDocumentForm, setShowDocumentForm] = useState(false)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [showDocumentViewer, setShowDocumentViewer] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingCategory, setEditingCategory] = useState<KnowledgeBaseCategory | null>(null)
  const [editingDocument, setEditingDocument] = useState<KnowledgeBaseDocument | null>(null)
  const [generatingQuestions, setGeneratingQuestions] = useState(false)
  const [currentView, setCurrentView] = useState<'documents' | 'questions' | 'recommendations'>('documents')
  const [showDocumentSelection, setShowDocumentSelection] = useState(false)

  // Deduplication ref to prevent reload on tab switch
  const hasLoadedRef = useRef(false)

  const loadCategories = async () => {
    try {
      const response = await fetch(`/api/knowledge-base/categories?company_id=${companyId}`)
      const data = await response.json()
      if (data.success) {
        setCategories(data.categories || [])
      }
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  const loadDocuments = async (categoryId?: string) => {
    try {
      let url = `/api/knowledge-base/documents?company_id=${companyId}`
      if (categoryId) {
        url += `&category_id=${categoryId}`
      }
      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`
      }
      
      const response = await fetch(url)
      const data = await response.json()
      if (data.success) {
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error('Failed to load documents:', error)
      setDocuments([])
    }
  }

  useEffect(() => {
    console.log('🔄 KnowledgeBase useEffect - companyId:', companyId)

    if (!companyId) {
      console.log('⏸️ Waiting for companyId...')
      return
    }

    // Prevent duplicate loads when tab becomes visible again
    if (hasLoadedRef.current === companyId) {
      console.log('⏭️ Knowledge base already loaded - skipping duplicate fetch')
      return
    }

    hasLoadedRef.current = companyId

    const init = async () => {
      await loadCategories()
      setLoading(false)
    }
    init()
  }, [companyId])

  useEffect(() => {
    if (selectedCategory) {
      loadDocuments(selectedCategory.id)
    } else if (searchQuery) {
      loadDocuments()
    } else {
      setDocuments([])
    }
  }, [selectedCategory, searchQuery, companyId])

  const handleCategorySelect = (category: KnowledgeBaseCategory) => {
    setSelectedCategory(category)
    setSearchQuery('')
  }

  const handleDocumentSelect = (document: KnowledgeBaseDocument) => {
    setSelectedDocument(document)
    setShowDocumentViewer(true)
  }

  const handleCategoryCreated = () => {
    setShowCategoryForm(false)
    setEditingCategory(null)
    loadCategories()
  }

  const handleDocumentCreated = () => {
    setShowDocumentForm(false)
    setEditingDocument(null)
    if (selectedCategory) {
      loadDocuments(selectedCategory.id)
    }
    loadCategories() // Refresh to update document counts
  }

  const handleEditCategory = (category: KnowledgeBaseCategory) => {
    setEditingCategory(category)
    setShowCategoryForm(true)
  }

  const handleEditDocument = (document: KnowledgeBaseDocument) => {
    setEditingDocument(document)
    setShowDocumentForm(true)
  }

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm(t('knowledgeBase.confirmDeleteCategory'))) return
    
    try {
      const response = await fetch(`/api/knowledge-base/categories/${categoryId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        loadCategories()
        if (selectedCategory?.id === categoryId) {
          setSelectedCategory(null)
          setDocuments([])
        }
      }
    } catch (error) {
      console.error('Failed to delete category:', error)
    }
  }

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm(t('knowledgeBase.confirmDeleteDocument'))) return
    
    try {
      const response = await fetch(`/api/knowledge-base/documents/${documentId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        if (selectedCategory) {
          loadDocuments(selectedCategory.id)
        }
        loadCategories() // Refresh to update document counts
      }
    } catch (error) {
      console.error('Failed to delete document:', error)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      setSelectedCategory(null)
    }
  }

  const clearSearch = () => {
    setSearchQuery('')
    setSelectedCategory(null)
    setDocuments([])
  }

  const handleGenerateQuestions = async (selectedDocuments: KnowledgeBaseDocument[], questionCount: number) => {
    setGeneratingQuestions(true)
    setShowDocumentSelection(false)

    try {
      const response = await fetch('/api/generate-save-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          companyId: companyId,
          questionCount: questionCount,
          selectedDocuments: selectedDocuments.map(doc => ({
            id: doc.id,
            title: doc.title,
            content: doc.content
          }))
        })
      })

      const data = await response.json()

      if (data.success) {
        alert(t('knowledgeBase.questionsGenerated', {
          topicsExtracted: data.summary.topicsExtracted,
          questionsSaved: data.summary.questionsSaved,
          documentsAnalyzed: selectedDocuments.length
        }))

        // Switch to questions view to show the new questions
        setCurrentView('questions')
        // Force reload by triggering a key change or re-render
        window.location.reload()
      } else {
        alert(t('knowledgeBase.questionsFailedPrefix') + (data.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Question generation error:', error)
      alert(t('knowledgeBase.questionsFailed'))
    } finally {
      setGeneratingQuestions(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('knowledgeBase.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* User Header with user info in top right */}
        <UserHeader
          title={t('knowledgeBase.title')}
          subtitle={
            selectedCategory
              ? t('knowledgeBase.viewingCategory', { categoryName: selectedCategory.name })
              : searchQuery
                ? t('knowledgeBase.searchResults', { query: searchQuery })
                : t('knowledgeBase.subtitle')
          }
        />

        {/* Action buttons */}
        <div className="mb-8">
          <div className="flex items-center justify-end">
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDocumentSelection(true)}
                disabled={generatingQuestions}
                className={`px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  generatingQuestions
                    ? 'bg-purple-400 cursor-not-allowed text-white'
                    : 'bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-500'
                }`}
              >
                {generatingQuestions ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>{t('knowledgeBase.generating')}</span>
                  </div>
                ) : (
                  t('knowledgeBase.generateQuestions')
                )}
              </button>
              {selectedCategory && (
                <button
                  onClick={() => setShowDocumentForm(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  {t('knowledgeBase.addDocument')}
                </button>
              )}
              <button
                onClick={() => setShowCategoryForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {t('knowledgeBase.createCategory')}
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => router.push('/manager')}
                className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
              >
                {t('manager.dashboard.tabFeed')}
              </button>
              <button
                onClick={() => router.push('/manager?tab=progress')}
                className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
              >
                {t('manager.dashboard.tabProgress')}
              </button>
              <button
                onClick={() => router.push('/manager?tab=training')}
                className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
              >
                {t('manager.dashboard.tabTracks')}
              </button>
              <button
                onClick={() => {}}
                className="border-blue-500 text-blue-600 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
              >
                {t('manager.dashboard.tabKnowledge')}
              </button>
              <button
                onClick={() => router.push('/manager/employees')}
                className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
              >
                {t('manager.dashboard.tabEmployees')}
              </button>
            </nav>
          </div>
        </div>

        {/* Content Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setCurrentView('documents')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  currentView === 'documents'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {t('knowledgeBase.tabDocuments')}
              </button>
              <button
                onClick={() => setCurrentView('questions')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  currentView === 'questions'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {t('knowledgeBase.tabQuestions')}
              </button>
              <button
                onClick={() => setCurrentView('recommendations')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  currentView === 'recommendations'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {t('knowledgeBase.tabRecommendations')}
              </button>
            </nav>
          </div>
        </div>

        {/* Search Bar - Only show for documents view */}
        {currentView === 'documents' && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <form onSubmit={handleSearch} className="flex items-center space-x-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('knowledgeBase.searchPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {t('knowledgeBase.searchButton')}
              </button>
              {(searchQuery || selectedCategory) && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  {t('knowledgeBase.clearButton')}
                </button>
              )}
            </form>
          </div>
        )}

        {/* Main Content */}
        {currentView === 'documents' ? (
          // Documents view
          !selectedCategory && !searchQuery ? (
          /* Categories Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category) => (
              <CategoryFolder
                key={category.id}
                category={category}
                onSelect={handleCategorySelect}
                onEdit={handleEditCategory}
                onDelete={handleDeleteCategory}
              />
            ))}
            
            {categories.length === 0 && (
              <div className="col-span-full text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 5a2 2 0 012-2h2a2 2 0 012 2v0a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2v0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">{t('knowledgeBase.noCategoriesTitle')}</h3>
                <p className="mt-1 text-sm text-gray-500">{t('knowledgeBase.noCategoriesDescription')}</p>
                <button
                  onClick={() => setShowCategoryForm(true)}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  {t('knowledgeBase.createCategory')}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Documents List View */
          <div className="space-y-4">
            {documents.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  {selectedCategory ? t('knowledgeBase.noDocumentsTitle') : t('knowledgeBase.noSearchResults')}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedCategory
                    ? t('knowledgeBase.noDocumentsDescription')
                    : t('knowledgeBase.noSearchDescription')
                  }
                </p>
                {selectedCategory && (
                  <button
                    onClick={() => setShowDocumentForm(true)}
                    className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                  >
                    {t('knowledgeBase.addDocument')}
                  </button>
                )}
              </div>
            ) : (
              documents.map((document) => (
                <div key={document.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">{document.title}</h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {document.file_type}
                        </span>
                        {document.category && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {document.category.name}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                        {document.content.substring(0, 200)}...
                      </p>
                      <div className="text-xs text-gray-500">
                        {t('knowledgeBase.createdLabel')} {new Date(document.created_at).toLocaleDateString()}
                        {document.file_size && ` • ${t('knowledgeBase.fileSize', { size: Math.round(document.file_size / 1024) })}`}
                      </div>
                    </div>
                    <div className="ml-4 flex-shrink-0 flex space-x-2">
                      <button
                        onClick={() => handleDocumentSelect(document)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        {t('knowledgeBase.viewButton')}
                      </button>
                      <button
                        onClick={() => handleEditDocument(document)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        {t('knowledgeBase.editButton')}
                      </button>
                      <button
                        onClick={() => handleDeleteDocument(document.id)}
                        className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        {t('knowledgeBase.deleteButton')}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )
        ) : currentView === 'questions' ? (
          // Questions view
          <QuestionPoolView companyId={companyId} />
        ) : (
          // Recommendations view
          <RecommendationQuestionsView companyId={companyId} />
        )}

        {/* Category Form Modal */}
        {showCategoryForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingCategory ? t('knowledgeBase.editCategory') : t('knowledgeBase.createNewCategory')}
                </h3>
              </div>
              <CategoryForm
                category={editingCategory}
                companyId={companyId}
                onSuccess={handleCategoryCreated}
                onCancel={() => {
                  setShowCategoryForm(false)
                  setEditingCategory(null)
                }}
              />
            </div>
          </div>
        )}

        {/* Document Form Modal */}
        {showDocumentForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingDocument ? t('knowledgeBase.editDocument') : t('knowledgeBase.addNewDocument')}
                </h3>
                {selectedCategory && !editingDocument && (
                  <p className="text-sm text-gray-600">{t('knowledgeBase.addingTo', { categoryName: selectedCategory.name })}</p>
                )}
              </div>
              <DocumentForm
                document={editingDocument}
                companyId={companyId}
                categories={categories}
                selectedCategoryId={selectedCategory?.id}
                onSuccess={handleDocumentCreated}
                onCancel={() => {
                  setShowDocumentForm(false)
                  setEditingDocument(null)
                }}
              />
            </div>
          </div>
        )}

        {/* Document Viewer Modal */}
        {showDocumentViewer && selectedDocument && (
          <DocumentViewer
            document={selectedDocument}
            onClose={() => {
              setShowDocumentViewer(false)
              setSelectedDocument(null)
            }}
          />
        )}

        {/* Document Selection Modal for Question Generation */}
        <DocumentSelectionModal
          isOpen={showDocumentSelection}
          onClose={() => setShowDocumentSelection(false)}
          onGenerate={handleGenerateQuestions}
          companyId={companyId}
          isGenerating={generatingQuestions}
        />
      </div>
    </div>
  )
}