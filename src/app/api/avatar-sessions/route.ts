import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { avatarService } from '@/lib/avatar-service'
import { type CreateAvatarSessionData } from '@/lib/avatar-types'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    const demoUser = user || {
      id: 'demo-user',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'employee'
    }

    const body = await request.json()
    const sessionData: CreateAvatarSessionData = {
      assignment_id: body.assignment_id,
      scenario_id: body.scenario_id,
      employee_id: body.employee_id || demoUser.id,
      language: body.language || 'en'
    }

    if (!sessionData.assignment_id || !sessionData.scenario_id) {
      return NextResponse.json(
        { success: false, error: 'assignment_id and scenario_id are required' },
        { status: 400 }
      )
    }

    const session = await avatarService.createSession(sessionData)

    return NextResponse.json({
      success: true,
      session,
      message: 'Avatar session created successfully'
    })

  } catch (error) {
    console.error('Create avatar session error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create avatar session'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    const demoUser = user || {
      id: 'demo-user',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'employee'
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employee_id') || demoUser.id

    if (!employeeId) {
      return NextResponse.json(
        { success: false, error: 'employee_id parameter is required' },
        { status: 400 }
      )
    }

    const sessions = await avatarService.getEmployeeSessions(employeeId)

    return NextResponse.json({
      success: true,
      sessions,
      count: sessions.length
    })

  } catch (error) {
    console.error('Get avatar sessions error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch avatar sessions'
      },
      { status: 500 }
    )
  }
}