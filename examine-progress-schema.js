const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function examineSchema() {
  console.log('🔍 Examining existing progress table structures...');

  // Check user_topic_progress structure
  console.log('\n📊 user_topic_progress table:');
  try {
    const { data: progress, error } = await supabaseAdmin
      .from('user_topic_progress')
      .select('*')
      .limit(1);

    if (error) {
      console.log('❌ Error:', error.message);
    } else {
      console.log('✅ Table accessible');
      if (progress && progress.length > 0) {
        console.log('   Columns:', Object.keys(progress[0]));
        console.log('   Sample data:', progress[0]);
      } else {
        console.log('   No data found - creating sample to see structure');
        // Try to get column info by attempting an insert that will fail
        const { error: insertError } = await supabaseAdmin
          .from('user_topic_progress')
          .insert({});
        if (insertError) {
          console.log('   Insert error (expected):', insertError.message);
        }
      }
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Check question_attempts structure
  console.log('\n❓ question_attempts table:');
  try {
    const { data: attempts, error } = await supabaseAdmin
      .from('question_attempts')
      .select('*')
      .limit(1);

    if (error) {
      console.log('❌ Error:', error.message);
    } else {
      console.log('✅ Table accessible');
      if (attempts && attempts.length > 0) {
        console.log('   Columns:', Object.keys(attempts[0]));
        console.log('   Sample data:', attempts[0]);
      } else {
        console.log('   No data found');
      }
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Find the right user/profile table
  console.log('\n👤 Looking for user table...');
  const userTables = ['profiles', 'users', 'user_profiles', 'auth.users'];
  for (const table of userTables) {
    try {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select('id, email')
        .limit(1);

      if (!error && data) {
        console.log(`✅ Found user table: ${table}`);
        if (data.length > 0) {
          console.log(`   Sample user: ${data[0].email || 'no email'} - ID: ${data[0].id}`);
        }
        break;
      }
    } catch (error) {
      console.log(`❌ ${table}: not accessible`);
    }
  }

  // Check if we can connect user_topic_progress to knowledge_topics
  console.log('\n🔗 Testing table relationships...');
  try {
    const { data: topicIds, error: topicsError } = await supabaseAdmin
      .from('knowledge_topics')
      .select('id')
      .limit(1);

    if (!topicsError && topicIds && topicIds.length > 0) {
      const testTopicId = topicIds[0].id;
      console.log(`   Test topic ID: ${testTopicId}`);

      // Try to create a test progress record
      const testUserId = '00000000-0000-0000-0000-000000000000'; // Dummy UUID
      const { error: progressError } = await supabaseAdmin
        .from('user_topic_progress')
        .insert({
          user_id: testUserId,
          topic_id: testTopicId,
          mastery_level: 0.5,
          total_attempts: 1,
          correct_attempts: 1
        });

      if (progressError) {
        console.log('   Progress insert test error:', progressError.message);
        // This will show us what columns are expected
      } else {
        console.log('   ✅ Progress record structure is compatible');
        // Clean up the test record
        await supabaseAdmin
          .from('user_topic_progress')
          .delete()
          .eq('user_id', testUserId);
      }
    }
  } catch (error) {
    console.log('   Relationship test error:', error.message);
  }

  process.exit(0);
}

examineSchema();