'use client'

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { RecordingPreference } from '@/lib/training-sessions'

interface RecordingConsentProps {
  onSelectionChange: (preference: RecordingPreference) => void
  selectedPreference?: RecordingPreference
  className?: string
}

export function RecordingConsent({
  onSelectionChange,
  selectedPreference = 'none',
  className = ''
}: RecordingConsentProps) {
  const t = useTranslations('training')
  const [selected, setSelected] = useState<RecordingPreference>(selectedPreference)

  const handleSelectionChange = (preference: RecordingPreference) => {
    setSelected(preference)
    onSelectionChange(preference)
  }

  const options = [
    {
      value: 'none' as RecordingPreference,
      title: t('recording.options.noneWithEmoji'),
      description: t('recording.descriptions.none'),
      icon: '🚫',
      privacy: t('recording.privacy.none')
    },
    {
      value: 'audio' as RecordingPreference,
      title: t('recording.options.audioWithEmoji'),
      description: t('recording.descriptions.audio'),
      icon: '🎤',
      privacy: t('recording.privacy.audio')
    },
    {
      value: 'audio_video' as RecordingPreference,
      title: t('recording.options.audioVideoWithEmoji'),
      description: t('recording.descriptions.audioVideo'),
      icon: '🎥',
      privacy: t('recording.privacy.audioVideo')
    }
  ]

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {t('recording.preferencesTitle')}
        </h3>
        <p className="text-gray-600 text-sm">
          {t('recording.chooseDescription')}
        </p>
      </div>

      <div className="space-y-4">
        {options.map((option) => (
          <label
            key={option.value}
            className={`
              flex items-start p-4 rounded-lg border-2 cursor-pointer transition-all duration-200
              ${selected === option.value
                ? 'border-blue-500 bg-blue-50 shadow-sm'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }
            `}
          >
            <input
              type="radio"
              name="recording-preference"
              value={option.value}
              checked={selected === option.value}
              onChange={() => handleSelectionChange(option.value)}
              className="sr-only"
            />

            <div className="flex-shrink-0 text-2xl mr-4">
              {option.icon}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <h4 className={`font-medium ${
                  selected === option.value ? 'text-blue-900' : 'text-gray-900'
                }`}>
                  {option.title}
                </h4>
                {selected === option.value && (
                  <div className="flex-shrink-0 text-blue-600">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>

              <p className={`text-sm mb-3 ${
                selected === option.value ? 'text-blue-800' : 'text-gray-600'
              }`}>
                {option.description}
              </p>

              <div className={`text-xs p-2 rounded ${
                selected === option.value ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}>
                <span className="font-medium">{t('recording.privacy.label')}</span> {option.privacy}
              </div>
            </div>
          </label>
        ))}
      </div>

      {/* Privacy Notice */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-start">
          <div className="flex-shrink-0 text-blue-600 mr-3">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1 text-sm">
            <h5 className="font-medium text-gray-900 mb-1">{t('recording.privacy.title')}</h5>
            <p className="text-gray-600">
              {t('recording.privacy.description')}
            </p>
          </div>
        </div>
      </div>

      {/* Current Selection Summary */}
      {selected !== 'none' && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center text-sm text-blue-800">
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">
              {t('recording.consentGranted')} {options.find(opt => opt.value === selected)?.title}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}