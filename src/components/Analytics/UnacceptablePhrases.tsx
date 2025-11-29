'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, Ban, AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface UnacceptablePhrase {
  phrase: string
  severity: 'offensive' | 'unprofessional'
  reason: string
  correct_alternative: string
}

interface UnacceptablePhrasesProps {
  phrases: UnacceptablePhrase[]
}

export default function UnacceptablePhrases({
  phrases
}: UnacceptablePhrasesProps) {
  const t = useTranslations('assessment')
  const [expanded, setExpanded] = useState(true)

  // Don't render if no unacceptable phrases
  if (!phrases || phrases.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-red-50 hover:bg-red-100 transition-colors"
      >
        <div className="flex items-center">
          <AlertTriangle className="w-5 h-5 text-red-600 mr-3" />
          <h3 className="text-lg font-semibold text-red-900">
            {t('unacceptablePhrases')} ({phrases.length})
          </h3>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-red-600" />
        ) : (
          <ChevronDown className="w-5 h-5 text-red-600" />
        )}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {phrases.map((item, index) => (
            <div
              key={index}
              className={`rounded-lg p-4 border-l-4 ${
                item.severity === 'offensive'
                  ? 'bg-red-50 border-red-500'
                  : 'bg-orange-50 border-orange-500'
              }`}
            >
              {/* Phrase Used */}
              <div className="mb-3">
                <span className="text-sm font-semibold text-gray-700">
                  {t('phraseUsed')}:
                </span>
                <div className="mt-1">
                  <span className="text-red-700 font-medium text-base">
                    "{item.phrase}"
                  </span>
                </div>
              </div>

              {/* Severity Badge */}
              <div className="mb-3">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold ${
                    item.severity === 'offensive'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-orange-100 text-orange-800'
                  }`}
                >
                  {item.severity === 'offensive' ? (
                    <>
                      <Ban className="w-3 h-3 mr-1" />
                      {t('severity.offensive')}
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {t('severity.unprofessional')}
                    </>
                  )}
                </span>
              </div>

              {/* Reason */}
              <div className="mb-3 text-sm text-gray-700">
                <span className="font-semibold">{t('why')}:</span>
                <p className="mt-1">{item.reason}</p>
              </div>

              {/* Correct Alternative */}
              <div className="text-sm">
                <span className="font-semibold text-green-700">
                  {t('shouldSay')}:
                </span>
                <div className="mt-1">
                  <span className="text-green-700 font-medium">
                    "{item.correct_alternative}"
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
