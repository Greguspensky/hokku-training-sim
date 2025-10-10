import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    // Find the user
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user already has company_id
    if (user.company_id) {
      return NextResponse.json({
        success: true,
        message: 'User already has company_id',
        company_id: user.company_id
      })
    }

    // Find or create a company for this user
    // First, check if there's a company where this user is a manager
    const { data: managerRecord } = await supabaseAdmin
      .from('managers')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    let companyId = managerRecord?.company_id

    // If no manager record, check if there's an existing company for the domain
    if (!companyId) {
      const domain = email.split('@')[1]
      const { data: companies } = await supabaseAdmin
        .from('companies')
        .select('id')
        .ilike('name', `%${domain}%`)
        .limit(1)

      if (companies && companies.length > 0) {
        companyId = companies[0].id
      }
    }

    // If still no company, create one
    if (!companyId) {
      const domain = email.split('@')[1]
      const { data: newCompany, error: companyError } = await supabaseAdmin
        .from('companies')
        .insert({
          name: `Company ${domain}`,
          subscription_tier: 'premium',
          max_employees: 100,
          is_active: true
        })
        .select()
        .single()

      if (companyError) {
        return NextResponse.json({ error: 'Failed to create company', details: companyError }, { status: 500 })
      }

      companyId = newCompany.id
    }

    // Update user with company_id
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ company_id: companyId })
      .eq('id', user.id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update user', details: updateError }, { status: 500 })
    }

    // Create manager record if doesn't exist
    const { error: managerError } = await supabaseAdmin
      .from('managers')
      .upsert({
        user_id: user.id,
        company_id: companyId,
        is_active: true
      }, {
        onConflict: 'user_id'
      })

    if (managerError) {
      console.warn('Could not create manager record:', managerError)
    }

    return NextResponse.json({
      success: true,
      message: 'User updated with company_id',
      user_id: user.id,
      company_id: companyId,
      email: user.email
    })

  } catch (error) {
    console.error('Error in fix-manager-company:', error)
    return NextResponse.json({ error: 'Internal error', details: error }, { status: 500 })
  }
}
