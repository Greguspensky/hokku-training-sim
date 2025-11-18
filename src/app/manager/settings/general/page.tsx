'use client'

/**
 * General Settings Page
 *
 * Configure default training language and recording options by scenario type
 * Moved from manager dashboard (2025-10-28)
 */

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import UserHeader from '@/components/UserHeader'
import { SUPPORTED_LANGUAGES } from '@/lib/languages'

export default function GeneralSettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const companyId = user?.company_id

  const [defaultLanguage, setDefaultLanguage] = useState('en')
  const [savingLanguage, setSavingLanguage] = useState(false)
  const [theoryRecordingOptions, setTheoryRecordingOptions] = useState<string[]>(['audio', 'audio_video'])
  const [servicePracticeRecordingOptions, setServicePracticeRecordingOptions] = useState<string[]>(['audio', 'audio_video'])
  const [savingRecordingOptions, setSavingRecordingOptions] = useState(false)
  const [showSessionNamesToEmployees, setShowSessionNamesToEmployees] = useState(false)
  const [savingVisibility, setSavingVisibility] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load settings on mount
  useEffect(() => {
    if (companyId) {
      loadCompanySettings()
    }
  }, [companyId])

  const loadCompanySettings = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/company-settings?company_id=${companyId}`)
      const data = await response.json()
      if (data.success && data.settings) {
        setDefaultLanguage(data.settings.default_training_language || 'en')
        setTheoryRecordingOptions(data.settings.theory_recording_options || ['audio', 'audio_video'])
        setServicePracticeRecordingOptions(data.settings.service_practice_recording_options || ['audio', 'audio_video'])
        setShowSessionNamesToEmployees(data.settings.show_session_names_to_employees || false)
      }
    } catch (error) {
      console.error('Failed to load company settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLanguageChange = async (languageCode: string) => {
    setSavingLanguage(true)
    try {
      const response = await fetch('/api/company-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          default_training_language: languageCode
        })
      })

      const data = await response.json()
      if (data.success) {
        setDefaultLanguage(languageCode)
        console.log('✅ Default training language updated to:', languageCode)
      } else {
        alert('Failed to update default language')
      }
    } catch (error) {
      console.error('Failed to update default language:', error)
      alert('Failed to update default language')
    } finally {
      setSavingLanguage(false)
    }
  }

  const handleRecordingOptionsChange = async (scenarioType: 'theory' | 'service_practice', options: string[]) => {
    setSavingRecordingOptions(true)
    try {
      const settingKey = scenarioType === 'theory' ? 'theory_recording_options' : 'service_practice_recording_options'
      const response = await fetch('/api/company-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          [settingKey]: options
        })
      })

      const data = await response.json()
      if (data.success) {
        if (scenarioType === 'theory') {
          setTheoryRecordingOptions(options)
        } else {
          setServicePracticeRecordingOptions(options)
        }
        console.log(`✅ ${scenarioType} recording options updated to:`, options)
      } else {
        alert('Failed to update recording options')
      }
    } catch (error) {
      console.error('Failed to update recording options:', error)
      alert('Failed to update recording options')
    } finally {
      setSavingRecordingOptions(false)
    }
  }

  const handleSessionNamesVisibilityChange = async (showNames: boolean) => {
    setSavingVisibility(true)
    try {
      const response = await fetch('/api/company-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          show_session_names_to_employees: showNames
        })
      })

      const data = await response.json()
      if (data.success) {
        setShowSessionNamesToEmployees(showNames)
        console.log('✅ Session names visibility updated to:', showNames)
      } else {
        alert('Failed to update session names visibility')
      }
    } catch (error) {
      console.error('Failed to update session names visibility:', error)
      alert('Failed to update session names visibility')
    } finally {
      setSavingVisibility(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!companyId) {
    return (
      <div className="min-h-screen bg-gray-100">
        <UserHeader />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-red-800 mb-2">Company ID Missing</h2>
              <p className="text-red-700">Your account is not associated with a company. Please contact your administrator.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <UserHeader />

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">General Settings</h1>
            <p className="mt-2 text-gray-600">
              Configure default training language and recording options for your team.
            </p>
          </div>

          {loading ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading settings...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Default Language Section */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Training Language by Default</h2>
                <p className="text-sm text-gray-600 mb-4">
                  This will be the default language for all employee training sessions
                </p>

                <div className="max-w-md">
                  <div className="relative">
                    <select
                      value={defaultLanguage}
                      onChange={(e) => handleLanguageChange(e.target.value)}
                      disabled={savingLanguage}
                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md disabled:bg-gray-100"
                    >
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.flag} {lang.name}
                        </option>
                      ))}
                    </select>
                    {savingLanguage && (
                      <div className="absolute right-8 top-2.5">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Session Names Visibility Section */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Session Names Visibility</h2>
                <p className="text-sm text-gray-600 mb-4">
                  Control whether employees can see actual training session names or generic placeholders
                </p>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1">
                    <div className="flex items-center mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        Show actual session names to employees
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {showSessionNamesToEmployees
                        ? 'Employees will see real scenario titles (e.g., "Handling Angry Customer")'
                        : 'Employees will see generic names (e.g., "Training Session 1", "Training Session 2")'}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={showSessionNamesToEmployees}
                      onChange={(e) => handleSessionNamesVisibilityChange(e.target.checked)}
                      disabled={savingVisibility}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"></div>
                  </label>
                  {savingVisibility && (
                    <div className="ml-3 flex items-center">
                      <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                    </div>
                  )}
                </div>

                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-xs text-blue-700">
                    <strong>Note:</strong> Hiding session names creates a "surprise mode" effect where employees discover what they're training on when they start the session. This can increase engagement and simulate real-world unpredictability.
                  </p>
                </div>
              </div>

              {/* Recording Options Section */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Recording Options by Scenario Type</h2>
                <p className="text-sm text-gray-600 mb-6">
                  Configure which recording options will be available to employees for each scenario type.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Theory Q&A Recording Options */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-900 mb-3">
                      📖 Theory Q&A
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={theoryRecordingOptions.includes('audio')}
                          onChange={(e) => {
                            const newOptions = e.target.checked
                              ? [...theoryRecordingOptions, 'audio']
                              : theoryRecordingOptions.filter(opt => opt !== 'audio')
                            if (newOptions.length > 0) {
                              handleRecordingOptionsChange('theory', newOptions)
                            }
                          }}
                          disabled={savingRecordingOptions}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">🎤 Audio Recording</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={theoryRecordingOptions.includes('audio_video')}
                          onChange={(e) => {
                            const newOptions = e.target.checked
                              ? [...theoryRecordingOptions, 'audio_video']
                              : theoryRecordingOptions.filter(opt => opt !== 'audio_video')
                            if (newOptions.length > 0) {
                              handleRecordingOptionsChange('theory', newOptions)
                            }
                          }}
                          disabled={savingRecordingOptions}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">🎥 Video Recording</span>
                      </label>
                    </div>
                    {savingRecordingOptions && (
                      <div className="mt-2 flex items-center text-xs text-gray-500">
                        <div className="animate-spin h-3 w-3 border-2 border-blue-500 rounded-full border-t-transparent mr-2"></div>
                        Saving...
                      </div>
                    )}
                  </div>

                  {/* Service Practice Recording Options */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-900 mb-3">
                      🗣️ Service Practice
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={servicePracticeRecordingOptions.includes('audio')}
                          onChange={(e) => {
                            const newOptions = e.target.checked
                              ? [...servicePracticeRecordingOptions, 'audio']
                              : servicePracticeRecordingOptions.filter(opt => opt !== 'audio')
                            if (newOptions.length > 0) {
                              handleRecordingOptionsChange('service_practice', newOptions)
                            }
                          }}
                          disabled={savingRecordingOptions}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">🎤 Audio Recording</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={servicePracticeRecordingOptions.includes('audio_video')}
                          onChange={(e) => {
                            const newOptions = e.target.checked
                              ? [...servicePracticeRecordingOptions, 'audio_video']
                              : servicePracticeRecordingOptions.filter(opt => opt !== 'audio_video')
                            if (newOptions.length > 0) {
                              handleRecordingOptionsChange('service_practice', newOptions)
                            }
                          }}
                          disabled={savingRecordingOptions}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">🎥 Video Recording</span>
                      </label>
                    </div>
                    {savingRecordingOptions && (
                      <div className="mt-2 flex items-center text-xs text-gray-500">
                        <div className="animate-spin h-3 w-3 border-2 border-blue-500 rounded-full border-t-transparent mr-2"></div>
                        Saving...
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-xs text-blue-700">
                    <strong>Note:</strong> At least one recording option must be selected for each scenario type. These settings control what recording options employees will see in the dropdown menu.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
