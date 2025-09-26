import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { avatarService } from '@/lib/avatar-service'
import { type TranscriptEntry } from '@/lib/avatar-types'

export async function POST(
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
    const transcriptEntry: TranscriptEntry = {
      speaker: body.speaker,
      text: body.text,
      timestamp: body.timestamp || new Date().toISOString(),
      duration_ms: body.duration_ms
    }

    if (!transcriptEntry.speaker || !transcriptEntry.text) {
      return NextResponse.json(
        { success: false, error: 'speaker and text are required' },
        { status: 400 }
      )
    }

    if (!['avatar', 'user'].includes(transcriptEntry.speaker)) {
      return NextResponse.json(
        { success: false, error: 'speaker must be either "avatar" or "user"' },
        { status: 400 }
      )
    }

    await avatarService.addTranscriptEntry(sessionId, transcriptEntry)

    return NextResponse.json({
      success: true,
      message: 'Transcript entry added successfully'
    })

  } catch (error) {
    console.error('Add transcript entry error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add transcript entry'
      },
      { status: 500 }
    )
  }
}