import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    // Known employee emails from the user feedback
    const knownEmployeeEmails = ['emp1@greg45.com', 'emp2@greg45.com']

    const results = []

    for (const email of knownEmployeeEmails) {
      // Check if user exists in users table
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single()

      if (!existingUser) {
        // Get the auth user ID by checking current session or using a generated UUID
        const userId = crypto.randomUUID()

        // Create user record with employee role
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert([{
            id: userId,
            email: email,
            name: email.split('@')[0],
            role: 'employee'
          }])
          .select()
          .single()

        if (insertError) {
          console.error('Error creating user record:', insertError)
          results.push({
            email: email,
            success: false,
            error: insertError.message
          })
        } else {
          console.log('✅ Created user record:', newUser)
          results.push({
            email: email,
            success: true,
            role: 'employee',
            created: true
          })
        }
      } else {
        results.push({
          email: email,
          success: true,
          role: existingUser.role,
          created: false
        })
      }
    }

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error) {
    console.error('Fix users error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fix users'
      },
      { status: 500 }
    )
  }
}