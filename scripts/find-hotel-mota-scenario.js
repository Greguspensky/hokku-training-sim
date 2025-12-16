const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const HOTEL_MOTA_COMPANY_ID = '9deb2165-32b1-4287-be9d-788a0726408e';

async function findHotelMotaScenario() {
  console.log('🔍 Searching for Hotel Mota Flipboard scenarios...\n');

  // Search for flipboard scenarios for Hotel Mota
  const { data: scenarios, error } = await supabase
    .from('scenarios')
    .select('*')
    .eq('company_id', HOTEL_MOTA_COMPANY_ID)
    .eq('scenario_type', 'flipboard');

  if (error) {
    console.error('❌ Error querying scenarios:', error);
    return;
  }

  if (scenarios && scenarios.length > 0) {
    console.log(`✅ Found ${scenarios.length} Flipboard scenario(s) for Hotel Mota:\n`);
    scenarios.forEach((scenario, idx) => {
      console.log(`${idx + 1}. ${scenario.title}`);
      console.log(`   ID: ${scenario.id}`);
      console.log(`   Type: ${scenario.scenario_type}`);
      console.log(`   Employee Role: ${scenario.employee_role || 'Not set'}`);
      console.log(`   Description: ${scenario.description?.substring(0, 100)}...`);
      console.log(`   Knowledge Documents: ${scenario.knowledge_document_ids?.length || 0}`);
      console.log('');
    });

    console.log('\n📋 Use this scenario ID for the demo:');
    console.log(`const DEMO_SCENARIO_ID = '${scenarios[0].id}';\n`);
  } else {
    console.log('❌ No Flipboard scenarios found for Hotel Mota');
    console.log('\nℹ️  You may need to create one. Here\'s how:');
    console.log('1. Go to Manager Dashboard');
    console.log('2. Create a new scenario with:');
    console.log('   - Type: Flipboard');
    console.log('   - Company: Hotel Mota');
    console.log('   - Employee Role: Front Desk Receptionist');
    console.log('   - Assign knowledge documents\n');
  }

  // Also check for any scenarios with "reception" in the title
  console.log('\n🔍 Checking for scenarios with "reception" in title...\n');

  const { data: receptionScenarios, error: error2 } = await supabase
    .from('scenarios')
    .select('*')
    .eq('company_id', HOTEL_MOTA_COMPANY_ID)
    .ilike('title', '%reception%');

  if (!error2 && receptionScenarios && receptionScenarios.length > 0) {
    console.log(`Found ${receptionScenarios.length} scenario(s) with "reception" in title:`);
    receptionScenarios.forEach((s) => {
      console.log(`- ${s.title} (${s.scenario_type}) - ID: ${s.id}`);
    });
  }
}

findHotelMotaScenario().then(() => process.exit(0));
