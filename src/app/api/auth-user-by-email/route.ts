import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email parameter is required' },
        { status: 400 }
      )
    }

    // Query the users table for the auth user ID
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (error || !user) {
      console.log(`⚠️ No auth user found for email: ${email}`)
      return NextResponse.json({
        success: true,
        authUserId: null
      })
    }

    console.log(`✅ Found auth user ID ${user.id} for email: ${email}`)
    return NextResponse.json({
      success: true,
      authUserId: user.id
    })

  } catch (error) {
    console.error('Error looking up auth user by email:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
