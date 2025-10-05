import { NextRequest, NextResponse } from 'next/server'
import { employeeService, type EmployeeSignupData } from '@/lib/employees'
import { supabase, supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const signupData: EmployeeSignupData = {
      email: body.email,
      password: body.password,
      invite_token: body.invite_token
    }

    // Validate required fields
    if (!signupData.email || !signupData.password || !signupData.invite_token) {
      return NextResponse.json(
        { success: false, error: 'email, password, and invite_token are required' },
        { status: 400 }
      )
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(signupData.email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Basic password validation
    if (signupData.password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    // First, create the Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: signupData.email,
      password: signupData.password,
    })

    if (authError) {
      console.error('Supabase signup error:', authError)
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { success: false, error: 'Failed to create user account' },
        { status: 500 }
      )
    }

    // Validate the invite token to get company_id
    const inviteData = await employeeService.validateInviteToken(signupData.invite_token)

    if (!inviteData || !inviteData.is_valid) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired invite token' },
        { status: 400 }
      )
    }

    // Create user record in users table (for employee management)
    const client = supabaseAdmin || supabase
    // Anyone signing up through an invite link is an employee
    const role = 'employee'

    const { error: userInsertError } = await client
      .from('users')
      .insert({
        id: authData.user.id,
        email: signupData.email,
        name: inviteData.employee_name, // Use the name from the invite
        role: role,
        company_id: inviteData.company_id,
        created_at: new Date().toISOString()
      })

    if (userInsertError) {
      console.error('Error creating user record:', userInsertError)
      // Continue anyway - the auth user exists, we just couldn't sync to users table
    } else {
      console.log('✅ Created user record:', { email: signupData.email, role, company_id: inviteData.company_id })
    }

    // Then complete the employee signup in the service
    const employee = await employeeService.completeEmployeeSignup(signupData)

    if (!employee) {
      return NextResponse.json(
        { success: false, error: 'Failed to complete employee signup' },
        { status: 500 }
      )
    }

    console.log('✅ Employee signup successful:', {
      supabaseUserId: authData.user.id,
      employeeId: employee.id,
      email: signupData.email,
      syncedToUsersTable: !userInsertError
    })

    return NextResponse.json({
      success: true,
      employee,
      user: authData.user,
      message: 'Account created successfully'
    })

  } catch (error) {
    console.error('Employee signup error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete signup' 
      },
      { status: 500 }
    )
  }
}