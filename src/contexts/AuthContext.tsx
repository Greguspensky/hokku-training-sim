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
  business_type?: string  // Company's business type for roleplay scenarios
}

interface AuthContextType {
  user: ExtendedUser | null
  loading: boolean
  signOut: () => Promise<void>
  setUser: (user: ExtendedUser | null) => void
  clearAuthCache: () => void
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
 * Cache user data in localStorage to survive page reloads and tab switches
 */
function getCachedUserData(userId: string): ExtendedUser | null {
  if (typeof window === 'undefined') return null

  try {
    const cacheKey = `user_cache_${userId}`
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      const data = JSON.parse(cached)
      const age = Date.now() - data.timestamp
      const maxAge = 30 * 60 * 1000 // 30 minutes (increased from 5 minutes)

      // Only use cache if it's less than 30 minutes old
      if (age < maxAge) {
        // Auto-clear cache if data is incomplete (missing critical fields for managers)
        const user = data.user
        const isManager = user.role === 'manager' || user.email?.includes('admin') || !user.email?.includes('emp')
        const isIncomplete = isManager && !user.company_id

        if (isIncomplete) {
          console.warn('⚠️ Cache contains incomplete data (missing company_id), clearing cache')
          localStorage.removeItem(cacheKey)
          return null
        }

        console.log(`📦 Using cached user data (age: ${Math.round(age/1000)}s)`)
        return user
      } else {
        console.log(`⏰ Cache expired (age: ${Math.round(age/1000)}s)`)
        localStorage.removeItem(cacheKey) // Clear expired cache
      }
    } else {
      console.log(`❌ No cache found for key: ${cacheKey}`)
    }
  } catch (err) {
    console.error('❌ Error reading cached user data:', err)
  }
  return null
}

function setCachedUserData(userId: string, userData: ExtendedUser) {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(`user_cache_${userId}`, JSON.stringify({
      user: userData,
      timestamp: Date.now()
    }))
  } catch (err) {
    console.debug('Could not cache user data:', err)
  }
}

/**
 * Consolidated user enrichment - single DB call with upsert
 * Replaces ensureUserRecord + enrichUserWithDbInfo
 */
async function getOrCreateUserData(authUser: User): Promise<ExtendedUser> {
  try {
    console.log('🔍 Getting/creating user data for:', authUser.email)

    // Try to use cached data first if available
    const cachedData = getCachedUserData(authUser.id)
    if (cachedData) {
      // Still try to fetch fresh data in background, but return cached immediately
      // This prevents the error flash while we're fetching
      setTimeout(() => {
        // Fetch fresh data without blocking
        supabase
          .from('users')
          .select('role, company_id')
          .eq('id', authUser.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              const freshUser = { ...authUser, ...data }
              setCachedUserData(authUser.id, freshUser)
            }
          })
      }, 0)

      return cachedData
    }

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
      10000,  // Increased from 3s to 10s for better reliability after inactivity
      'Database fetch timeout'
    )

    if (existingUser) {
      console.log('✅ Found existing user:', existingUser.role)

      // Fetch company name and business type separately if company_id exists
      let companyName: string | undefined
      let businessType: string | undefined
      if (existingUser.company_id) {
        try {
          const { data: company, error: companyError } = await supabase
            .from('companies')
            .select('name, business_type')
            .eq('id', existingUser.company_id)
            .single()

          if (companyError) {
            // Silently handle 406 or other RLS errors - company info is optional
            console.debug('Company info fetch skipped (RLS or permissions issue)')
          } else {
            companyName = company?.name
            businessType = company?.business_type || 'coffee_shop'
          }
        } catch (err) {
          // Suppress company fetch errors - this is not critical for auth
          console.debug('Could not load company info:', err)
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

      const enrichedUser = {
        ...authUser,
        role: existingUser.role,
        company_id: existingUser.company_id,
        company_name: companyName,
        employee_record_id: employeeRecordId,
        business_type: businessType
      }

      // Cache the successful fetch
      setCachedUserData(authUser.id, enrichedUser)

      return enrichedUser
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
      10000,  // Increased from 3s to 10s for better reliability
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
      10000,  // Increased from 2s to 10s for better reliability
      'New user fetch timeout'
    )

    if (newUser) {
      // Fetch company name and business type separately if company_id exists
      let companyName: string | undefined
      let businessType: string | undefined
      if (newUser.company_id) {
        try {
          const { data: company } = await supabase
            .from('companies')
            .select('name, business_type')
            .eq('id', newUser.company_id)
            .single()
          companyName = company?.name
          businessType = company?.business_type || 'coffee_shop'
        } catch (err) {
          console.warn('Could not load company info:', err)
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

      const enrichedUser = {
        ...authUser,
        role: newUser.role,
        company_id: newUser.company_id,
        company_name: companyName,
        employee_record_id: employeeRecordId,
        business_type: businessType
      }

      // Cache the successful fetch
      setCachedUserData(authUser.id, enrichedUser)

      return enrichedUser
    }

    // Fallback - return user with determined role
    return { ...authUser, role }

  } catch (error: any) {
    const isTimeout = error?.message?.includes('timeout')
    if (isTimeout) {
      console.warn('⚠️ Database timeout, checking cache...')
    } else {
      console.error('❌ Error in getOrCreateUserData:', error)
    }

    // Try to use cached data if available (most important for recovering from timeouts)
    const cachedData = getCachedUserData(authUser.id)
    if (cachedData) {
      console.log('✅ Using cached user data after database error')
      return cachedData
    }

    // Graceful degradation - return auth user with inferred role
    console.warn('⚠️ No cached data available, using fallback role from email')
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
  const lastProcessedEvent = useRef<string | null>(null) // Track last processed event to prevent duplicates

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
          lastProcessedEvent.current = null
          return
        }

        if (session?.user) {
          const userId = session.user.id
          const hasCompleteData = user?.company_id || user?.role === 'employee'

          // Prevent processing duplicate SIGNED_IN events - check THIS FIRST
          // Set the flag immediately for ALL events of this type, regardless of other conditions
          const eventKey = `${event}-${userId}`
          if (event === 'SIGNED_IN') {
            if (lastProcessedEvent.current === eventKey) {
              console.log('⏭️ Skipping duplicate SIGNED_IN event for same user')
              return
            }
            // Set deduplication flag immediately to block ALL subsequent events
            lastProcessedEvent.current = eventKey
            // Increase timeout to 30 seconds to handle slow database responses
            setTimeout(() => {
              if (lastProcessedEvent.current === eventKey) {
                lastProcessedEvent.current = null
              }
            }, 30000)
          }

          // CRITICAL: Check enrichment lock to prevent race conditions
          if (enrichmentInProgress.current) {
            console.log('ℹ️ Enrichment in progress, skipping', event)
            return
          }

          // IMPORTANT: On TOKEN_REFRESHED, if we already have ANY user data, keep it
          // Don't attempt database fetch which might timeout after long inactivity
          if (event === 'TOKEN_REFRESHED') {
            if (userId === currentUserId.current && user) {
              console.log('🔄 Token refreshed - keeping existing user data to avoid timeout')
              // Make sure loading is false if we have the user
              if (!loading && hasCompleteData) {
                return
              }
              // If somehow still loading but we have complete data, stop loading
              if (hasCompleteData) {
                setLoading(false)
                return
              }
            }
          }

          // Skip enrichment if same user and already fully enriched with complete data
          if (userId === currentUserId.current && user?.role && hasCompleteData) {
            console.log('ℹ️ Same user with complete data, skipping re-enrichment')
            return
          }

          // If same user but missing company_id, allow re-enrichment attempt
          if (userId === currentUserId.current && user?.role && !hasCompleteData) {
            console.log('🔄 Same user but missing company_id, attempting re-enrichment...')
          }

          enrichmentInProgress.current = true
          currentUserId.current = userId

          try {
            const enrichedUser = await getOrCreateUserData(session.user)

            if (mounted) {
              // CRITICAL: Don't overwrite good user data with incomplete fallback data
              // If we already have a user with complete data in state, and the new data is incomplete, keep the old data
              const newDataComplete = enrichedUser.company_id || enrichedUser.role === 'employee'
              const existingDataComplete = user?.company_id || user?.role === 'employee'

              if (!newDataComplete && existingDataComplete && user?.id === enrichedUser.id) {
                console.warn('⚠️ Skipping user update - new data incomplete, keeping existing complete data')
                console.log(`   Existing: company_id=${user.company_id}, role=${user.role}`)
                console.log(`   New: company_id=${enrichedUser.company_id}, role=${enrichedUser.role}`)
                setLoading(false) // Stop loading since we have good data already
                return
              }

              setUser(enrichedUser)

              // Only stop loading if we have complete user data
              if (newDataComplete) {
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

  const clearAuthCache = () => {
    try {
      console.log('🧹 Clearing auth cache...')
      const keys = Object.keys(localStorage).filter(k => k.startsWith('user_cache_'))
      keys.forEach(k => localStorage.removeItem(k))
      console.log(`✅ Cleared ${keys.length} cache entries`)
    } catch (err) {
      console.error('❌ Error clearing cache:', err)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut, setUser, clearAuthCache }}>
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
