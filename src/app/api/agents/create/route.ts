import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, companyName, knowledgeFiles = [] } = body

    if (!companyId || !companyName) {
      return NextResponse.json(
        { success: false, error: 'Company ID and name are required' },
        { status: 400 }
      )
    }

    const elevenlabsKey = process.env.ELEVENLABS_API_KEY
    if (!elevenlabsKey) {
      return NextResponse.json(
        { success: false, error: 'ElevenLabs API key not configured' },
        { status: 500 }
      )
    }

    console.log(`🏢 Creating ElevenLabs agent for company: ${companyName}`)

    // 1. Create agent via ElevenLabs API
    const agentResponse = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenlabsKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `${companyName} Training Agent`,
        conversation_config: {
          agent: {
            prompt: `You are a training assistant for ${companyName}. Use only the provided company knowledge base.

{{#if training_mode == "theory"}}
Act as a strict examiner asking factual questions about company policies, pricing, and procedures. Ask one specific question at a time, wait for the answer, provide brief feedback (correct/incorrect), then move to the next question. Keep responses concise and focused.

Example: "Let's begin the theory assessment. What is the price of [specific menu item] according to company policy?"
{{else}}
Act as a customer interested in ${companyName}'s services. Create realistic scenarios based on the company knowledge. Be conversational and present challenges the employee might face in real customer service situations.

Example: "Hi, I'm interested in your services. Can you help me understand your pricing for [service]?"
{{/if}}

Always stay in character and use only the knowledge provided in your knowledge base. Do not make up information.`,
            llm: {
              model: "gpt-4o",
              temperature: 0.3
            },
            language: "en"
          },
          tts: {
            model: "eleven-multilingual-v1",
            voice_id: "pNInz6obpgDQGcFmaJgB" // Default voice, can be customized per company
          }
        },
        tags: [`company:${companyId}`, "training-agent", "multi-tenant"]
      })
    })

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text()
      console.error('❌ Failed to create ElevenLabs agent:', agentResponse.status, errorText)
      return NextResponse.json(
        { success: false, error: `Agent creation failed: ${agentResponse.statusText}` },
        { status: agentResponse.status }
      )
    }

    const agentData = await agentResponse.json()
    const agentId = agentData.agent_id

    console.log(`✅ Agent created successfully: ${agentId}`)

    // 2. Upload knowledge base files (if provided)
    const knowledgeIds: string[] = []

    if (knowledgeFiles.length > 0) {
      console.log(`📚 Uploading ${knowledgeFiles.length} knowledge base files...`)

      for (const file of knowledgeFiles) {
        try {
          const formData = new FormData()

          if (file.type === 'text') {
            formData.append('text', file.content)
          } else if (file.type === 'url') {
            formData.append('url', file.url)
          } else if (file.type === 'file') {
            // For file uploads, the content should be a blob/buffer
            formData.append('file', file.content, file.filename)
          }

          const kbResponse = await fetch('https://api.elevenlabs.io/v1/convai/knowledge-base', {
            method: 'POST',
            headers: {
              'xi-api-key': elevenlabsKey
              // Don't set Content-Type for FormData - let browser set it
            },
            body: formData
          })

          if (kbResponse.ok) {
            const kbData = await kbResponse.json()
            knowledgeIds.push(kbData.id)
            console.log(`✅ Knowledge file uploaded: ${kbData.id}`)
          } else {
            const errorText = await kbResponse.text()
            console.error(`⚠️ Failed to upload knowledge file:`, errorText)
          }
        } catch (error) {
          console.error(`⚠️ Error uploading knowledge file:`, error)
        }
      }

      // 3. Associate knowledge base with agent (if any files were uploaded)
      if (knowledgeIds.length > 0) {
        const updateResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
          method: 'PATCH',
          headers: {
            'xi-api-key': elevenlabsKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            knowledge_base_ids: knowledgeIds
          })
        })

        if (updateResponse.ok) {
          console.log(`✅ Knowledge base associated with agent: ${knowledgeIds.length} files`)
        } else {
          const errorText = await updateResponse.text()
          console.error(`⚠️ Failed to associate knowledge base:`, errorText)
        }
      }
    }

    // 4. Store agent mapping in our database
    const { data: companyData, error: dbError } = await supabaseAdmin
      .from('companies')
      .upsert({
        id: companyId,
        name: companyName,
        agent_id: agentId,
        knowledge_base_ids: knowledgeIds,
        agent_created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })
      .select()

    if (dbError) {
      console.error('❌ Failed to store agent mapping in database:', dbError)
      // Don't fail the entire operation - the agent is created, just log the DB error
    } else {
      console.log('✅ Agent mapping stored in database')
    }

    return NextResponse.json({
      success: true,
      agent_id: agentId,
      knowledge_base_ids: knowledgeIds,
      company_id: companyId,
      message: `Agent created successfully for ${companyName}`
    })

  } catch (error) {
    console.error('❌ Agent creation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Agent creation failed'
      },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve agent info for a company
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Company ID is required' },
        { status: 400 }
      )
    }

    // Get agent info from database
    const { data: company, error } = await supabaseAdmin
      .from('companies')
      .select('id, name, agent_id, knowledge_base_ids, agent_created_at')
      .eq('id', companyId)
      .single()

    if (error || !company) {
      return NextResponse.json(
        { success: false, error: 'Company agent not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      company_id: company.id,
      company_name: company.name,
      agent_id: company.agent_id,
      knowledge_base_ids: company.knowledge_base_ids,
      created_at: company.agent_created_at
    })

  } catch (error) {
    console.error('❌ Error retrieving agent info:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve agent info'
      },
      { status: 500 }
    )
  }
}