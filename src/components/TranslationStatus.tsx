'use client'

import { useState } from 'react'
import { SUPPORTED_LANGUAGES, type LanguageCode, type MultilingualText } from '@/lib/translation'

interface TranslationStatusProps {
  multilingualText: MultilingualText
  showDetails?: boolean
  onTranslateClick?: () => void
  onLanguageClick?: (language: LanguageCode) => void
  isTranslating?: boolean
}

export default function TranslationStatus({ 
  multilingualText, 
  showDetails = true,
  onTranslateClick,
  onLanguageClick,
  isTranslating = false
}: TranslationStatusProps) {
  const [expanded, setExpanded] = useState(false)
  
  // Calculate translation status
  const allLanguages = Object.keys(SUPPORTED_LANGUAGES) as LanguageCode[]
  const completedLanguages = allLanguages.filter(lang => 
    multilingualText[lang] && multilingualText[lang]!.trim() !== ''
  )
  const missingLanguages = allLanguages.filter(lang => !completedLanguages.includes(lang))
  const percentage = Math.round((completedLanguages.length / allLanguages.length) * 100)
  
  const getStatusColor = () => {
    if (percentage === 100) return 'text-green-600 bg-green-100'
    if (percentage >= 50) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const getLanguageStatus = (lang: LanguageCode) => {
    const hasTranslation = completedLanguages.includes(lang)
    return {
      hasTranslation,
      text: multilingualText[lang] || '',
      color: hasTranslation ? 'text-green-600 bg-green-100' : 'text-gray-400 bg-gray-100'
    }
  }

  return (
    <div className="space-y-3">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor()}`}>
            {percentage}% Complete
          </div>
          <div className="text-sm text-gray-600">
            {completedLanguages.length}/{allLanguages.length} languages
          </div>
          {percentage < 100 && (
            <button
              onClick={onTranslateClick}
              disabled={isTranslating}
              className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTranslating ? (
                <>
                  <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Translating...</span>
                </>
              ) : (
                <>
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                  <span>Auto-Translate</span>
                </>
              )}
            </button>
          )}
        </div>
        
        {showDetails && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
          >
            <span>{expanded ? 'Hide Details' : 'Show Details'}</span>
            <svg className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>

      {/* Language Details */}
      {expanded && showDetails && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Translation Status by Language</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allLanguages.map((lang) => {
              const status = getLanguageStatus(lang)
              return (
                <div
                  key={lang}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => onLanguageClick?.(lang)}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${status.hasTranslation ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {SUPPORTED_LANGUAGES[lang].native}
                      </div>
                      <div className="text-xs text-gray-500">
                        {SUPPORTED_LANGUAGES[lang].name}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {status.hasTranslation ? (
                      <div className="flex items-center space-x-1 text-green-600">
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs">Complete</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1 text-gray-400">
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs">Missing</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Missing Languages Summary */}
      {missingLanguages.length > 0 && !expanded && (
        <div className="text-xs text-gray-500">
          Missing translations: {missingLanguages.map(lang => SUPPORTED_LANGUAGES[lang].native).join(', ')}
        </div>
      )}
    </div>
  )
}