/**
 * Company Details API
 * GET /api/company-details?email=user@example.com
 *
 * Fetches company details (name, ID) for a user
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email parameter is required' },
        { status: 400 }
      )
    }

    // Get user's company_id from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('company_id')
      .eq('email', email)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Get company details
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', userData.company_id)
      .single()

    if (companyError || !companyData) {
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
