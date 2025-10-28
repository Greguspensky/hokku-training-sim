'use client'

/**
 * Manager Settings - Main Settings Page
 *
 * Central hub for all manager settings with navigation to sub-pages
 * Created: 2025-10-28
 */

import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import UserHeader from '@/components/UserHeader'
import { Settings, Mic, Languages, ChevronRight } from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  const settingsPages = [
    {
      title: 'General Settings',
      description: 'Configure default language and recording options for training sessions',
      icon: Settings,
      href: '/manager/settings/general',
      color: 'bg-blue-100 text-blue-600'
    },
    {
      title: 'Voice Settings',
      description: 'Manage ElevenLabs voices for different languages',
      icon: Mic,
      href: '/manager/settings/voices',
      color: 'bg-purple-100 text-purple-600'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      <UserHeader />

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="mt-2 text-gray-600">
              Manage your training system configuration and preferences.
            </p>
          </div>

          {/* Settings Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {settingsPages.map((setting) => {
              const Icon = setting.icon
              return (
                <button
                  key={setting.href}
                  onClick={() => router.push(setting.href)}
                  className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6 text-left group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className={`flex-shrink-0 ${setting.color} p-3 rounded-lg`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {setting.title}
                        </h3>
                        <p className="mt-2 text-sm text-gray-600">
                          {setting.description}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0 ml-4" />
                  </div>
                </button>
              )
            })}
          </div>

          {/* Quick Stats or Info (Optional) */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Tip:</strong> Changes to settings will apply to all new training sessions. Existing sessions will not be affected.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
