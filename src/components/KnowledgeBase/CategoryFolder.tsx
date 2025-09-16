'use client'

import { KnowledgeBaseCategory } from '@/lib/knowledge-base'

interface CategoryFolderProps {
  category: KnowledgeBaseCategory
  onSelect: (category: KnowledgeBaseCategory) => void
  onEdit: (category: KnowledgeBaseCategory) => void
  onDelete: (categoryId: string) => void
}

export default function CategoryFolder({ category, onSelect, onEdit, onDelete }: CategoryFolderProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-start justify-between">
        <div className="flex-1" onClick={() => onSelect(category)}>
          <div className="flex items-center mb-2">
            <svg className="h-6 w-6 text-yellow-500 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/>
            </svg>
            <h3 className="text-lg font-medium text-gray-900">{category.name}</h3>
          </div>
          <p className="text-gray-600 text-sm mb-3">{category.description}</p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {category.document_count || 0} document{(category.document_count || 0) !== 1 ? 's' : ''}
            </span>
            <span className="text-xs text-gray-400">
              Created {new Date(category.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
        
        <div className="ml-4 flex-shrink-0 flex space-x-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(category)
            }}
            className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded"
            title="Edit category"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(category.id)
            }}
            className="p-1 text-gray-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 rounded"
            title="Delete category"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}