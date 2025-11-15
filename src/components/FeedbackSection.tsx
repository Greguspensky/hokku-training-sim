'use client'

import { useState } from 'react'
import { ThumbsUp, AlertTriangle, ChevronDown, ChevronUp, Quote } from 'lucide-react'

interface Strength {
  point: string
  evidence: string
}

interface Improvement {
  point: string
  current?: string
  better?: string
}

interface FeedbackSectionProps {
  strengths: Strength[]
  improvements: Improvement[]
}

export default function FeedbackSection({
  strengths,
  improvements
}: FeedbackSectionProps) {
  const [strengthsExpanded, setStrengthsExpanded] = useState(true)
  const [improvementsExpanded, setImprovementsExpanded] = useState(true)

  return (
    <div className="space-y-4">
      {/* Strengths Section */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <button
          onClick={() => setStrengthsExpanded(!strengthsExpanded)}
          className="w-full flex items-center justify-between p-4 bg-green-50 hover:bg-green-100 transition-colors"
        >
          <div className="flex items-center">
            <ThumbsUp className="w-5 h-5 text-green-600 mr-3" />
            <h3 className="text-lg font-semibold text-green-900">
              Key Strengths ({strengths.length})
            </h3>
          </div>
          {strengthsExpanded ? (
            <ChevronUp className="w-5 h-5 text-green-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-green-600" />
          )}
        </button>

        {strengthsExpanded && (
          <div className="p-4 space-y-3">
            {strengths.length > 0 ? (
              strengths.map((strength, index) => (
                <div
                  key={index}
                  className="p-3 bg-green-50 border-l-4 border-green-500 rounded"
                >
                  <div className="font-medium text-green-900 mb-2">
                    {strength.point}
                  </div>
                  {strength.evidence && (
                    <div className="flex items-start text-sm text-green-700">
                      <Quote className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                      <div className="italic">"{strength.evidence}"</div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-4">
                No specific strengths identified
              </div>
            )}
          </div>
        )}
      </div>

      {/* Improvements Section */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <button
          onClick={() => setImprovementsExpanded(!improvementsExpanded)}
          className="w-full flex items-center justify-between p-4 bg-yellow-50 hover:bg-yellow-100 transition-colors"
        >
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mr-3" />
            <h3 className="text-lg font-semibold text-yellow-900">
              Areas for Improvement ({improvements.length})
            </h3>
          </div>
          {improvementsExpanded ? (
            <ChevronUp className="w-5 h-5 text-yellow-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-yellow-600" />
          )}
        </button>

        {improvementsExpanded && (
          <div className="p-4 space-y-3">
            {improvements.length > 0 ? (
              improvements.map((improvement, index) => (
                <div
                  key={index}
                  className="p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded"
                >
                  <div className="font-medium text-yellow-900 mb-2">
                    {improvement.point}
                  </div>

                  {improvement.current && (
                    <div className="text-sm mb-2">
                      <div className="text-red-700 font-medium mb-1">
                        ✗ What you said:
                      </div>
                      <div className="text-red-600 pl-4 italic">
                        "{improvement.current}"
                      </div>
                    </div>
                  )}

                  {improvement.better && (
                    <div className="text-sm">
                      <div className="text-green-700 font-medium mb-1">
                        ✓ Better approach:
                      </div>
                      <div className="text-green-600 pl-4 italic">
                        "{improvement.better}"
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-4">
                No improvements needed - excellent work!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
