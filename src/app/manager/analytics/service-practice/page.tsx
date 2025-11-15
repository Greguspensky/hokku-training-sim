'use client'

import { useSearchParams } from 'next/navigation'
import ServicePracticeAnalyticsDashboard from '@/components/Manager/ServicePracticeAnalyticsDashboard'

export default function ServicePracticeAnalyticsPage() {
  const searchParams = useSearchParams()
  const companyId = searchParams.get('company_id')

  if (!companyId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Company ID Required</h1>
          <p className="text-gray-500">Please provide a company_id parameter</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <ServicePracticeAnalyticsDashboard companyId={companyId} showOpenButton={false} />
    </div>
  )
}
