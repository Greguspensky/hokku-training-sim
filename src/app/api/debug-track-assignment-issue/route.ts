import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debug: Checking environment and database access...')

    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    console.log('Environment check:')
    console.log('- SUPABASE_URL present:', !!supabaseUrl)
    console.log('- SUPABASE_URL value:', supabaseUrl?.substring(0, 30) + '...')
    console.log('- SERVICE_ROLE_KEY present:', !!serviceRoleKey)
    console.log('- SERVICE_ROLE_KEY length:', serviceRoleKey?.length || 0)

    // Try to list tables to see what's available
    console.log('🔍 Attempting to query track_assignments table...')

    const { data: assignments, error: assignmentsError } = await supabaseAdmin
      .from('track_assignments')
      .select('*')
      .limit(1)

    if (assignmentsError) {
      console.log('❌ track_assignments error:', assignmentsError)
    } else {
      console.log('✅ track_assignments accessible, found', assignments?.length || 0, 'records')
      if (assignments && assignments.length > 0) {
        console.log('📋 Sample assignment:', assignments[0])
      }
    }

    // Try other tables to see what works
    console.log('🔍 Testing tracks table...')
    const { data: tracks, error: tracksError } = await supabaseAdmin
      .from('tracks')
      .select('*')
      .limit(1)

    if (tracksError) {
      console.log('❌ tracks error:', tracksError)
    } else {
      console.log('✅ tracks accessible, found', tracks?.length || 0, 'records')
    }

    console.log('🔍 Testing users table...')
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('*')
      .limit(1)

    if (usersError) {
      console.log('❌ users error:', usersError)
    } else {
      console.log('✅ users accessible, found', users?.length || 0, 'records')
    }

    return NextResponse.json({
      success: true,
      debug: {
        environment: {
          supabase_url_present: !!supabaseUrl,
          service_role_key_present: !!serviceRoleKey,
          service_role_key_length: serviceRoleKey?.length || 0
        },
        database_access: {
          track_assignments: {
            accessible: !assignmentsError,
            error: assignmentsError?.message,
            records_found: assignments?.length || 0
          },
          tracks: {
            accessible: !tracksError,
            error: tracksError?.message,
            records_found: tracks?.length || 0
          },
          users: {
            accessible: !usersError,
            error: usersError?.message,
            records_found: users?.length || 0
          }
        }
      }
    })

  } catch (error: any) {
    console.error('❌ Debug endpoint error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Debug failed',
      debug: {
        error_details: error
      }
    }, { status: 500 })
  }
}