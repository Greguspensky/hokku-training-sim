/**
 * Voice Settings API
 *
 * Endpoints for managing ElevenLabs voice configurations
 * - GET: List all configured voices (optionally filtered by language)
 * - POST: Add a new voice configuration
 * - PUT: Update an existing voice configuration
 * - DELETE: Remove a voice configuration
 *
 * Created: 2025-10-28
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { refreshVoiceCache } from '@/lib/voice-resolver'

/**
 * GET /api/voice-settings
 * List all configured voices
 *
 * Query params:
 * - language: Filter by language code (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const languageFilter = searchParams.get('language')

    let query = supabaseAdmin
      .from('elevenlabs_voices')
      .select('*')
      .order('language_code', { ascending: true })
      .order('voice_name', { ascending: true })

    // Apply language filter if provided
    if (languageFilter) {
      query = query.eq('language_code', languageFilter)
    }

    const { data, error } = await query

    if (error) {
      console.error('❌ Failed to fetch voices:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    console.log(`✅ Fetched ${data.length} voices` + (languageFilter ? ` for language: ${languageFilter}` : ''))

    return NextResponse.json({
      success: true,
      voices: data,
      count: data.length
    })

  } catch (error: any) {
    console.error('❌ Unexpected error in GET /api/voice-settings:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/voice-settings
 * Add a new voice configuration
 *
 * Request body:
 * {
 *   voice_id: string (ElevenLabs voice ID)
 *   voice_name: string (display name)
 *   language_code: string (ISO 639-1 code)
 *   gender?: 'male' | 'female' | 'neutral'
 *   description?: string
 *   avatar_url?: string (URL to avatar image)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.voice_id || !body.voice_name || !body.language_code) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: voice_id, voice_name, language_code'
        },
        { status: 400 }
      )
    }

    // Validate voice_id format (basic check)
    if (typeof body.voice_id !== 'string' || body.voice_id.length < 10) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid voice_id format. Must be a valid ElevenLabs voice ID.'
        },
        { status: 400 }
      )
    }

    // Validate language_code format (ISO 639-1: 2-letter code)
    if (typeof body.language_code !== 'string' || body.language_code.length !== 2) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid language_code format. Must be a 2-letter ISO 639-1 code (e.g., "en", "ru", "pt").'
        },
        { status: 400 }
      )
    }

    // Validate gender if provided
    if (body.gender && !['male', 'female', 'neutral'].includes(body.gender)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid gender value. Must be "male", "female", or "neutral".'
        },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('elevenlabs_voices')
      .insert({
        voice_id: body.voice_id,
        voice_name: body.voice_name,
        language_code: body.language_code.toLowerCase(),
        gender: body.gender || null,
        description: body.description || null,
        avatar_url: body.avatar_url || null
      })
      .select()
      .single()

    if (error) {
      // Handle unique constraint violation (duplicate voice_id)
      if (error.code === '23505') {
        return NextResponse.json(
          {
            success: false,
            error: `Voice ID "${body.voice_id}" already exists in the system.`
          },
          { status: 409 }
        )
      }

      console.error('❌ Failed to create voice:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Refresh cache after adding new voice
    refreshVoiceCache()

    console.log(`✅ Created voice: ${data.voice_name} (${data.language_code})`)

    return NextResponse.json({
      success: true,
      voice: data
    }, { status: 201 })

  } catch (error: any) {
    console.error('❌ Unexpected error in POST /api/voice-settings:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/voice-settings
 * Update an existing voice configuration
 *
 * Request body:
 * {
 *   id: string (UUID of voice config)
 *   voice_name?: string
 *   language_code?: string
 *   gender?: 'male' | 'female' | 'neutral'
 *   description?: string
 *   avatar_url?: string (URL to avatar image)
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required field
    if (!body.id) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: id' },
        { status: 400 }
      )
    }

    // Build update object (only include provided fields)
    const updates: any = {
      updated_at: new Date().toISOString()
    }

    if (body.voice_name) updates.voice_name = body.voice_name
    if (body.language_code) updates.language_code = body.language_code.toLowerCase()
    if (body.gender) {
      if (!['male', 'female', 'neutral'].includes(body.gender)) {
        return NextResponse.json(
          { success: false, error: 'Invalid gender value' },
          { status: 400 }
        )
      }
      updates.gender = body.gender
    }
    if (body.description !== undefined) updates.description = body.description
    if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url

    const { data, error } = await supabaseAdmin
      .from('elevenlabs_voices')
      .update(updates)
      .eq('id', body.id)
      .select()
      .single()

    if (error) {
      console.error('❌ Failed to update voice:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Refresh cache after updating voice
    refreshVoiceCache()

    console.log(`✅ Updated voice: ${data.voice_name} (${data.language_code})`)

    return NextResponse.json({
      success: true,
      voice: data
    })

  } catch (error: any) {
    console.error('❌ Unexpected error in PUT /api/voice-settings:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/voice-settings
 * Delete a voice configuration
 *
 * Query params:
 * - id: UUID of voice config to delete
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing required query parameter: id' },
        { status: 400 }
      )
    }

    // Check if voice is being used by any scenarios
    const { data: scenarios, error: scenariosError } = await supabaseAdmin
      .from('scenarios')
      .select('id, title, voice_ids')
      .contains('voice_ids', [id])
      .limit(5)

    if (scenariosError) {
      console.error('❌ Failed to check scenario usage:', scenariosError)
      // Continue with deletion anyway (non-blocking)
    } else if (scenarios && scenarios.length > 0) {
      console.warn(`⚠️ Voice is used by ${scenarios.length} scenario(s)`)
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete voice: it is currently used by ${scenarios.length} scenario(s).`,
          scenarios: scenarios.map(s => ({ id: s.id, title: s.title }))
        },
        { status: 409 }
      )
    }

    // Delete the voice
    const { error } = await supabaseAdmin
      .from('elevenlabs_voices')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('❌ Failed to delete voice:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Refresh cache after deleting voice
    refreshVoiceCache()

    console.log(`✅ Deleted voice: ${id}`)

    return NextResponse.json({
      success: true,
      message: 'Voice deleted successfully'
    })

  } catch (error: any) {
    console.error('❌ Unexpected error in DELETE /api/voice-settings:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
