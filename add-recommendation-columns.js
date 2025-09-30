const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addRecommendationColumns() {
  console.log('🔧 Adding recommendation columns to scenarios table...');

  try {
    // Add the recommendation_question_ids column as a TEXT array
    console.log('1. Adding recommendation_question_ids column...');
    const { error: error1 } = await supabase.rpc('execute_sql', {
      sql: `
        ALTER TABLE scenarios
        ADD COLUMN IF NOT EXISTS recommendation_question_ids TEXT[];

        -- Add a comment to describe the column
        COMMENT ON COLUMN scenarios.recommendation_question_ids IS 'Array of question IDs for recommendation-type scenarios';
      `
    });

    if (error1) {
      console.error('❌ Error adding recommendation_question_ids column:', error1);

      // Try a simpler approach
      console.log('🔄 Trying simpler SQL execution for recommendation_question_ids...');
      const { error: simpleError1 } = await supabase.rpc('execute_sql', {
        sql: 'ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS recommendation_question_ids TEXT[];'
      });

      if (simpleError1) {
        console.error('❌ Simple SQL also failed for recommendation_question_ids:', simpleError1);
        throw simpleError1;
      }
    }

    console.log('✅ Successfully added recommendation_question_ids column');

    // Add the instructions column as TEXT
    console.log('2. Adding instructions column...');
    const { error: error2 } = await supabase.rpc('execute_sql', {
      sql: `
        ALTER TABLE scenarios
        ADD COLUMN IF NOT EXISTS instructions TEXT;

        -- Add a comment to describe the column
        COMMENT ON COLUMN scenarios.instructions IS 'Special instructions for recommendation-type scenarios';
      `
    });

    if (error2) {
      console.error('❌ Error adding instructions column:', error2);

      // Try a simpler approach
      console.log('🔄 Trying simpler SQL execution for instructions...');
      const { error: simpleError2 } = await supabase.rpc('execute_sql', {
        sql: 'ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS instructions TEXT;'
      });

      if (simpleError2) {
        console.error('❌ Simple SQL also failed for instructions:', simpleError2);
        throw simpleError2;
      }
    }

    console.log('✅ Successfully added instructions column');

    // Test the columns by selecting from a scenario
    console.log('3. Testing new columns...');
    const { data: scenarios, error: selectError } = await supabase
      .from('scenarios')
      .select('id, title, recommendation_question_ids, instructions')
      .limit(1);

    if (selectError) {
      console.error('❌ Error testing new columns:', selectError);
    } else if (scenarios && scenarios.length > 0) {
      console.log('✅ Column test successful - can read new columns:', scenarios[0]);
    } else {
      console.log('ℹ️ No scenarios found to test with');
    }

    console.log('🎉 Successfully added all recommendation columns to scenarios table!');

  } catch (error) {
    console.error('❌ Failed to add recommendation columns:', error);
    process.exit(1);
  }
}

addRecommendationColumns();