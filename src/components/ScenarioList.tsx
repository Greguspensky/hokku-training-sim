'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { type Scenario } from '@/lib/scenarios'
import { translationService, type LanguageCode } from '@/lib/translation'
import TranslationStatus from './TranslationStatus'

interface ScenarioListProps {
  companyId: string
  preferredLanguage?: LanguageCode
  onScenarioSelect?: (scenario: Scenario) => void
  showTranslationStatus?: boolean
}

export default function ScenarioList({ 
  companyId, 
  preferredLanguage = 'en',
  onScenarioSelect,
  showTranslationStatus = false
}: ScenarioListProps) {
  const router = useRouter()
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedScenarios, setSelectedScenarios] = useState<Set<string>>(new Set())
  const [isTranslating, setIsTranslating] = useState(false)
  const [translatingScenarios, setTranslatingScenarios] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadScenarios()
  }, [companyId])

  const loadScenarios = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/scenarios?company_id=${companyId}`)
      const data = await response.json()

      if (!data.success) {
        // For demo purposes, show empty state instead of auth error
        if (data.error === 'Authentication required') {
          setScenarios([])
          return
        }
        throw new Error(data.error || 'Failed to load scenarios')
      }

      setScenarios(data.scenarios || [])
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load scenarios')
    } finally {
      setLoading(false)
    }
  }

  const handleTranslateScenario = async (scenarioId: string) => {
    setTranslatingScenarios(prev => new Set([...prev, scenarioId]))

    try {
      const response = await fetch(`/api/scenarios/${scenarioId}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_language: preferredLanguage
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Translation failed')
      }

      // Refresh scenarios to show updated translations
      await loadScenarios()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Translation failed')
    } finally {
      setTranslatingScenarios(prev => {
        const newSet = new Set(prev)
        newSet.delete(scenarioId)
        return newSet
      })
    }
  }

  const handleBatchTranslate = async () => {
    if (selectedScenarios.size === 0) return

    setIsTranslating(true)
    const scenarioIds = Array.from(selectedScenarios)

    try {
      const response = await fetch('/api/scenarios/batch-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario_ids: scenarioIds,
          source_language: preferredLanguage
        })
      })

      const data = await response.json()

      if (data.failed && data.failed.length > 0) {
        console.warn('Some translations failed:', data.failed)
      }

      // Refresh scenarios to show updated translations
      await loadScenarios()
      setSelectedScenarios(new Set())
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Batch translation failed')
    } finally {
      setIsTranslating(false)
    }
  }

  const toggleScenarioSelection = (scenarioId: string) => {
    setSelectedScenarios(prev => {
      const newSet = new Set(prev)
      if (newSet.has(scenarioId)) {
        newSet.delete(scenarioId)
      } else {
        newSet.add(scenarioId)
      }
      return newSet
    })
  }

  const getLocalizedScenario = (scenario: Scenario) => {
    return {
      ...scenario,
      title: translationService.getLocalizedText(scenario.title, preferredLanguage),
      description: translationService.getLocalizedText(scenario.description, preferredLanguage)
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800'
      case 'intermediate': return 'bg-yellow-100 text-yellow-800'
      case 'advanced': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="ml-2 text-gray-600">Loading scenarios...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <div className="flex items-center space-x-2">
          <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-600">{error}</p>
        </div>
        <button
          onClick={loadScenarios}
          className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
        >
          Try again
        </button>
      </div>
    )
  }

  if (scenarios.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No scenarios</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by creating your first training scenario.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Batch Actions */}
      {showTranslationStatus && selectedScenarios.size > 0 && (
        <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-blue-700">
              {selectedScenarios.size} scenario{selectedScenarios.size !== 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSelectedScenarios(new Set())}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Clear selection
            </button>
            <button
              onClick={handleBatchTranslate}
              disabled={isTranslating}
              className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTranslating ? (
                <>
                  <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Translating...</span>
                </>
              ) : (
                <>
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                  <span>Batch Translate</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Scenarios Grid */}
      <div className="grid grid-cols-1 gap-6">
        {scenarios.map((scenario) => {
          const localizedScenario = getLocalizedScenario(scenario)
          const translationStatus = translationService.getTranslationStatus(scenario.title)
          const isScenarioTranslating = translatingScenarios.has(scenario.id)
          
          return (
            <div
              key={scenario.id}
              className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-3 flex-1">
                    {showTranslationStatus && (
                      <input
                        type="checkbox"
                        checked={selectedScenarios.has(scenario.id)}
                        onChange={() => toggleScenarioSelection(scenario.id)}
                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900 mb-1">
                        {localizedScenario.title}
                      </h3>
                      <p className="text-xs text-gray-400 font-mono mb-1">
                        ID: {scenario.id}
                      </p>
                      <p className="text-gray-600 text-sm">
                        {localizedScenario.description}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => onScenarioSelect?.(scenario)}
                    className="ml-4 text-blue-600 hover:text-blue-700"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {/* Metadata */}
                <div className="flex items-center space-x-4 mb-4 text-sm text-gray-500">
                  <div className="flex items-center space-x-1">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{scenario.estimated_duration_minutes} min</span>
                  </div>
                  
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(scenario.difficulty)}`}>
                    {scenario.difficulty}
                  </span>
                  
                  {scenario.industry && (
                    <div className="flex items-center space-x-1">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span>{scenario.industry}</span>
                    </div>
                  )}
                </div>

                {/* Translation Status */}
                {showTranslationStatus && (
                  <TranslationStatus
                    multilingualText={scenario.title}
                    showDetails={false}
                    onTranslateClick={() => handleTranslateScenario(scenario.id)}
                    isTranslating={isScenarioTranslating}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}