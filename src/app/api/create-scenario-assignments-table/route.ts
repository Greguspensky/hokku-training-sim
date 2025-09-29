import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    console.log('🔨 Creating scenario_assignments table...')

    // Use the SQL editor endpoint
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/sql`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!
        },
        body: JSON.stringify({
          sql: `
            -- Create scenario_assignments table
            CREATE TABLE IF NOT EXISTS scenario_assignments (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              scenario_id UUID REFERENCES scenarios(id) ON DELETE CASCADE,
              employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
              assigned_by TEXT NOT NULL,
              assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed')),
              notes TEXT,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              UNIQUE(scenario_id, employee_id)
            );

            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_scenario_assignments_employee_id ON scenario_assignments(employee_id);
            CREATE INDEX IF NOT EXISTS idx_scenario_assignments_scenario_id ON scenario_assignments(scenario_id);
            CREATE INDEX IF NOT EXISTS idx_scenario_assignments_status ON scenario_assignments(status);

            -- Enable RLS
            ALTER TABLE scenario_assignments ENABLE ROW LEVEL SECURITY;

            -- Create policies
            DROP POLICY IF EXISTS "scenario_assignments_select_policy" ON scenario_assignments;
            CREATE POLICY "scenario_assignments_select_policy" ON scenario_assignments
              FOR SELECT USING (true);

            DROP POLICY IF EXISTS "scenario_assignments_insert_policy" ON scenario_assignments;
            CREATE POLICY "scenario_assignments_insert_policy" ON scenario_assignments
              FOR INSERT WITH CHECK (true);

            DROP POLICY IF EXISTS "scenario_assignments_update_policy" ON scenario_assignments;
            CREATE POLICY "scenario_assignments_update_policy" ON scenario_assignments
              FOR UPDATE USING (true);
          `
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Supabase SQL error:', response.status, errorText)
      return NextResponse.json(
        { success: false, error: `Supabase error: ${response.status} ${errorText}` },
        { status: 500 }
      )
    }

    const result = await response.json()
    console.log('✅ Table creation result:', result)

    // Test the table by trying to query it
    const { data: testData, error: testError } = await supabaseAdmin
      .from('scenario_assignments')
      .select('*')
      .limit(1)

    if (testError) {
      console.error('❌ Table verification failed:', testError)
      return NextResponse.json(
        { success: false, error: `Table verification failed: ${testError.message}` },
        { status: 500 }
      )
    }

    console.log('✅ scenario_assignments table created and verified successfully')

    return NextResponse.json({
      success: true,
      message: 'scenario_assignments table created successfully',
      result
    })

  } catch (error) {
    console.error('❌ Error creating scenario_assignments table:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}