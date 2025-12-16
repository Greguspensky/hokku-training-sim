const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function assignKnowledge() {
  const scenarioId = '13a2c2f3-24fc-4f20-abd6-f3ab2a7abc01';
  const documentIds = [
    "0d57fffd-484e-4b55-9ea1-bb28163bc43d", // Basic info
    "4bd27e80-5b13-472b-8f9e-0154bdaa0b30"  // FAQ
  ];

  console.log('\n📝 Assigning knowledge documents to Reception scenario...\n');

  const { data, error } = await supabase
    .from('scenarios')
    .update({ knowledge_document_ids: documentIds })
    .eq('id', scenarioId)
    .select()
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ Successfully assigned documents!');
  console.log('\n📋 Updated scenario:');
  console.log('   Title:', data.title);
  console.log('   Knowledge documents:', data.knowledge_document_ids);
  console.log('\n🎉 The chat should now have access to Mota Hotel information!');
}

assignKnowledge().then(() => process.exit(0));
