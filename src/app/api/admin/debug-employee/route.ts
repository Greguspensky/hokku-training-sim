import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({ error: 'Email parameter required' }, { status: 400 })
    }

    // Check user table
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    // Check employees table
    const { data: employees, error: empError } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('email', email)

    return NextResponse.json({
      email,
      user: user || null,
      userError: userError?.message || null,
      employees: employees || [],
      empError: empError?.message || null,
      employeeCount: employees?.length || 0
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal error', details: error }, { status: 500 })
  }
}
