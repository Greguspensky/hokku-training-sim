import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { checkDemoRateLimit, extractClientIP } from '@/lib/demo-rate-limit';

const DEMO_SCENARIO_ID = '13a2c2f3-24fc-4f20-abd6-f3ab2a7abc01';

// Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Demo Flipboard Text Chat API
 * Handles text-based conversations for the public demo
 * Uses OpenAI GPT-4o-mini with Hotel Mota knowledge base
 */
export async function POST(request: NextRequest) {
  try {
    const { userMessage, conversationHistory, language = 'en' } = await request.json();

    if (!userMessage) {
      return NextResponse.json(
        { error: 'Missing userMessage' },
        { status: 400 }
      );
    }

    // Extract client IP for rate limiting
    const ip = extractClientIP(request.headers);

    // Check rate limit
    const isAllowed = await checkDemoRateLimit(ip);
    if (!isAllowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'You have reached the maximum number of demo messages for this hour.',
        },
        { status: 429 }
      );
    }

    console.log('🔄 Demo flipboard chat request:', { userMessage: userMessage.substring(0, 50), language });

    // Fetch scenario details
    const { data: scenario, error: scenarioError } = await supabaseAdmin
      .from('scenarios')
      .select('*')
      .eq('id', DEMO_SCENARIO_ID)
      .single();

    if (scenarioError || !scenario) {
      console.error('❌ Failed to load demo scenario:', scenarioError);
      return NextResponse.json(
        { error: 'Failed to load demo scenario' },
        { status: 500 }
      );
    }

    // Fetch knowledge base documents
    let knowledgeContext = '';

    if (scenario.knowledge_document_ids && scenario.knowledge_document_ids.length > 0) {
      const { data: documents, error: docsError } = await supabaseAdmin
        .from('knowledge_base_documents')
        .select('*')
        .in('id', scenario.knowledge_document_ids);

      if (!docsError && documents) {
        knowledgeContext = documents
          .map((doc: any) => `${doc.title}:\n${doc.content}`)
          .join('\n\n---\n\n');
        console.log(`📚 Loaded ${documents.length} knowledge documents`);
      }
    }

    if (!knowledgeContext) {
      knowledgeContext = 'No specific knowledge base available. Answer based on general hospitality knowledge for a hotel reception.';
    }

    // Build conversation messages for GPT
    const messages: any[] = [
      {
        role: 'system',
        content: `You are a helpful and professional Front Desk Receptionist at ${scenario.establishment_type || 'Hotel Mota'}.

${scenario.description || 'You work at the reception desk and help guests with their questions.'}

Your role is to help guests by answering their questions accurately and professionally. You represent the hotel and should provide excellent customer service.

KNOWLEDGE BASE:
${knowledgeContext}

Guidelines:
- Answer questions directly and accurately based on the knowledge base
- Keep responses conversational but professional
- If information isn't in the knowledge base, politely say you'll need to check with management or refer to specific hotel resources
- Be warm, welcoming, and helpful
- Use natural language in ${language || 'English'}
- Respond as if you're a real receptionist helping a guest in person

Remember: You are the receptionist, and the guest is asking YOU questions about the hotel.`
      }
    ];

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach((msg: any) => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage
    });

    console.log('🤖 Calling OpenAI with', messages.length, 'messages');

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const assistantMessage = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    console.log('✅ Generated response:', assistantMessage.substring(0, 100) + '...');

    return NextResponse.json({
      message: assistantMessage,
      timestamp: Date.now()
    });

  } catch (error: any) {
    console.error('❌ Demo flipboard chat error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
