/**
 * Company Details API
 * GET /api/company-details?company_id=xxx
 *
 * Fetches company details (name, ID) by company ID
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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

    // Get company details
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .single()

    if (companyError) {
      console.error('Error fetching company:', companyError)
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      )
    }

    if (!companyData) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      company: {
        id: companyData.id,
        name: companyData.name
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
