/**
 * Database migration script to add customer_emotion_level column
 * Run with: npx tsx scripts/migrate-emotion-system.ts
 */

import { supabaseAdmin } from '../src/lib/supabase'

async function migrateDatabase() {
  console.log('🔧 Starting customer emotion system migration...')

  try {
    // Add column using raw SQL
    const { data, error } = await supabaseAdmin.rpc('exec_sql', {
      sql_query: `
        ALTER TABLE scenarios
        ADD COLUMN IF NOT EXISTS customer_emotion_level TEXT DEFAULT 'calm';

        ALTER TABLE scenarios
        ADD CONSTRAINT customer_emotion_level_check
        CHECK (customer_emotion_level IN ('calm', 'frustrated', 'angry', 'extremely_angry'));
      `
    })

    if (error) {
      console.error('❌ Migration error:', error)

      // Try alternative approach using direct query
      console.log('🔄 Trying alternative migration method...')

      const { error: altError } = await supabaseAdmin
        .from('scenarios')
        .select('customer_emotion_level')
        .limit(1)

      if (altError && altError.message.includes('column') && altError.message.includes('does not exist')) {
        console.error('❌ Column does not exist. Please run migration SQL manually in Supabase dashboard:')
        console.log(`
ALTER TABLE scenarios
ADD COLUMN IF NOT EXISTS customer_emotion_level TEXT DEFAULT 'calm'
CHECK (customer_emotion_level IN ('calm', 'frustrated', 'angry', 'extremely_angry'));
        `)
        process.exit(1)
      } else if (!altError) {
        console.log('✅ Column already exists!')
      }
    } else {
      console.log('✅ Migration completed successfully!')
    }

    // Verify migration
    console.log('\n🔍 Verifying migration...')

    const { data: scenarios, error: selectError } = await supabaseAdmin
      .from('scenarios')
      .select('id, customer_emotion_level')
      .limit(5)

    if (selectError) {
      console.error('❌ Verification error:', selectError)
    } else {
      console.log('✅ Verification successful!')
      console.log('Sample data:', scenarios)
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

// Run migration
migrateDatabase()
  .then(() => {
    console.log('\n✅ Migration script completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error)
    process.exit(1)
  })
