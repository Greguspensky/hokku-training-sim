import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('🔧 Running assessment columns migration...')

    // Add assessment caching columns to training_sessions table
    const migrationSQL = `
      -- Add assessment caching columns to training_sessions table
      ALTER TABLE training_sessions
      ADD COLUMN IF NOT EXISTS assessment_status TEXT DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS theory_assessment_results JSONB,
      ADD COLUMN IF NOT EXISTS assessment_completed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS session_name TEXT DEFAULT 'Theory Q&A Session',
      ADD COLUMN IF NOT EXISTS training_mode TEXT DEFAULT 'theory',
      ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en',
      ADD COLUMN IF NOT EXISTS session_duration_seconds INTEGER,
      ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS conversation_transcript JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS elevenlabs_conversation_id TEXT;

      -- Add indexes for faster lookups
      CREATE INDEX IF NOT EXISTS idx_training_sessions_assessment_status
      ON training_sessions (assessment_status);

      CREATE INDEX IF NOT EXISTS idx_training_sessions_elevenlabs_conversation_id
      ON training_sessions (elevenlabs_conversation_id);
    `

    const { error } = await supabaseAdmin.rpc('exec_sql', {
      sql_query: migrationSQL
    })

    if (error) {
      // Try alternative approach if rpc doesn't work
      console.log('🔄 RPC failed, trying direct queries...')

      const queries = [
        'ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS assessment_status TEXT DEFAULT \'pending\'',
        'ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS theory_assessment_results JSONB',
        'ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS assessment_completed_at TIMESTAMPTZ',
        'ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS session_name TEXT DEFAULT \'Theory Q&A Session\'',
        'ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS training_mode TEXT DEFAULT \'theory\'',
        'ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS language TEXT DEFAULT \'en\'',
        'ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS session_duration_seconds INTEGER',
        'ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ',
        'ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS conversation_transcript JSONB DEFAULT \'[]\'::jsonb',
        'ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS elevenlabs_conversation_id TEXT'
      ]

      for (const query of queries) {
        try {
          await supabaseAdmin.rpc('exec_sql', { sql_query: query })
          console.log('✅ Executed:', query.substring(0, 50) + '...')
        } catch (queryError) {
          console.log('⚠️ Query failed (may already exist):', query.substring(0, 50) + '...')
        }
      }
    }

    // Verify columns exist by trying to select them
    const { data: testData, error: testError } = await supabaseAdmin
      .from('training_sessions')
      .select('assessment_status, theory_assessment_results, assessment_completed_at, session_name, training_mode, language, session_duration_seconds, ended_at, conversation_transcript, elevenlabs_conversation_id')
      .limit(1)

    if (testError) {
      console.error('❌ Verification failed:', testError)
      return NextResponse.json({
        success: false,
        error: 'Migration completed but verification failed',
        details: testError.message
      })
    }

    console.log('✅ Assessment columns migration completed successfully')

    return NextResponse.json({
      success: true,
      message: 'Assessment columns added to training_sessions table',
      columnsAdded: [
        'assessment_status',
        'theory_assessment_results',
        'assessment_completed_at',
        'session_name',
        'training_mode',
        'language',
        'session_duration_seconds',
        'ended_at',
        'conversation_transcript',
        'elevenlabs_conversation_id'
      ]
    })

  } catch (error: any) {
    console.error('❌ Migration failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      details: error.message
    }, { status: 500 })
  }
}