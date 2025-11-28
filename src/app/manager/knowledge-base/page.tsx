'use client'

import { useTranslations } from 'next-intl'
import KnowledgeBaseView from '@/components/KnowledgeBase/KnowledgeBaseView'
import { useAuth } from '@/contexts/AuthContext'
import UserHeader from '@/components/Shared/UserHeader'

export default function KnowledgeBasePage() {
  const { user, loading } = useAuth()
  const t = useTranslations()
  const companyId = user?.company_id

  // Show loading state while auth is loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  // Guard: Require company_id to be present
  if (!companyId) {
    return (
      <div className="min-h-screen bg-gray-100">
        <UserHeader />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-red-800 mb-2">{t('header.companyIdMissing')}</h2>
              <p className="text-red-700">Your account is not associated with a company. Please contact your administrator.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <KnowledgeBaseView companyId={companyId} />
}