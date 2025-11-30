'use client'

/**
 * General Settings Page
 *
 * Configure default training language and recording options by scenario type
 * Moved from manager dashboard (2025-10-28)
 */

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslations, useLocale } from 'next-intl'
import UserHeader from '@/components/Shared/UserHeader'
import { SUPPORTED_LANGUAGES } from '@/lib/languages'

export default function GeneralSettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const t = useTranslations()
  const currentLocale = useLocale() // Get actual current locale from next-intl
  const companyId = user?.company_id

  const [defaultLanguage, setDefaultLanguage] = useState('en')
  const [savingLanguage, setSavingLanguage] = useState(false)
  const [uiLanguage, setUiLanguage] = useState(currentLocale) // Initialize with current locale
  const [savingUiLanguage, setSavingUiLanguage] = useState(false)
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
      const response = await fetch(`/api/settings/company-settings?company_id=${companyId}`)
      const data = await response.json()
      if (data.success && data.settings) {
        // Use current locale as fallback if database doesn't have ui_language set
        const uiLang = data.settings.ui_language || currentLocale
        setDefaultLanguage(data.settings.default_training_language || 'en')
        setUiLanguage(uiLang)
        setTheoryRecordingOptions(data.settings.theory_recording_options || ['audio', 'audio_video'])
        setServicePracticeRecordingOptions(data.settings.service_practice_recording_options || ['audio', 'audio_video'])
        setShowSessionNamesToEmployees(data.settings.show_session_names_to_employees || false)

        // Set cookie for server-side locale detection
        document.cookie = `NEXT_LOCALE=${uiLang}; path=/; max-age=31536000; SameSite=Lax`
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
      const response = await fetch('/api/settings/company-settings', {
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

  const handleUiLanguageChange = async (languageCode: string) => {
    setSavingUiLanguage(true)
    try {
      const response = await fetch('/api/settings/company-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          ui_language: languageCode
        })
      })

      const data = await response.json()
      if (data.success) {
        setUiLanguage(languageCode)
        console.log('✅ UI language updated to:', languageCode)

        // Set cookie for server-side locale detection
        document.cookie = `NEXT_LOCALE=${languageCode}; path=/; max-age=31536000; SameSite=Lax`

        // Reload page to apply new language
        window.location.reload()
      } else {
        alert('Failed to update UI language')
      }
    } catch (error) {
      console.error('Failed to update UI language:', error)
      alert('Failed to update UI language')
    } finally {
      setSavingUiLanguage(false)
    }
  }

  const handleRecordingOptionsChange = async (scenarioType: 'theory' | 'service_practice', options: string[]) => {
    setSavingRecordingOptions(true)
    try {
      const settingKey = scenarioType === 'theory' ? 'theory_recording_options' : 'service_practice_recording_options'
      const response = await fetch('/api/settings/company-settings', {
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
      const response = await fetch('/api/settings/company-settings', {
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
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (!companyId) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <UserHeader
              title={t('manager.settings.general')}
              subtitle={t('manager.settings.generalDescription')}
            />
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-red-800 mb-2">{t('header.companyIdMissing')}</h2>
              <p className="text-red-700">{t('header.companyIdMissing')}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <UserHeader
            title={t('manager.settings.general')}
            subtitle={t('manager.settings.generalDescription')}
          />

          {loading ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">{t('manager.settings.loadingSettings')}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Default Language Section */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('manager.settings.defaultTrainingLanguage')}</h2>
                <p className="text-sm text-gray-600 mb-4">
                  {t('manager.settings.defaultTrainingLanguageDescription')}
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

              {/* UI Language Section */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('manager.settings.uiLanguage')}</h2>
                <p className="text-sm text-gray-600 mb-4">
                  {t('manager.settings.uiLanguageDescription')}
                </p>

                <div className="max-w-md">
                  <div className="relative">
                    <select
                      value={uiLanguage}
                      onChange={(e) => handleUiLanguageChange(e.target.value)}
                      disabled={savingUiLanguage}
                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md disabled:bg-gray-100"
                    >
                      <option value="en">🇬🇧 English</option>
                      <option value="ru">🇷🇺 Русский (Russian)</option>
                      <option value="it">🇮🇹 Italiano (Italian)</option>
                    </select>
                    {savingUiLanguage && (
                      <div className="absolute right-8 top-2.5">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    ⚠️ {t('manager.settings.uiLanguageReloadWarning')}
                  </p>
                </div>
              </div>

              {/* Session Names Visibility Section */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('manager.settings.sessionNamesVisibility')}</h2>
                <p className="text-sm text-gray-600 mb-4">
                  {t('manager.settings.sessionNamesVisibilityDescription')}
                </p>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1">
                    <div className="flex items-center mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {t('manager.settings.showActualNames')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {showSessionNamesToEmployees
                        ? t('manager.settings.showActualNamesDescription')
                        : t('manager.settings.showGenericNames')}
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
                    <strong>Note:</strong> {t('manager.settings.sessionNamesNote')}
                  </p>
                </div>
              </div>

              {/* Recording Options Section */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('manager.settings.recordingOptions')}</h2>
                <p className="text-sm text-gray-600 mb-6">
                  {t('manager.settings.recordingOptionsDescription')}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Theory Q&A Recording Options */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-900 mb-3">
                      📖 {t('scenario.theory')}
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
                        <span className="ml-2 text-sm text-gray-700">🎤 {t('manager.settings.audioRecording')}</span>
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
                        <span className="ml-2 text-sm text-gray-700">🎥 {t('manager.settings.videoRecording')}</span>
                      </label>
                    </div>
                    {savingRecordingOptions && (
                      <div className="mt-2 flex items-center text-xs text-gray-500">
                        <div className="animate-spin h-3 w-3 border-2 border-blue-500 rounded-full border-t-transparent mr-2"></div>
                        {t('common.saving')}
                      </div>
                    )}
                  </div>

                  {/* Service Practice Recording Options */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-900 mb-3">
                      🗣️ {t('scenario.servicePractice')}
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
                        <span className="ml-2 text-sm text-gray-700">🎤 {t('manager.settings.audioRecording')}</span>
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
                        <span className="ml-2 text-sm text-gray-700">🎥 {t('manager.settings.videoRecording')}</span>
                      </label>
                    </div>
                    {savingRecordingOptions && (
                      <div className="mt-2 flex items-center text-xs text-gray-500">
                        <div className="animate-spin h-3 w-3 border-2 border-blue-500 rounded-full border-t-transparent mr-2"></div>
                        {t('common.saving')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-xs text-blue-700">
                    <strong>Note:</strong> {t('manager.settings.recordingOptionsNote')}
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
