import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { avatarService } from '@/lib/avatar-service'
import { type UpdateAvatarSessionData, type TranscriptEntry } from '@/lib/avatar-types'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()

    const demoUser = user || {
      id: 'demo-user',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'employee'
    }

    const sessionId = params.id

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      )
    }

    const session = await avatarService.getSession(sessionId)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Avatar session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      session
    })

  } catch (error) {
    console.error('Get avatar session error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch avatar session'
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()

    const demoUser = user || {
      id: 'demo-user',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'employee'
    }

    const sessionId = params.id

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const updates: UpdateAvatarSessionData = {
      ended_at: body.ended_at,
      duration_minutes: body.duration_minutes,
      questions_asked: body.questions_asked,
      correct_answers: body.correct_answers,
      incorrect_answers: body.incorrect_answers,
      total_responses: body.total_responses,
      transcript: body.transcript,
      video_url: body.video_url,
      audio_url: body.audio_url,
      status: body.status
    }

    const session = await avatarService.updateSession(sessionId, updates)

    return NextResponse.json({
      success: true,
      session,
      message: 'Avatar session updated successfully'
    })

  } catch (error) {
    console.error('Update avatar session error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update avatar session'
      },
      { status: 500 }
    )
  }
}