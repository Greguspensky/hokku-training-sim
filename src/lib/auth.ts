import { supabase } from './supabase'

export async function signUp(email: string, password: string, name: string, role: 'manager' | 'employee') {
  try {
    console.log('Attempting signup with:', { email, name, role })
    
    // Sign up user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined // Disable email confirmation
      }
    })

    console.log('Auth signup result:', { authData, authError })

    if (authError) throw authError
    if (!authData.user) throw new Error('No user returned')

    // Create user profile
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        name,
        role
      })

    console.log('Profile creation result:', { profileError })

    if (profileError) throw profileError

    return { success: true, user: authData.user }
  } catch (error: any) {
    console.error('Signup error:', error)
    return { success: false, error: error.message || 'Unknown error occurred' }
  }
}

export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) throw error

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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) throw error
    return profile
  } catch (error) {
    return null
  }
}