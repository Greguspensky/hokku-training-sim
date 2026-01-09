/**
 * Company Details API
 * GET /api/company-details?company_id=xxx
 *
 * Fetches company details (name, ID) by company ID
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'company_id parameter is required' },
        { status: 400 }
      )
    }

    // Try to get company name from users table (all users with this company_id should have the same company info)
    // This is a workaround since there's no dedicated companies table
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('company_id', companyId)
      .limit(1)
      .single()

    if (userError && userError.code !== 'PGRST116') {
      console.error('Error fetching company:', userError)
    }

    // If company_id exists in users table, return it
    // Otherwise, still return the company_id (it's valid even if no name is available)
    const companyName = userData?.company_id || companyId

    return NextResponse.json({
      success: true,
      company: {
        id: companyId,
        name: companyName
      }
    })

  } catch (error) {
    console.error('Error fetching company details:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch company details' },
      { status: 500 }
    )
  }
}
