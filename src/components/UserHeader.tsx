'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface UserHeaderProps {
  title?: string
  subtitle?: string
  hideProfile?: boolean
}

export default function UserHeader({ title, subtitle, hideProfile = false }: UserHeaderProps) {
  const { user, signOut } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)

  if (!user) return null

  const getRoleDisplay = (role?: string) => {
    return role === 'manager' ? 'Manager' : 'User'
  }

  const getInitials = (name?: string) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2)
  }

  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowDropdown(false)

    if (confirm('Are you sure you want to sign out?')) {
      await signOut()
    }
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {title && (
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
            {subtitle && (
              <p className="text-gray-600 mt-2">{subtitle}</p>
            )}
          </div>
        )}

        {/* User Profile Dropdown */}
        {!hideProfile && (
          <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center space-x-3 bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-2 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {/* Avatar */}
            <div className="flex-shrink-0 h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {getInitials(user.email?.split('@')[0] || 'User')}
              </span>
            </div>

            {/* User Info */}
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900">{user.email?.split('@')[0] || 'User'}</p>
              <p className="text-xs text-gray-500">{getRoleDisplay(user.role)}</p>
            </div>

            {/* Dropdown Arrow */}
            <svg
              className={`h-4 w-4 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowDropdown(false)}
              />

              {/* Menu */}
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-white">
                        {getInitials(user.email?.split('@')[0] || 'User')}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{user.email?.split('@')[0] || 'User'}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                      {user.company_name && (
                        <p className="text-xs text-gray-600 mt-1">🏢 {user.company_name}</p>
                      )}
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          user.role === 'manager'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {getRoleDisplay(user.role)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-2">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center w-full px-3 py-2 text-sm text-red-700 hover:bg-red-50 rounded-md"
                  >
                    <svg className="h-4 w-4 mr-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
          </div>
        )}
      </div>
    </div>
  )
}