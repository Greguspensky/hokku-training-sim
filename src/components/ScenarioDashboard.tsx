'use client'

import { useState } from 'react'
import { type Scenario } from '@/lib/scenarios'
import { type LanguageCode } from '@/lib/translation'
import ScenarioForm from './ScenarioForm'
import ScenarioList from './ScenarioList'
import TranslationStatus from './TranslationStatus'

interface ScenarioDashboardProps {
  companyId: string
  preferredLanguage?: LanguageCode
}

type ViewMode = 'list' | 'create' | 'edit'

export default function ScenarioDashboard({ 
  companyId, 
  preferredLanguage = 'en' 
}: ScenarioDashboardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleCreateSuccess = () => {
    setViewMode('list')
    setRefreshKey(prev => prev + 1)
  }

  const handleScenarioSelect = (scenario: Scenario) => {
    setSelectedScenario(scenario)
    // You could navigate to scenario details or open edit mode here
    console.log('Selected scenario:', scenario)
  }

  const refreshScenarios = () => {
    setRefreshKey(prev => prev + 1)
  }

  if (viewMode === 'create') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create New Scenario</h1>
            <p className="mt-1 text-sm text-gray-500">
              Build a training scenario with automatic translation support
            </p>
          </div>
          <button
            onClick={() => setViewMode('list')}
            className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Scenarios</span>
          </button>
        </div>

        {/* Create Form */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg">
          <div className="p-6">
            <ScenarioForm
              companyId={companyId}
              onSuccess={handleCreateSuccess}
              onCancel={() => setViewMode('list')}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Training Scenarios</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your training scenarios with multilingual support
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={refreshScenarios}
            className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
          
          <button
            onClick={() => setViewMode('create')}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Create Scenario</span>
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Scenarios</p>
              <p className="text-2xl font-semibold text-gray-900">-</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Fully Translated</p>
              <p className="text-2xl font-semibold text-gray-900">-</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avg. Duration</p>
              <p className="text-2xl font-semibold text-gray-900">-</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Languages</p>
              <p className="text-2xl font-semibold text-gray-900">7</p>
            </div>
          </div>
        </div>
      </div>

      {/* Translation Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <svg className="h-5 w-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-blue-900">Auto-Translation Available</h3>
            <p className="mt-1 text-sm text-blue-700">
              New scenarios can be automatically translated to all 7 supported languages using AI. 
              Existing scenarios can also be batch translated from the scenario list.
            </p>
          </div>
        </div>
      </div>

      {/* Scenarios List */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg">
        <div className="p-6">
          <ScenarioList
            key={refreshKey}
            companyId={companyId}
            preferredLanguage={preferredLanguage}
            onScenarioSelect={handleScenarioSelect}
            showTranslationStatus={true}
          />
        </div>
      </div>
    </div>
  )
}