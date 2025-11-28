import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    // Known employee emails based on the Supabase screenshot
    const knownUsers = [
      { email: 'greg@greg45.com', role: 'manager' },
      { email: 'emp1@greg45.com', role: 'employee' },
      { email: 'emp2@greg45.com', role: 'employee' }
    ]

    const results = []

    for (const userInfo of knownUsers) {
      // Check if user already exists in users table
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', userInfo.email)
        .single()

      if (!existingUser) {
        // Generate a UUID for the user (in real scenario, we'd get this from auth)
        const userId = crypto.randomUUID()

        try {
          // Use raw SQL to bypass RLS temporarily
          const { data, error } = await supabase
            .rpc('create_user_bypass_rls', {
              p_id: userId,
              p_email: userInfo.email,
              p_name: userInfo.email.split('@')[0],
              p_role: userInfo.role
            })

          if (error) {
            console.error('Error with RLS function, trying direct insert:', error)

            // Fallback: try direct insert (might fail due to RLS)
            const { error: insertError } = await supabase
              .from('users')
              .insert({
                id: userId,
                email: userInfo.email,
                name: userInfo.email.split('@')[0],
                role: userInfo.role
              })

            if (insertError) {
              console.error('Direct insert also failed:', insertError)
              results.push({
                email: userInfo.email,
                success: false,
                error: insertError.message
              })
            } else {
              results.push({
                email: userInfo.email,
                success: true,
                method: 'direct_insert'
              })
            }
          } else {
            results.push({
              email: userInfo.email,
              success: true,
              method: 'rls_function'
            })
          }
        } catch (error) {
          console.error('Error creating user:', error)
          results.push({
            email: userInfo.email,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      } else {
        results.push({
          email: userInfo.email,
          success: true,
          method: 'already_exists',
          role: existingUser.role
        })
      }
    }

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error) {
    console.error('Sync users error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync users'
      },
      { status: 500 }
    )
  }
}