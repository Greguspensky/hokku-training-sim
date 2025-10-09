'use client'

import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { signOut as authSignOut } from '@/lib/auth'

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

/**
 * Consolidated user enrichment - single DB call with upsert
 * Replaces ensureUserRecord + enrichUserWithDbInfo
 */
async function getOrCreateUserData(authUser: User): Promise<ExtendedUser> {
  try {
    console.log('🔍 Getting/creating user data for:', authUser.email)

    // Determine role based on email
    const role = authUser.email?.includes('emp') ? 'employee' : 'manager'

    // Try to get existing user data first (fast path)
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('id', authUser.id)
      .maybeSingle()

    if (existingUser) {
      console.log('✅ Found existing user:', existingUser.role)
      return {
        ...authUser,
        role: existingUser.role,
        company_id: existingUser.company_id
      }
    }

    // User doesn't exist - create via RPC (bypasses RLS)
    console.log('📝 Creating new user record via RPC...')
    const { data: result, error: rpcError } = await supabase.rpc('create_user_record', {
      user_id: authUser.id,
      user_email: authUser.email || '',
      user_name: authUser.email?.split('@')[0] || 'Unknown',
      user_role: role
    })

    if (rpcError) {
      console.error('❌ RPC error:', rpcError.message)
      throw rpcError
    }

    if (!result?.success) {
      console.error('❌ User creation failed:', result?.error)
      throw new Error(result?.error || 'User creation failed')
    }

    console.log('✅ Created new user:', role)

    // Fetch the newly created user data
    const { data: newUser } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('id', authUser.id)
      .single()

    if (newUser) {
      return {
        ...authUser,
        role: newUser.role,
        company_id: newUser.company_id
      }
    }

    // Fallback - return user with determined role
    return { ...authUser, role }

  } catch (error) {
    console.error('❌ Error in getOrCreateUserData:', error)
    // Graceful degradation - return basic auth user
    return authUser
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ExtendedUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Track enrichment to prevent duplicates
  const enrichmentInProgress = useRef(false)
  const currentUserId = useRef<string | null>(null)

  useEffect(() => {
    console.log('🔵 AuthProvider: Initializing')
    let mounted = true

    // Single master timeout for entire auth initialization
    const masterTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('⚠️ Auth initialization timeout (10s), proceeding without auth')
        setLoading(false)
      }
    }, 10000)

    async function initialize() {
      try {
        // Get current user from Supabase
        const { data: { user: authUser }, error } = await supabase.auth.getUser()

        if (!mounted) return

        if (error || !authUser) {
          console.log('ℹ️ No authenticated user')
          setUser(null)
          setLoading(false)
          clearTimeout(masterTimeout)
          return
        }

        console.log('✅ Auth user found:', authUser.email)

        // Enrich with database info (only if not already in progress)
        if (!enrichmentInProgress.current) {
          enrichmentInProgress.current = true
          currentUserId.current = authUser.id

          const enrichedUser = await getOrCreateUserData(authUser)

          if (mounted) {
            setUser(enrichedUser)
            setLoading(false)
            clearTimeout(masterTimeout)
          }

          enrichmentInProgress.current = false
        }

      } catch (error) {
        console.error('❌ Auth initialization error:', error)
        if (mounted) {
          setUser(null)
          setLoading(false)
          clearTimeout(masterTimeout)
        }
      }
    }

    initialize()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔔 Auth state change:', event, '- user:', session?.user?.email)

        if (!mounted) return

        if (event === 'SIGNED_OUT') {
          setUser(null)
          setLoading(false)
          currentUserId.current = null
          return
        }

        if (session?.user) {
          const userId = session.user.id

          // Skip enrichment if same user and already enriched
          if (userId === currentUserId.current && user?.role) {
            console.log('ℹ️ Same user, skipping re-enrichment')
            return
          }

          // Prevent duplicate enrichment calls
          if (enrichmentInProgress.current) {
            console.log('ℹ️ Enrichment in progress, skipping')
            return
          }

          enrichmentInProgress.current = true
          currentUserId.current = userId

          try {
            const enrichedUser = await getOrCreateUserData(session.user)

            if (mounted) {
              setUser(enrichedUser)
              setLoading(false)

              // Handle role-based redirect on sign-in
              if (event === 'SIGNED_IN' && typeof window !== 'undefined') {
                const currentPath = window.location.pathname
                if (currentPath === '/signin') {
                  const targetPath = enrichedUser.role === 'employee' ? '/employee' : '/manager'
                  console.log('🚀 Redirecting to', targetPath)
                  window.location.href = targetPath
                }
              }
            }
          } finally {
            enrichmentInProgress.current = false
          }
        } else {
          setUser(null)
          setLoading(false)
          currentUserId.current = null
        }
      }
    )

    return () => {
      console.log('🧹 AuthProvider: Cleanup')
      mounted = false
      clearTimeout(masterTimeout)
      subscription?.unsubscribe()
    }
  }, []) // Empty deps - only run once

  const signOut = async () => {
    try {
      console.log('🚪 Signing out...')
      const result = await authSignOut()

      if (result.success) {
        setUser(null)
        currentUserId.current = null
        window.location.href = '/signin'
      } else {
        console.error('❌ Sign out failed:', result.error)
        alert(`Sign out failed: ${result.error}`)
      }
    } catch (error) {
      console.error('❌ Sign out error:', error)
      alert('An error occurred while signing out')
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
