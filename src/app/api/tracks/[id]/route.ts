import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const trackId = params.id

    if (!trackId) {
      return NextResponse.json(
        { success: false, error: 'Track ID is required' },
        { status: 400 }
      )
    }

    // First, check if track exists
    const { data: track, error: fetchError } = await supabaseAdmin
      .from('tracks')
      .select('id, name')
      .eq('id', trackId)
      .single()

    if (fetchError || !track) {
      return NextResponse.json(
        { success: false, error: 'Track not found' },
        { status: 404 }
      )
    }

    // Delete the track (scenarios will be cascade deleted due to foreign key constraint)
    const { error: deleteError } = await supabaseAdmin
      .from('tracks')
      .delete()
      .eq('id', trackId)

    if (deleteError) {
      console.error('Error deleting track:', deleteError)
      return NextResponse.json(
        { success: false, error: `Failed to delete track: ${deleteError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Track "${track.name}" deleted successfully`
    })

  } catch (error) {
    console.error('Delete track error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const trackId = params.id
    const body = await request.json()
    const { name, description, target_audience, company_id } = body

    if (!trackId) {
      return NextResponse.json(
        { success: false, error: 'Track ID is required' },
        { status: 400 }
      )
    }

    if (!name || !description || !target_audience || !company_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if track exists
    const { data: existingTrack, error: fetchError } = await supabaseAdmin
      .from('tracks')
      .select('id')
      .eq('id', trackId)
      .single()

    if (fetchError || !existingTrack) {
      return NextResponse.json(
        { success: false, error: 'Track not found' },
        { status: 404 }
      )
    }

    // Update the track
    const { data: updatedTrack, error: updateError } = await supabaseAdmin
      .from('tracks')
      .update({
        name,
        description,
        target_audience,
        updated_at: new Date().toISOString()
      })
      .eq('id', trackId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating track:', updateError)
      return NextResponse.json(
        { success: false, error: `Failed to update track: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      track: updatedTrack,
      message: 'Track updated successfully'
    })

  } catch (error) {
    console.error('Update track error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const trackId = params.id

    if (!trackId) {
      return NextResponse.json(
        { success: false, error: 'Track ID is required' },
        { status: 400 }
      )
    }

    // Get track with scenarios
    const { data: track, error } = await supabaseAdmin
      .from('tracks')
      .select(`
        id,
        name,
        description,
        target_audience,
        company_id,
        created_at,
        updated_at,
        scenarios (
          id,
          title,
          description,
          scenario_type,
          difficulty,
          estimated_duration_minutes,
          created_at,
          updated_at
        )
      `)
      .eq('id', trackId)
      .single()

    if (error) {
      console.error('Error fetching track:', error)
      return NextResponse.json(
        { success: false, error: 'Track not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      track
    })

  } catch (error) {
    console.error('Get track error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}