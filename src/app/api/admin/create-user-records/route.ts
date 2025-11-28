import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // This bypasses RLS
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request: NextRequest) {
  try {
    console.log('Starting user records creation...')

    // Get all auth users using admin client
    const { data: { users: authUsers }, error: authError } = await supabaseAdmin.auth.admin.listUsers()

    if (authError) {
      console.error('Failed to fetch auth users:', authError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch auth users: ' + authError.message },
        { status: 500 }
      )
    }

    console.log('Found auth users:', authUsers.map(u => ({ id: u.id, email: u.email })))

    const results = []

    for (const authUser of authUsers) {
      try {
        // Check if user record already exists
        const { data: existingUser } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()

        if (existingUser) {
          results.push({
            email: authUser.email,
            success: true,
            action: 'already_exists',
            role: existingUser.role
          })
          continue
        }

        // Determine role based on email pattern
        const role = authUser.email?.includes('emp') ? 'employee' : 'manager'

        // Create user record using service role (bypasses RLS)
        const { data: newUser, error: insertError } = await supabaseAdmin
          .from('users')
          .insert({
            id: authUser.id,
            email: authUser.email || '',
            name: authUser.email?.split('@')[0] || 'Unknown',
            role: role
          })
          .select()
          .single()

        if (insertError) {
          console.error('Failed to create user record:', insertError)
          results.push({
            email: authUser.email,
            success: false,
            error: insertError.message
          })
        } else {
          console.log('✅ Created user record:', { email: authUser.email, role })
          results.push({
            email: authUser.email,
            success: true,
            action: 'created',
            role: role
          })
        }
      } catch (error) {
        console.error('Error processing user:', authUser.email, error)
        results.push({
          email: authUser.email,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'User records creation completed',
      results,
      totalProcessed: authUsers.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    })

  } catch (error) {
    console.error('Create user records error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create user records'
      },
      { status: 500 }
    )
  }
}