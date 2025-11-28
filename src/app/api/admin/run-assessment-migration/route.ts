import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Running assessment caching fields migration...')

    // Add new columns to training_sessions table
    const alterQuery = `
      ALTER TABLE training_sessions
      ADD COLUMN IF NOT EXISTS theory_assessment_results JSONB,
      ADD COLUMN IF NOT EXISTS assessment_completed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS assessment_status TEXT CHECK (assessment_status IN ('pending', 'completed', 'failed')) DEFAULT 'pending';
    `

    const { error: alterError } = await supabaseAdmin
      .from('training_sessions')
      .select('id')
      .limit(1)

    if (alterError) {
      console.error('❌ Database connection failed:', alterError)
      return NextResponse.json({
        success: false,
        error: 'Database connection failed',
        details: alterError
      }, { status: 500 })
    }

    // Try to add columns using raw SQL (this might not work with RLS)
    try {
      // Check if columns already exist
      const { data: columns } = await supabaseAdmin
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'training_sessions')
        .in('column_name', ['theory_assessment_results', 'assessment_completed_at', 'assessment_status'])

      if (columns && columns.length === 3) {
        console.log('✅ Columns already exist, skipping migration')
        return NextResponse.json({
          success: true,
          message: 'Migration already completed - columns exist',
          columnsFound: columns.length
        })
      }

      console.log('📝 Columns found:', columns?.length || 0)
      console.log('⚠️ Direct ALTER TABLE not available via Supabase client')

      return NextResponse.json({
        success: false,
        error: 'Manual migration required',
        message: 'Please run the SQL migration manually in Supabase SQL Editor',
        sql: alterQuery,
        instructions: [
          '1. Go to Supabase Dashboard → SQL Editor',
          '2. Paste and run the provided SQL',
          '3. Add indexes manually'
        ]
      })

    } catch (sqlError) {
      console.error('❌ SQL execution failed:', sqlError)
      return NextResponse.json({
        success: false,
        error: 'SQL execution failed',
        details: sqlError,
        sql: alterQuery
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ Migration failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      details: error
    }, { status: 500 })
  }
}