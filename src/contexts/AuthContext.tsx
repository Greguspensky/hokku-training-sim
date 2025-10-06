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

  console.log('🔵 AuthProvider: Component rendered, loading:', loading, 'user:', !!user)

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
    console.log('🔵 AuthProvider: useEffect started - checking auth state')
    let isSubscribed = true

    // Set a timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      console.warn('⚠️ AuthProvider: Session check timeout (5s), setting loading to false')
      if (isSubscribed) {
        setLoading(false)
      }
    }, 5000) // 5 second timeout

    // Get initial session - using getUser() for better reliability
    const checkAuth = async () => {
      try {
        console.log('🔍 AuthProvider: Calling supabase.auth.getUser()...')

        // Race the getUser() call against the timeout
        const getUserPromise = supabase.auth.getUser()
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('getUser timeout')), 4000)
        )

        const { data: { user: authUser }, error } = await Promise.race([
          getUserPromise,
          timeoutPromise
        ]) as any

        if (!isSubscribed) {
          console.log('⚠️ AuthProvider: Component unmounted, skipping auth check')
          return
        }

        clearTimeout(loadingTimeout) // Clear timeout if check completes

        if (error) {
          console.error('❌ AuthProvider: Error getting user:', error)
          setUser(null)
          setLoading(false)
          return
        }

        console.log('✅ AuthProvider: getUser() completed:', !!authUser, 'email:', authUser?.email)
        if (authUser) {
          const enrichedUser = await enrichUserWithDbInfo(authUser)
          setUser(enrichedUser)
        } else {
          setUser(null)
        }
        setLoading(false)
      } catch (error: any) {
        clearTimeout(loadingTimeout)
        console.warn('⚠️ AuthProvider: getUser() timed out or failed, will rely on auth state events:', error.message)
        if (isSubscribed) {
          console.log('⏳ Waiting for auth state change events to update user state...')

          // Fallback: If auth state event doesn't fire within 3 seconds, set loading to false anyway
          // Increased from 2s to 3s to allow time for user enrichment (up to 1.5s with retries)
          setTimeout(() => {
            if (isSubscribed && loading) {
              console.warn('⚠️ Auth state event did not fire or complete, setting loading to false as fallback')
              setLoading(false)
            }
          }, 3000)
        }
      }
    }

    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔔 AuthProvider: Auth state changed:', event, 'has session:', !!session, 'has user:', !!session?.user, 'email:', session?.user?.email, 'current path:', typeof window !== 'undefined' ? window.location.pathname : 'unknown')

        if (!isSubscribed) {
          console.log('⚠️ AuthProvider: Component unmounted, ignoring auth change')
          return
        }

        // Only update user state if the user ID actually changed
        if (session?.user) {
          console.log('🔄 Enriching user from auth state change...')
          const enrichedUser = await enrichUserWithDbInfo(session.user)

          // Only update if user changed to prevent infinite loops
          setUser(prevUser => {
            if (prevUser?.id === enrichedUser.id) {
              console.log('✅ User unchanged, skipping state update')
              return prevUser
            }
            console.log('✅ User changed, updating state to:', enrichedUser.email)
            return enrichedUser
          })
        } else {
          console.log('⚠️ No user in session, setting user to null')
          setUser(null)
        }

        console.log('📍 Setting loading to false after auth state change')
        setLoading(false)

        // Handle role-based redirect only on successful sign-in
        if (event === 'SIGNED_IN' && session?.user && typeof window !== 'undefined') {
          const currentPath = window.location.pathname
          console.log('🔐 SIGNED_IN on path:', currentPath)

          // Only redirect if on signin page
          if (currentPath === '/signin') {
            const isEmployeeUser = session.user.email?.includes('emp') || false
            const targetPath = isEmployeeUser ? '/employee' : '/manager'
            console.log('🚀 Redirecting from signin to', targetPath)
            window.location.href = targetPath
          }
        }
      }
    )

    return () => {
      console.log('🧹 AuthProvider: Cleaning up useEffect')
      isSubscribed = false
      clearTimeout(loadingTimeout) // Clean up timeout on unmount
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