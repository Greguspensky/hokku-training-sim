'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getCurrentUser, signOut } from '@/lib/auth'
import LanguageSwitcher from '@/components/LanguageSwitcher'

interface User {
  id: string
  email: string
  name: string
  role: string
}

export default function DashboardPage() {
  const t = useTranslations()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function loadUser() {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        router.push('/auth')
        return
      }
      setUser(currentUser)
      setLoading(false)
    }
    loadUser()
  }, [router])

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Hokku Training Simulator
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <LanguageSwitcher />
              <span className="text-sm text-gray-700">
                {t('common.welcome')}, {user?.name}
              </span>
              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                {user?.role}
              </span>
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {t('navigation.signOut')}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-medium text-gray-900 mb-4">
                {t('dashboard.welcome')}
              </h2>
              <p className="text-gray-600 mb-8">
                {t('dashboard.subtitle')}
              </p>
              <div className="space-y-4">
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    🎭 {t('dashboard.rolePlay.title')}
                  </h3>
                  <p className="text-gray-600">
                    {t('dashboard.rolePlay.description')}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    📊 {t('dashboard.performance.title')}
                  </h3>
                  <p className="text-gray-600">
                    {t('dashboard.performance.description')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}