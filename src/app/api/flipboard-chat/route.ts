import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    const { scenarioId, userMessage, conversationHistory, language } = await request.json();

    if (!scenarioId || !userMessage) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('🔄 Flipboard chat request:', { scenarioId, userMessage, language });

    // Fetch scenario details
    const { data: scenario, error: scenarioError } = await supabase
      .from('scenarios')
      .select('*')
      .eq('id', scenarioId)
      .single();

    if (scenarioError || !scenario) {
      console.error('❌ Failed to load scenario:', scenarioError);
      return NextResponse.json(
        { error: 'Failed to load scenario' },
        { status: 500 }
      );
    }

    console.log('📋 Scenario loaded:', {
      id: scenario.id,
      title: scenario.title,
      knowledge_document_ids: scenario.knowledge_document_ids,
      knowledge_category_ids: scenario.knowledge_category_ids
    });

    // Fetch knowledge base documents for this scenario
    let knowledgeContext = '';

    if (scenario.knowledge_document_ids && scenario.knowledge_document_ids.length > 0) {
      const { data: documents, error: docsError } = await supabase
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
      knowledgeContext = 'No specific knowledge base available. Answer based on general hospitality knowledge.';
    }

    // Build conversation messages for GPT
    const messages: any[] = [
      {
        role: 'system',
        content: `You are a helpful training assistant for ${scenario.establishment_type || 'a hospitality business'}.

${scenario.description || ''}

Your role is to help employees learn about their workplace through interactive text conversations. Answer questions clearly and concisely based on the knowledge base provided.

KNOWLEDGE BASE:
${knowledgeContext}

Guidelines:
- Answer questions directly and accurately based on the knowledge base
- Keep responses conversational but professional
- If information isn't in the knowledge base, acknowledge it and provide general hospitality guidance
- Be encouraging and supportive
- Respond in ${language || 'English'}
`
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
    console.error('❌ Flipboard chat error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
