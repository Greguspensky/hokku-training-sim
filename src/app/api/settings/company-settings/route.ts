import { createClient } from '@supabase/supabase-js'
import { NextResponse, NextRequest } from 'next/server'
import { apiErrorHandler, createSuccessResponse, createErrorResponse, parseRequestBody } from '@/lib/utils/api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/company-settings?company_id=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('company_id')

  if (!companyId) {
    return createErrorResponse('Company ID required', 400)
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

    return createSuccessResponse({
      settings: settings || { company_id: companyId, default_training_language: 'en', ui_language: 'en' }
    })
  } catch (error: any) {
    return apiErrorHandler(error, 'Fetch company settings')
  }
}

// POST /api/company-settings - Update or create settings
export async function POST(request: NextRequest) {
  const body = await parseRequestBody<any>(request)
  const {
    company_id,
    default_training_language,
    ui_language,
    theory_recording_options,
    service_practice_recording_options,
    recommendation_recording_options,
    show_session_names_to_employees
  } = body

  if (!company_id) {
    return createErrorResponse('company_id is required', 400)
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
    if (ui_language !== undefined) {
      updateData.ui_language = ui_language
    }
    if (theory_recording_options !== undefined) {
      updateData.theory_recording_options = theory_recording_options
    }
    if (service_practice_recording_options !== undefined) {
      updateData.service_practice_recording_options = service_practice_recording_options
    }
    if (recommendation_recording_options !== undefined) {
      updateData.recommendation_recording_options = recommendation_recording_options
    }
    if (show_session_names_to_employees !== undefined) {
      updateData.show_session_names_to_employees = show_session_names_to_employees
    }

    const { data, error } = await supabase
      .from('company_settings')
      .upsert(updateData, {
        onConflict: 'company_id'
      })
      .select()
      .single()

    if (error) throw error

    return createSuccessResponse({ settings: data })
  } catch (error: any) {
    return apiErrorHandler(error, 'Update company settings')
  }
}
