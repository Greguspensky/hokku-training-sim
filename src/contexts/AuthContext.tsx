'use client'

import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { signOut as authSignOut } from '@/lib/auth'

interface ExtendedUser extends User {
  role?: string
  company_id?: string
  company_name?: string
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
 * Helper to add timeout to any promise
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutError: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutError)), timeoutMs)
    )
  ])
}

/**
 * Consolidated user enrichment - single DB call with upsert
 * Replaces ensureUserRecord + enrichUserWithDbInfo
 */
async function getOrCreateUserData(authUser: User): Promise<ExtendedUser> {
  try {
    console.log('🔍 Getting/creating user data for:', authUser.email)

    // Determine role based on email
    const role = authUser.email?.includes('emp') ? 'employee' : 'manager'

    // Try to get existing user data first (fast path) with 3s timeout
    const fetchPromise = supabase
      .from('users')
      .select('role, company_id')
      .eq('id', authUser.id)
      .maybeSingle()

    const { data: existingUser, error: fetchError } = await withTimeout(
      fetchPromise,
      3000,
      'Database fetch timeout'
    )

    if (existingUser) {
      console.log('✅ Found existing user:', existingUser.role)

      // Fetch company name separately if company_id exists
      let companyName: string | undefined
      if (existingUser.company_id) {
        try {
          const { data: company, error: companyError } = await supabase
            .from('companies')
            .select('name')
            .eq('id', existingUser.company_id)
            .single()

          if (companyError) {
            // Silently handle 406 or other RLS errors - company name is optional
            console.debug('Company name fetch skipped (RLS or permissions issue)')
          } else {
            companyName = company?.name
          }
        } catch (err) {
          // Suppress company fetch errors - this is not critical for auth
          console.debug('Could not load company name:', err)
        }
      }

      // For employees, fetch the employee record ID
      let employeeRecordId: string | undefined
      if (existingUser.role === 'employee') {
        try {
          const { data: employeeRecord, error: employeeError } = await supabase
            .from('employees')
            .select('id')
            .eq('user_id', authUser.id)
            .maybeSingle()

          if (employeeError) {
            console.debug('Employee record fetch error:', employeeError)
          } else if (employeeRecord) {
            employeeRecordId = employeeRecord.id
            console.log('✅ Found employee record ID:', employeeRecordId)
          } else {
            console.warn('⚠️ No employee record found for user:', authUser.id)
          }
        } catch (err) {
          console.debug('Could not load employee record:', err)
        }
      }

      return {
        ...authUser,
        role: existingUser.role,
        company_id: existingUser.company_id,
        company_name: companyName,
        employee_record_id: employeeRecordId
      }
    }

    // User doesn't exist - create via RPC (bypasses RLS) with 3s timeout
    console.log('📝 Creating new user record via RPC...')
    const rpcPromise = supabase.rpc('create_user_record', {
      user_id: authUser.id,
      user_email: authUser.email || '',
      user_name: authUser.email?.split('@')[0] || 'Unknown',
      user_role: role
    })

    const { data: result, error: rpcError } = await withTimeout(
      rpcPromise,
      3000,
      'User creation timeout'
    )

    if (rpcError) {
      console.error('❌ RPC error:', rpcError.message)
      throw rpcError
    }

    if (!result?.success) {
      console.error('❌ User creation failed:', result?.error)
      throw new Error(result?.error || 'User creation failed')
    }

    console.log('✅ Created new user:', role)

    // Fetch the newly created user data with 2s timeout
    const newUserPromise = supabase
      .from('users')
      .select('role, company_id')
      .eq('id', authUser.id)
      .single()

    const { data: newUser } = await withTimeout(
      newUserPromise,
      2000,
      'New user fetch timeout'
    )

    if (newUser) {
      // Fetch company name separately if company_id exists
      let companyName: string | undefined
      if (newUser.company_id) {
        try {
          const { data: company } = await supabase
            .from('companies')
            .select('name')
            .eq('id', newUser.company_id)
            .single()
          companyName = company?.name
        } catch (err) {
          console.warn('Could not load company name:', err)
        }
      }

      // For employees, fetch the employee record ID
      let employeeRecordId: string | undefined
      if (newUser.role === 'employee') {
        try {
          const { data: employeeRecord } = await supabase
            .from('employees')
            .select('id')
            .eq('user_id', authUser.id)
            .maybeSingle()

          if (employeeRecord) {
            employeeRecordId = employeeRecord.id
            console.log('✅ Found employee record ID for new user:', employeeRecordId)
          }
        } catch (err) {
          console.debug('Could not load employee record:', err)
        }
      }

      return {
        ...authUser,
        role: newUser.role,
        company_id: newUser.company_id,
        company_name: companyName,
        employee_record_id: employeeRecordId
      }
    }

    // Fallback - return user with determined role
    return { ...authUser, role }

  } catch (error: any) {
    const isTimeout = error?.message?.includes('timeout')
    if (isTimeout) {
      console.warn('⚠️ Database timeout, using fallback role from email')
    } else {
      console.error('❌ Error in getOrCreateUserData:', error)
    }

    // Graceful degradation - return auth user with inferred role
    const fallbackRole = authUser.email?.includes('emp') ? 'employee' : 'manager'

    // For employees, try to fetch employee_record_id even in fallback
    let employeeRecordId: string | undefined
    if (fallbackRole === 'employee') {
      try {
        console.log('🔄 Attempting to fetch employee_record_id in fallback...')
        const { data: employeeRecord } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', authUser.id)
          .maybeSingle()

        if (employeeRecord) {
          employeeRecordId = employeeRecord.id
          console.log('✅ Fallback: Found employee record ID:', employeeRecordId)
        } else {
          console.warn('⚠️ Fallback: No employee record found')
        }
      } catch (err) {
        console.debug('Fallback: Could not load employee record:', err)
      }
    }

    return { ...authUser, role: fallbackRole, employee_record_id: employeeRecordId }
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
      if (mounted && loading && !enrichmentInProgress.current) {
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

            // Only stop loading if we have complete user data (including company_id)
            // or if this is an employee (employees don't need company_id for some pages)
            const hasCompleteData = enrichedUser.company_id || enrichedUser.role === 'employee'
            if (hasCompleteData) {
              setLoading(false)
              clearTimeout(masterTimeout)
            } else {
              console.warn('⚠️ User enriched but missing company_id, keeping loading state')
            }
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

              // Only stop loading if we have complete user data
              const hasCompleteData = enrichedUser.company_id || enrichedUser.role === 'employee'
              if (hasCompleteData) {
                setLoading(false)
              } else {
                console.warn('⚠️ User enriched but missing company_id, keeping loading state')
              }

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
