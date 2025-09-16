import { supabase } from './supabase'

export interface User {
  id: string
  email: string
  name: string
  role: 'manager' | 'employee'
  company_id?: string
  employee_record_id?: string
  created_at?: string
  updated_at?: string
}

// Simple sign in - just authenticate with Supabase
export async function signIn(email: string, password: string) {
  console.log('🔐 Simple signIn called with:', email)

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      console.error('🔐 Supabase auth error:', error)
      return { success: false, error: error.message }
    }

    if (!data.user) {
      return { success: false, error: 'No user returned' }
    }

    console.log('🔐 Sign-in successful:', data.user.id)

    // Just return success - let Supabase handle the session
    return { success: true, user: data.user }
  } catch (error: any) {
    console.error('🔐 Sign-in exception:', error)
    return { success: false, error: error.message }
  }
}

export async function signUp(email: string, password: string, name: string, role: 'manager' | 'employee') {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined
      }
    })

    if (error) throw error
    if (!data.user) throw new Error('No user returned')

    return { success: true, user: data.user }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null
    return user
  } catch (error) {
    return null
  }
}