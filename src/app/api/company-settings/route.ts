import { createClient } from '@supabase/supabase-js'
import { NextResponse, NextRequest } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/company-settings?company_id=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('company_id')

  if (!companyId) {
    return NextResponse.json({ error: 'Company ID required' }, { status: 400 })
  }

  try {
    const { data: settings, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      throw error
    }

    return NextResponse.json({
      success: true,
      settings: settings || { company_id: companyId, default_training_language: 'en' }
    })
  } catch (error: any) {
    console.error('Error fetching company settings:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST /api/company-settings - Update or create settings
export async function POST(request: NextRequest) {
  const body = await request.json()
  const {
    company_id,
    default_training_language,
    theory_recording_options,
    service_practice_recording_options
  } = body

  if (!company_id) {
    return NextResponse.json(
      { error: 'company_id is required' },
      { status: 400 }
    )
  }

  try {
    // Build update object with only provided fields
    const updateData: any = {
      company_id,
      updated_at: new Date().toISOString()
    }

    if (default_training_language !== undefined) {
      updateData.default_training_language = default_training_language
    }
    if (theory_recording_options !== undefined) {
      updateData.theory_recording_options = theory_recording_options
    }
    if (service_practice_recording_options !== undefined) {
      updateData.service_practice_recording_options = service_practice_recording_options
    }

    const { data, error } = await supabase
      .from('company_settings')
      .upsert(updateData, {
        onConflict: 'company_id'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      settings: data
    })
  } catch (error: any) {
    console.error('Error updating company settings:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
