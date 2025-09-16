'use client'

import { KnowledgeBaseDocument } from '@/lib/knowledge-base'

interface DocumentViewerProps {
  document: KnowledgeBaseDocument
  onClose: () => void
}

export default function DocumentViewer({ document, onClose }: DocumentViewerProps) {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-8 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white mb-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 pb-4 border-b border-gray-200">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="text-xl font-semibold text-gray-900">{document.title}</h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {document.file_type}
              </span>
              {document.category && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {document.category.name}
                </span>
              )}
            </div>
            <div className="text-sm text-gray-600 space-x-4">
              <span>Created: {new Date(document.created_at).toLocaleDateString()}</span>
              <span>Modified: {new Date(document.updated_at).toLocaleDateString()}</span>
              {document.file_size && (
                <span>Size: {Math.round(document.file_size / 1024)} KB</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-md"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Document Content */}
        <div className="max-h-96 overflow-y-auto">
          <div className="bg-gray-50 rounded-lg p-6 border">
            <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {document.content}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Document contains {document.content.length} characters
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={() => {
                navigator.clipboard.writeText(document.content)
                // You could add a toast notification here
              }}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy Content
            </button>
            
            <button
              onClick={onClose}
              className="bg-blue-600 text-white px-4 py-2 text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}