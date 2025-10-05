import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  try {
    // Create company_settings table
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS company_settings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID NOT NULL UNIQUE,
          default_training_language VARCHAR(10) DEFAULT 'en',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Allow all operations on company_settings" ON company_settings;
        CREATE POLICY "Allow all operations on company_settings"
          ON company_settings FOR ALL
          USING (true);
      `
    })

    if (createError) {
      console.error('Error creating table:', createError)
      return NextResponse.json({
        success: false,
        error: createError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'company_settings table created successfully'
    })
  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
