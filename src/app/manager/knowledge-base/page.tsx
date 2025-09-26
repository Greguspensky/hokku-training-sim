'use client'

import KnowledgeBaseView from '@/components/KnowledgeBase/KnowledgeBaseView'

export default function KnowledgeBasePage() {
  // Demo company ID - in real app this would come from auth
  const companyId = '01f773e2-1027-490e-8d36-279136700bbf'

  return <KnowledgeBaseView companyId={companyId} />
}