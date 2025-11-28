'use client'

import BaseScenarioForm from './BaseScenarioForm'
import type { Track, Scenario } from '@/lib/scenarios'

interface EditScenarioFormProps {
  scenario: Scenario
  companyId: string
  tracks: Track[]
  onSuccess?: () => void
  onCancel?: () => void
}

/**
 * EditScenarioForm - Wrapper for editing existing scenarios
 *
 * This is a thin wrapper around BaseScenarioForm that provides
 * the 'edit' mode for backward compatibility.
 */
export default function EditScenarioForm(props: EditScenarioFormProps) {
  return <BaseScenarioForm mode="edit" {...props} />
}
