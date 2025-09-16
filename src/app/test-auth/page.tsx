'use client'

import { useState } from 'react'
import { signUp, signIn } from '@/lib/auth'

export default function TestAuth() {
  const [email, setEmail] = useState('test@example.com')
  const [password, setPassword] = useState('test123456')
  const [name, setName] = useState('Test User')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handleSignUp = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await signUp(email, password, name, 'manager')
      setResult({ type: 'signup', result: res })
    } catch (error) {
      setResult({ type: 'signup', error: error.message })
    }
    setLoading(false)
  }

  const handleSignIn = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await signIn(email, password)
      setResult({ type: 'signin', result: res })
    } catch (error) {
      setResult({ type: 'signin', error: error.message })
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">Authentication Test</h1>

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-4">Test Credentials</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-4">Actions</h2>
          <div className="space-x-4">
            <button
              onClick={handleSignUp}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Sign Up'}
            </button>
            <button
              onClick={handleSignIn}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Sign In'}
            </button>
          </div>
        </div>

        {result && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Result</h2>
            <div className="bg-gray-100 p-4 rounded-md">
              <pre className="text-sm overflow-x-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}

        <div className="mt-6 text-center">
          <a href="/" className="text-blue-600 hover:text-blue-800">
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  )
}