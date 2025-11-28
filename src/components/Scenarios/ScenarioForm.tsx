'use client'

import BaseScenarioForm from './BaseScenarioForm'
import type { Track } from '@/lib/scenarios'

interface ScenarioFormProps {
  companyId: string
  tracks: Track[]
  onSuccess?: () => void
  onCancel?: () => void
}

/**
 * ScenarioForm - Wrapper for creating new scenarios
 *
 * This is a thin wrapper around BaseScenarioForm that provides
 * the 'create' mode for backward compatibility.
 */
export default function ScenarioForm(props: ScenarioFormProps) {
  return <BaseScenarioForm mode="create" {...props} />
}
