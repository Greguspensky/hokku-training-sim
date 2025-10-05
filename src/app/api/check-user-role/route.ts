import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  // Get user from database
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, role, company_id')
    .eq('email', email)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ user })
}

export async function POST(request: Request) {
  const { email, role } = await request.json()

  if (!email || !role) {
    return NextResponse.json({ error: 'Email and role required' }, { status: 400 })
  }

  // Update user role
  const { data, error } = await supabase
    .from('users')
    .update({ role })
    .eq('email', email)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, user: data?.[0] })
}
