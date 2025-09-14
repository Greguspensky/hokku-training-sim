'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { signUp, signIn } from '@/lib/auth'
import LanguageSwitcher from '@/components/LanguageSwitcher'

export default function AuthPage() {
  const t = useTranslations('auth')
  const [isLogin, setIsLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role] = useState<'manager' | 'employee'>('employee')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (isLogin) {
        const result = await signIn(email, password)
        if (result.success) {
          setMessage('Signed in successfully!')
          router.push('/dashboard')
        } else {
          setMessage(result.error || 'Sign in failed')
        }
      } else {
        const result = await signUp(email, password, name, role)
        if (result.success) {
          setMessage('Account created successfully! Please check your email to confirm.')
        } else {
          setMessage(result.error || 'Sign up failed')
        }
      }
    } catch (error) {
      setMessage('An unexpected error occurred')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="max-w-md w-full bg-slate-800 rounded-xl shadow-2xl p-8 border border-slate-700">
        <h2 className="text-3xl font-bold text-center text-white mb-8">
          {t('title')}
        </h2>

        <div className="flex mb-6 bg-slate-700 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
              !isLogin 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {t('signUp')}
          </button>
          <button
            type="button"
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
              isLogin 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {t('signIn')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('fullName')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
                placeholder={t('placeholders.fullName')}
                required
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('emailAddress')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
              placeholder={t('placeholders.email')}
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
              placeholder={t('placeholders.password')}
              required
              minLength={6}
            />
          </div>

          {message && (
            <div className={`text-sm p-3 rounded-lg ${message.includes('success') ? 'bg-green-900 text-green-200 border border-green-700' : 'bg-red-900 text-red-200 border border-red-700'}`}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password || (!isLogin && !name)}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {isLogin ? t('signingIn') : t('creatingAccount')}
              </span>
            ) : (
              isLogin ? t('signIn') : t('createAccount')
            )}
          </button>
        </form>
      </div>
    </div>
  )
}