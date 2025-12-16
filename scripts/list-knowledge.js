const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listKnowledge() {
  const { data, error } = await supabase
    .from('knowledge_base_documents')
    .select('*')
    .eq('company_id', '9deb2165-32b1-4287-be9d-788a0726408e')
    .order('title');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`\n📚 Found ${data.length} knowledge documents for Mota Hotel:\n`);
  data.forEach((doc, idx) => {
    console.log(`${idx + 1}. ${doc.title}`);
    console.log(`   ID: ${doc.id}`);
    console.log(`   Content length: ${doc.content.length} chars`);
    console.log(`   Content preview: ${doc.content.substring(0, 100)}...`);
    console.log('');
  });

  // Also list the IDs for easy copy-paste
  console.log('\n📋 Document IDs (for assignment):');
  console.log(JSON.stringify(data.map(d => d.id), null, 2));
}

listKnowledge().then(() => process.exit(0));
