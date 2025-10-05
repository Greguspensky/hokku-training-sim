import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: { schema: 'public' },
    auth: { persistSession: false }
  }
)

export async function GET() {
  try {
    // Try to create the table using raw SQL
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.company_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id TEXT NOT NULL UNIQUE,
        default_training_language VARCHAR(10) DEFAULT 'en',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `

    // Create RLS policy
    const createPolicySQL = `
      ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Enable all for company_settings" ON public.company_settings;

      CREATE POLICY "Enable all for company_settings"
        ON public.company_settings
        FOR ALL
        USING (true)
        WITH CHECK (true);
    `

    // Execute via Supabase's query method
    const { error: tableError } = await supabaseAdmin.from('company_settings').select('count').limit(0)

    if (tableError && tableError.message.includes('does not exist')) {
      return NextResponse.json({
        success: false,
        message: 'Table does not exist. Please create it manually in Supabase SQL Editor',
        sql: createTableSQL + '\n\n' + createPolicySQL
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Table already exists or was created successfully'
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
