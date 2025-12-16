import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Demo configuration constants
const DEMO_COMPANY_ID = '9deb2165-32b1-4287-be9d-788a0726408e'; // Hotel Mota
const DEMO_SCENARIO_ID = '13a2c2f3-24fc-4f20-abd6-f3ab2a7abc01'; // Reception scenario

// Supabase admin client with service role (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Load Hotel Mota Reception scenario for demo
 * No authentication required - fully public endpoint
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Loading demo scenario...');

    // Fetch the demo scenario
    const { data: scenario, error: scenarioError } = await supabaseAdmin
      .from('scenarios')
      .select('*')
      .eq('id', DEMO_SCENARIO_ID)
      .single();

    if (scenarioError || !scenario) {
      console.error('❌ Failed to load demo scenario:', scenarioError);
      return NextResponse.json(
        {
          error: 'Demo scenario not found',
          details: scenarioError?.message,
        },
        { status: 404 }
      );
    }

    console.log('✅ Loaded scenario:', scenario.title);

    // Fetch knowledge base documents if assigned
    let knowledgeDocuments = [];

    if (scenario.knowledge_document_ids && scenario.knowledge_document_ids.length > 0) {
      console.log(`📚 Loading ${scenario.knowledge_document_ids.length} knowledge documents...`);

      const { data: docs, error: docsError } = await supabaseAdmin
        .from('knowledge_base_documents')
        .select('*')
        .in('id', scenario.knowledge_document_ids);

      if (docsError) {
        console.warn('⚠️ Failed to load knowledge documents:', docsError);
        // Don't fail the request - continue without knowledge
      } else {
        knowledgeDocuments = docs || [];
        console.log(`✅ Loaded ${knowledgeDocuments.length} knowledge documents`);
      }
    }

    // Return scenario data + knowledge
    return NextResponse.json({
      scenario: {
        id: scenario.id,
        title: scenario.title,
        description: scenario.description,
        scenario_type: scenario.scenario_type,
        employee_role: scenario.employee_role || 'Front Desk Receptionist',
        establishment_type: scenario.establishment_type || 'hotel',
        knowledge_document_ids: scenario.knowledge_document_ids,
        voice_ids: scenario.voice_ids,
        voice_id: scenario.voice_id,
      },
      knowledgeDocuments,
      companyId: DEMO_COMPANY_ID,
    });
  } catch (error: any) {
    console.error('❌ Error in demo scenario loader:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
