import { NextRequest, NextResponse } from 'next/server'
import { employeeService } from '@/lib/employees'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Invite token is required' },
        { status: 400 }
      )
    }

    const inviteData = await employeeService.validateInviteToken(token)
    
    if (!inviteData || !inviteData.is_valid) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired invite token' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      invite: inviteData
    })

  } catch (error) {
    console.error('Validate invite token error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate invite token' 
      },
      { status: 500 }
    )
  }
}