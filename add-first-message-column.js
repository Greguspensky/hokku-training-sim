/**
 * Add first_message column to scenarios table
 * Allows managers to customize the AI's opening message for Service Practice scenarios
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addFirstMessageColumn() {
  console.log('Adding first_message column to scenarios table...')

  try {
    // Add first_message column
    const { error } = await supabase.rpc('execute_sql', {
      sql: `ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS first_message TEXT;`
    })

    if (error) {
      console.error('RPC error:', error)
      // Try direct admin client if RPC doesn't exist
      const { error: directError } = await supabase.from('scenarios').select('first_message').limit(1)

      if (directError && directError.code === '42703') {
        // Column doesn't exist, try alternative method
        console.log('RPC not available, please run SQL manually in Supabase dashboard:')
        console.log('ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS first_message TEXT;')
        process.exit(1)
      } else {
        console.log('✅ Column already exists or was added successfully')
      }
    } else {
      console.log('✅ first_message column added successfully!')
    }
  } catch (err) {
    console.error('Migration error:', err)
    console.log('\n⚠️ If RPC is not available, run this SQL in Supabase SQL Editor:')
    console.log('ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS first_message TEXT;')
    process.exit(1)
  }
}

addFirstMessageColumn()
