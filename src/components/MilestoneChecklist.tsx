'use client'

import { CheckCircle, XCircle, Target } from 'lucide-react'

interface Milestone {
  milestone: string
  achieved: boolean
  evidence?: string
}

interface MilestoneChecklistProps {
  milestones: Milestone[]
  completionRate: number
}

export default function MilestoneChecklist({
  milestones,
  completionRate
}: MilestoneChecklistProps) {
  const achievedCount = milestones.filter(m => m.achieved).length
  const totalCount = milestones.length

  const getCompletionColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600'
    if (rate >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getCompletionBackground = (rate: number) => {
    if (rate >= 80) return 'bg-green-50 border-green-200'
    if (rate >= 50) return 'bg-yellow-50 border-yellow-200'
    return 'bg-red-50 border-red-200'
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center mb-4">
        <Target className="w-6 h-6 text-blue-600 mr-3" />
        <h3 className="text-lg font-semibold text-gray-900">Milestone Achievement</h3>
      </div>

      {/* Completion Summary */}
      <div className={`p-4 rounded-lg border-2 ${getCompletionBackground(completionRate)} mb-4`}>
        <div className="text-sm text-gray-600">Completion Rate</div>
        <div className={`text-2xl font-bold ${getCompletionColor(completionRate)}`}>
          {achievedCount} / {totalCount}
        </div>
      </div>

      {/* Milestone List */}
      <div className="space-y-3">
        {milestones.map((milestone, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg border-2 ${
              milestone.achieved
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-start">
              {milestone.achieved ? (
                <CheckCircle className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className={`font-medium ${
                  milestone.achieved ? 'text-green-900' : 'text-red-900'
                }`}>
                  {milestone.milestone}
                </div>
                {milestone.evidence && (
                  <div className="text-sm text-gray-600 mt-1">
                    <span className="font-medium">Evidence:</span> {milestone.evidence}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Performance Message */}
      {totalCount > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-700">
            {completionRate >= 80 ? (
              <span className="text-green-700 font-medium">
                ✓ Excellent! You achieved most milestones.
              </span>
            ) : completionRate >= 50 ? (
              <span className="text-yellow-700 font-medium">
                Good progress. Focus on the milestones you missed for improvement.
              </span>
            ) : (
              <span className="text-red-700 font-medium">
                Consider reviewing the scenario objectives before practicing again.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
