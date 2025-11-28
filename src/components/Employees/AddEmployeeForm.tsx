'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface AddEmployeeFormProps {
  companyId: string
  onSuccess?: () => void
  onCancel?: () => void
}

export default function AddEmployeeForm({ companyId, onSuccess, onCancel }: AddEmployeeFormProps) {
  const t = useTranslations('employees')
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError(t('employeeNameRequired'))
      return
    }

    console.log('📝 AddEmployeeForm - Creating invite with:', { name: name.trim(), company_id: companyId })

    setIsSubmitting(true)
    setError(null)

    try {
      const payload = {
        name: name.trim(),
        company_id: companyId
      }
      console.log('📤 Sending POST to /api/employees with payload:', payload)

      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()
      console.log('📥 API response:', data)

      if (!data.success) {
        throw new Error(data.error || t('failedToCreateInvite'))
      }

      setInviteLink(data.invite_link)
    } catch (error) {
      setError(error instanceof Error ? error.message : t('failedToCreateInvite'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const copyInviteLink = async () => {
    if (inviteLink) {
      try {
        await navigator.clipboard.writeText(inviteLink)
        // You could show a toast notification here
      } catch (error) {
        console.error('Failed to copy invite link:', error)
      }
    }
  }

  const handleFinish = () => {
    setName('')
    setInviteLink(null)
    setError(null)
    onSuccess?.()
  }

  if (inviteLink) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center">
            <svg className="h-5 w-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-green-600 font-medium">{t('inviteCreatedSuccessfully')}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('inviteLink')}
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={inviteLink}
              readOnly
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
            />
            <button
              onClick={copyInviteLink}
              className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {t('copy')}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {t('shareInviteLinkDescription')}
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <p className="text-sm text-blue-700">
            <strong>{t('nextSteps')}</strong><br />
            • {t('sendLinkTo', { name })}<br />
            • {t('theyWillCreateAccount')}<br />
            • {t('assignTracksOnceJoined')}
          </p>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            onClick={handleFinish}
            className="bg-green-600 text-white px-4 py-2 text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            {t('done')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
          {t('employeeName')}
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t('enterFullName')}
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          {t('nameWillAppear')}
        </p>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {t('cancel')}
          </button>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{t('creatingInvite')}</span>
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>{t('createInvite')}</span>
            </>
          )}
        </button>
      </div>
    </form>
  )
}