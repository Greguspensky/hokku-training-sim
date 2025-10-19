'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LogoutPage() {
  const router = useRouter()
  const [status, setStatus] = useState('Signing out...')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const signOut = async () => {
      try {
        console.log('🚪 Starting logout process...')
        setStatus('Clearing session...')

        // Sign out from Supabase
        const { error: signOutError } = await supabase.auth.signOut()

        if (signOutError) {
          console.error('❌ Logout error:', signOutError)
          setError(signOutError.message)
          setStatus('Error signing out')
        } else {
          console.log('✅ Signed out successfully')
          setStatus('Signed out successfully!')

          // Clear any cached user data from localStorage
          try {
            const keys = Object.keys(localStorage)
            keys.forEach(key => {
              if (key.startsWith('user_cache_') || key.startsWith('supabase.auth.')) {
                localStorage.removeItem(key)
                console.log('🗑️ Cleared cache:', key)
              }
            })
          } catch (err) {
            console.debug('Could not clear localStorage:', err)
          }

          // Wait a moment then redirect
          setTimeout(() => {
            router.push('/signin')
          }, 1500)
        }
      } catch (err) {
        console.error('❌ Unexpected logout error:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        setStatus('Error during logout')
      }
    }

    signOut()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          {error ? (
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          ) : status === 'Signed out successfully!' ? (
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {error ? 'Logout Error' : status === 'Signed out successfully!' ? 'Signed Out' : 'Signing Out'}
        </h1>

        <p className="text-gray-600 mb-6">
          {error ? error : status}
        </p>

        {error && (
          <div className="space-y-3">
            <button
              onClick={() => window.location.href = '/signin'}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Sign In
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {status === 'Signed out successfully!' && (
          <p className="text-sm text-gray-500">
            Redirecting to sign in...
          </p>
        )}
      </div>
    </div>
  )
}
