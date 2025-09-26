import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client-side Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Server-side Supabase client (for API routes)
export const supabaseServer = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
})

// Admin Supabase client (bypasses RLS) - only use in server-side code
export const supabaseAdmin = (() => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not found, admin operations will fail')
    // Return a mock client that throws meaningful errors
    return {
      from: () => {
        throw new Error('supabaseAdmin is not available: SUPABASE_SERVICE_ROLE_KEY not found')
      },
      rpc: () => {
        throw new Error('supabaseAdmin is not available: SUPABASE_SERVICE_ROLE_KEY not found')
      }
    } as any
  }

  try {
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  } catch (error) {
    console.error('Failed to create supabaseAdmin client:', error)
    return {
      from: () => {
        throw new Error('supabaseAdmin failed to initialize')
      },
      rpc: () => {
        throw new Error('supabaseAdmin failed to initialize')
      }
    } as any
  }
})()