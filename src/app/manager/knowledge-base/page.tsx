'use client'

import KnowledgeBaseView from '@/components/KnowledgeBase/KnowledgeBaseView'

export default function KnowledgeBasePage() {
  // Demo company ID - in real app this would come from auth
  const companyId = 'demo-company-1'

  return <KnowledgeBaseView companyId={companyId} />
}