'use client'

import { useState } from 'react'
import RecommendationQuestionInput from './RecommendationQuestionInput'
import RecommendationQuestionsList from './RecommendationQuestionsList'

interface RecommendationQuestionsViewProps {
  companyId: string
}

export default function RecommendationQuestionsView({ companyId }: RecommendationQuestionsViewProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleQuestionsAdded = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <div className="space-y-8">
      <RecommendationQuestionInput
        companyId={companyId}
        onQuestionsAdded={handleQuestionsAdded}
      />
      <RecommendationQuestionsList
        companyId={companyId}
        refreshTrigger={refreshTrigger}
      />
    </div>
  )
}