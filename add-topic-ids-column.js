const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addTopicIdsColumn() {
  console.log('🔧 Adding topic_ids column to scenarios table...');

  try {
    // First, let's check if the column already exists
    const { data: existingColumns, error: checkError } = await supabase
      .rpc('get_table_columns', { table_name: 'scenarios' });

    if (checkError) {
      console.log('⚠️ Cannot check existing columns, proceeding with ALTER TABLE');
    } else {
      const hasTopicIds = existingColumns?.some(col => col.column_name === 'topic_ids');
      if (hasTopicIds) {
        console.log('✅ topic_ids column already exists in scenarios table');
        return;
      }
    }

    // Add the topic_ids column as a JSON array
    const { error } = await supabase.rpc('execute_sql', {
      sql: `
        ALTER TABLE scenarios
        ADD COLUMN IF NOT EXISTS topic_ids JSONB DEFAULT '[]'::jsonb;

        -- Add a comment to describe the column
        COMMENT ON COLUMN scenarios.topic_ids IS 'Array of topic IDs associated with this scenario for theory-based Q&A';
      `
    });

    if (error) {
      console.error('❌ Error adding topic_ids column:', error);

      // Try a simpler approach
      console.log('🔄 Trying simpler SQL execution...');
      const { error: simpleError } = await supabase.rpc('execute_sql', {
        sql: 'ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS topic_ids JSONB DEFAULT \'[]\'::jsonb;'
      });

      if (simpleError) {
        console.error('❌ Simple SQL also failed:', simpleError);
        throw simpleError;
      }
    }

    console.log('✅ Successfully added topic_ids column to scenarios table');

    // Test the column by updating a scenario (if any exist)
    const { data: scenarios, error: selectError } = await supabase
      .from('scenarios')
      .select('id, topic_ids')
      .limit(1);

    if (selectError) {
      console.error('❌ Error testing new column:', selectError);
    } else if (scenarios && scenarios.length > 0) {
      console.log('✅ Column test successful - can read topic_ids:', scenarios[0]);
    } else {
      console.log('ℹ️ No scenarios found to test with');
    }

  } catch (error) {
    console.error('❌ Failed to add topic_ids column:', error);
    process.exit(1);
  }
}

addTopicIdsColumn();