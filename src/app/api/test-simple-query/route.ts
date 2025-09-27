import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Test 1: Simple query without any imports
    console.log('Testing simple assignment query...')

    const assignmentId = '18b0b423-77bb-4225-b36c-cf61c51fc13e'

    const { data: assignment, error } = await supabaseAdmin
      .from('track_assignments')
      .select('*')
      .eq('id', assignmentId)
      .single()

    if (error) {
      return NextResponse.json({
        success: false,
        error: `Assignment query failed: ${error.message}`,
        step: 'assignment_query'
      }, { status: 500 })
    }

    // Test 2: Simple track query
    console.log('Testing simple track query...')

    const { data: track, error: trackError } = await supabaseAdmin
      .from('tracks')
      .select('*')
      .eq('id', assignment.track_id)
      .single()

    if (trackError) {
      return NextResponse.json({
        success: false,
        error: `Track query failed: ${trackError.message}`,
        step: 'track_query'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Both queries successful',
      assignment: {
        id: assignment.id,
        user_id: assignment.user_id,
        track_id: assignment.track_id,
        status: assignment.status
      },
      track: {
        id: track.id,
        name: track.name,
        description: track.description
      }
    })

  } catch (error) {
    console.error('Simple query test error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}