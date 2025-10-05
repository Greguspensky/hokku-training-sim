'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { signOut as authSignOut } from '@/lib/auth'
import { employeeService } from '@/lib/employees'

interface ExtendedUser extends User {
  role?: string
  company_id?: string
  employee_record_id?: string
}

interface AuthContextType {
  user: ExtendedUser | null
  loading: boolean
  signOut: () => Promise<void>
  setUser: (user: ExtendedUser | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Helper function to ensure user record exists in database
async function ensureUserRecord(authUser: User) {
  try {
    // Check if user record exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (!existingUser) {
      // Determine role based on email - employees have "emp" in their email
      const role = authUser.email?.includes('emp') ? 'employee' : 'manager'

      // Use database function to create user record (bypasses RLS)
      const { data: result, error } = await supabase.rpc('create_user_record', {
        user_id: authUser.id,
        user_email: authUser.email || '',
        user_name: authUser.email?.split('@')[0] || 'Unknown',
        user_role: role
      })

      if (error) {
        console.error('Error calling create_user_record function:', error)
      } else if (result?.success) {
        console.log('✅ Created user record on sign-in:', {
          email: authUser.email,
          role: role
        })
      } else {
        console.error('Database function returned error:', result?.error)
      }
    } else {
      console.log('User record already exists:', existingUser.email, existingUser.role)
    }
  } catch (error) {
    console.error('Error ensuring user record:', error)
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ExtendedUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Helper function to enrich user with database info
  const enrichUserWithDbInfo = async (authUser: User): Promise<ExtendedUser> => {
    try {
      // First ensure user record exists (creates if needed)
      await ensureUserRecord(authUser)

      // Then fetch the user data (with retry for new users)
      let retries = 3
      let dbUser = null

      while (retries > 0 && !dbUser) {
        const { data } = await supabase
          .from('users')
          .select('role, company_id')
          .eq('id', authUser.id)
          .single()

        if (data) {
          dbUser = data
          break
        }

        // Wait a bit before retrying (for new user creation)
        if (retries > 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
        retries--
      }

      if (dbUser) {
        console.log('✅ Enriched user with role and company_id:', dbUser.role, dbUser.company_id)
        return {
          ...authUser,
          role: dbUser.role,
          company_id: dbUser.company_id
        }
      } else {
        console.warn('⚠️ Could not fetch user db info after retries')
      }
    } catch (error) {
      console.error('Error fetching user db info:', error)
    }
    return authUser
  }

  useEffect(() => {
    console.log('AuthProvider: Starting simple auth check...')

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('AuthProvider: Initial session:', !!session)
      if (session?.user) {
        const enrichedUser = await enrichUserWithDbInfo(session.user)
        setUser(enrichedUser)
      } else {
        setUser(null)
      }
      setLoading(false)
    }).catch((error) => {
      console.error('AuthProvider: Error getting initial session:', error)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AuthProvider: Auth state changed:', event, !!session, 'email:', session?.user?.email, 'current path:', typeof window !== 'undefined' ? window.location.pathname : 'unknown')

        if (session?.user) {
          const enrichedUser = await enrichUserWithDbInfo(session.user)
          setUser(enrichedUser)
        } else {
          setUser(null)
        }
        setLoading(false)

        // Only redirect on sign-in if we're on the sign-in page
        if (event === 'SIGNED_IN' && session?.user) {
          if (typeof window !== 'undefined' && window.location.pathname === '/signin') {
            console.log('AuthProvider: User signed in, determining role...')

            // Simple role determination based on email
            const isEmployeeUser = session.user.email?.includes('emp') || false

            if (isEmployeeUser) {
              console.log('AuthProvider: Employee detected by email, redirecting to /employee')
              window.location.href = '/employee'
            } else {
              console.log('AuthProvider: Manager detected by email, redirecting to /manager')
              window.location.href = '/manager'
            }
          }
        }
      }
    )

    return () => {
      if (subscription?.unsubscribe) {
        subscription.unsubscribe()
      }
    }
  }, [])

  const signOut = async () => {
    try {
      console.log('🚪 Starting sign out...')
      const result = await authSignOut()

      if (result.success) {
        console.log('✅ Sign out successful, redirecting...')
        // Clear user state immediately
        setUser(null)
        // Redirect to signin
        window.location.href = '/signin'
      } else {
        console.error('❌ Sign out failed:', result.error)
        alert(`Sign out failed: ${result.error}`)
      }
    } catch (error) {
      console.error('❌ Sign out error:', error)
      alert('An error occurred while signing out. Please try again.')
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}