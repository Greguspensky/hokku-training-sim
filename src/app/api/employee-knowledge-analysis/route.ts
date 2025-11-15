import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing required Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

// TypeScript interfaces for analysis results
interface TopicMastery {
  topic: string
  score: number // 0-100
  total_questions: number
  correct: number
  incorrect: number
  unanswered: number
  issues: string[] // e.g., ["Lacks detail on seasonal drinks", "Confuses ingredients"]
}

interface AnswerQualityTheme {
  theme: string // e.g., "Short answers", "Factual errors", "Lazy responses"
  frequency: number
  severity: 'low' | 'medium' | 'high'
  examples: Array<{
    question: string
    answer: string
    issue: string
  }>
}

interface ProductKnowledge {
  product: string
  mentioned_in_theory: boolean
  applied_in_practice: boolean
  accuracy_notes: string
  evidence?: string
}

interface TheoryVsPracticeGap {
  gap: string
  evidence: string
  severity: 'low' | 'medium' | 'high'
}

interface KnowledgeAnalysisResults {
  overall_knowledge_score: number // 0-100
  topic_mastery: TopicMastery[]
  answer_quality_themes: AnswerQualityTheme[]
  product_knowledge: ProductKnowledge[]
  theory_vs_practice_gaps: TheoryVsPracticeGap[]
  summary: string
}

export async function POST(request: NextRequest) {
  try {
    const { employeeId, companyId, forceReAnalysis } = await request.json()

    console.log('🔬 Knowledge analysis request:', { employeeId, companyId, forceReAnalysis })

    if (!employeeId || !companyId) {
      return NextResponse.json(
        { error: 'Missing required fields: employeeId, companyId' },
        { status: 400 }
      )
    }

    // Check for cached analysis first (unless force re-analysis requested)
    if (!forceReAnalysis) {
      const { data: cachedAnalysis, error: cacheError } = await supabase
        .from('employee_knowledge_analysis')
        .select('*')
        .eq('user_id', employeeId)
        .eq('company_id', companyId)
        .single()

      // If the table doesn't exist, provide a helpful error message
      if (cacheError && cacheError.code === '42P01') {
        console.error('❌ Table employee_knowledge_analysis does not exist')
        return NextResponse.json(
          {
            error: 'Database table not found. Please run the migration:\nmigrations/add_employee_knowledge_analysis_table.sql\n\nCopy the SQL to Supabase SQL Editor and execute it.',
            code: 'TABLE_NOT_FOUND'
          },
          { status: 500 }
        )
      }

      if (cachedAnalysis && !cacheError) {
        console.log(`📦 Returning cached knowledge analysis for employee ${employeeId}`)
        return NextResponse.json({
          success: true,
          cached: true,
          analysis: cachedAnalysis.analysis_results,
          analyzedAt: cachedAnalysis.analyzed_at,
          sessionsAnalyzed: cachedAnalysis.sessions_analyzed,
        })
      }
    }

    console.log(`🔬 Generating new knowledge analysis for employee ${employeeId}...`)

    // Step 1: Fetch all Theory Q&A question attempts
    console.log('📝 Fetching Theory Q&A question attempts...')
    const { data: questionAttempts, error: attemptsError } = await supabase
      .from('question_attempts')
      .select(`
        id,
        question_asked,
        user_answer,
        correct_answer,
        is_correct,
        points_earned,
        created_at,
        knowledge_topics (
          id,
          name,
          category
        )
      `)
      .eq('user_id', employeeId)
      .order('created_at', { ascending: false })

    if (attemptsError) {
      console.error('❌ Error fetching question attempts:', attemptsError)
      return NextResponse.json({
        error: 'Failed to fetch question attempts',
        details: attemptsError.message
      }, { status: 500 })
    }

    console.log(`✅ Found ${questionAttempts?.length || 0} question attempts`)

    // Step 2: Fetch all Service Practice sessions with assessment results
    console.log('🎭 Fetching Service Practice sessions...')
    const { data: servicePracticeSessions, error: sessionsError } = await supabase
      .from('training_sessions')
      .select(`
        id,
        training_mode,
        elevenlabs_conversation_id,
        knowledge_context,
        service_practice_assessment_results,
        created_at
      `)
      .eq('employee_id', employeeId)
      .eq('training_mode', 'service_practice')
      .not('service_practice_assessment_results', 'is', null)
      .order('created_at', { ascending: false })

    if (sessionsError) {
      console.error('❌ Error fetching service practice sessions:', sessionsError)
      return NextResponse.json({
        error: 'Failed to fetch sessions',
        details: sessionsError.message
      }, { status: 500 })
    }

    console.log(`✅ Found ${servicePracticeSessions?.length || 0} service practice sessions`)

    // Step 3: Fetch knowledge base documents for the company
    console.log('📚 Fetching knowledge base documents...')
    const { data: knowledgeDocs, error: docsError } = await supabase
      .from('knowledge_base_documents')
      .select('id, title, content, item_type, category_id')
      .eq('company_id', companyId)
      .order('title', { ascending: true })

    if (docsError) {
      console.error('❌ Error fetching knowledge documents:', docsError)
      return NextResponse.json({
        error: 'Failed to fetch knowledge base',
        details: docsError.message
      }, { status: 500 })
    }

    console.log(`✅ Found ${knowledgeDocs?.length || 0} knowledge documents`)

    const totalSessions = (questionAttempts?.length || 0) + (servicePracticeSessions?.length || 0)

    if (totalSessions === 0) {
      return NextResponse.json({
        success: true,
        analysis: {
          overall_knowledge_score: 0,
          topic_mastery: [],
          answer_quality_themes: [],
          product_knowledge: [],
          theory_vs_practice_gaps: [],
          summary: 'No training data available for analysis.',
        },
        analyzedAt: new Date().toISOString(),
        sessionsAnalyzed: 0,
      })
    }

    // Step 4: Prepare data for GPT-4 analysis
    const theoryQAData = questionAttempts?.map((attempt: any) => ({
      topic: attempt.knowledge_topics?.name || 'Unknown',
      question: attempt.question_asked,
      userAnswer: attempt.user_answer,
      correctAnswer: attempt.correct_answer,
      isCorrect: attempt.is_correct,
    })) || []

    const servicePracticeData = servicePracticeSessions?.map((session: any) => ({
      sessionId: session.id,
      knowledgeContext: session.knowledge_context,
      assessment: session.service_practice_assessment_results,
    })) || []

    const knowledgeBase = knowledgeDocs?.map((doc: any) => ({
      title: doc.title,
      content: doc.content,
      type: doc.item_type,
    })) || []

    // Step 5: Call GPT-4 for comprehensive analysis
    const analysisPrompt = `You are an expert training analyst evaluating an employee's knowledge mastery across Theory Q&A and Service Practice training sessions.

**Employee Training Data:**

**Theory Q&A Attempts (${theoryQAData.length} questions):**
${JSON.stringify(theoryQAData, null, 2)}

**Service Practice Sessions (${servicePracticeData.length} sessions):**
${JSON.stringify(servicePracticeData, null, 2)}

**Company Knowledge Base (${knowledgeBase.length} items):**
${JSON.stringify(knowledgeBase, null, 2)}

---

**Your Task:**
Analyze this employee's knowledge mastery and provide actionable insights for managers. Focus on:

1. **Topic-Level Mastery**: Group questions by topic and calculate mastery scores (0-100). Identify specific issues like "Lacks detail on seasonal drinks" or "Confuses espresso types".

2. **Answer Quality Themes**: Detect patterns in answer quality:
   - **Short/Incomplete Answers**: Not enough detail, missing key points
   - **Factual Errors**: Incorrect information, wrong ingredients, wrong procedures
   - **Lazy Responses**: One-word answers, "I don't know", minimal effort
   - **Poor Wording**: Unclear explanations, unprofessional language

3. **Product Knowledge Accuracy**: Extract specific product/menu item mentions:
   - Which products did the employee demonstrate knowledge of in Theory Q&A?
   - Which products were mentioned in Service Practice conversations?
   - Were products described accurately or with errors?

4. **Theory vs Practice Gaps**: Compare theoretical knowledge with practical application:
   - Does the employee know products in theory but fail to suggest them in practice?
   - Do they give correct answers in Q&A but make mistakes in real conversations?

**Output Format (strict JSON):**
\`\`\`json
{
  "overall_knowledge_score": <0-100>,
  "topic_mastery": [
    {
      "topic": "Menu Items",
      "score": 75,
      "total_questions": 10,
      "correct": 7,
      "incorrect": 2,
      "unanswered": 1,
      "issues": ["Lacks detail on seasonal drinks", "Confuses milk types"]
    }
  ],
  "answer_quality_themes": [
    {
      "theme": "Short, non-descriptive answers",
      "frequency": 5,
      "severity": "high",
      "examples": [
        {
          "question": "What is a cappuccino?",
          "answer": "Coffee with milk.",
          "issue": "Missing key details about ratios (espresso, steamed milk, foam)"
        }
      ]
    }
  ],
  "product_knowledge": [
    {
      "product": "Pumpkin Spice Latte",
      "mentioned_in_theory": true,
      "applied_in_practice": false,
      "accuracy_notes": "Correctly described ingredients in Q&A but never suggested to customers",
      "evidence": "Theory Q&A answer included all correct ingredients"
    }
  ],
  "theory_vs_practice_gaps": [
    {
      "gap": "Knows seasonal drinks in theory but never suggests them in practice",
      "evidence": "Answered 4/5 seasonal drink questions correctly but mentioned only 1 seasonal item across 3 Service Practice sessions",
      "severity": "high"
    }
  ],
  "summary": "Employee demonstrates solid foundational knowledge (70/100) but shows significant gaps in answer completeness and practical application..."
}
\`\`\`

**Important Guidelines:**
- Be specific with issues (not generic like "needs improvement")
- Provide evidence-based examples
- Calculate accurate percentages and scores
- Identify actionable patterns managers can address in coaching
- Use severity levels: low (minor), medium (moderate concern), high (critical gap)
- If data is limited, note this in the summary

Return ONLY valid JSON, no additional text.`

    console.log('📤 Sending knowledge analysis request to GPT-4...')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert training analyst. Return only valid JSON with no additional text.',
        },
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    })

    const analysisText = completion.choices[0]?.message?.content?.trim()

    if (!analysisText) {
      throw new Error('Empty response from OpenAI')
    }

    // Parse GPT-4 response
    let analysisResults: KnowledgeAnalysisResults

    try {
      // Remove markdown code fences if present
      const cleanedText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      analysisResults = JSON.parse(cleanedText)
    } catch (parseError) {
      console.error('Failed to parse GPT-4 response:', analysisText)
      throw new Error('Invalid JSON response from GPT-4')
    }

    console.log('✅ Successfully generated knowledge analysis')

    // Step 6: Cache results in database
    const { error: upsertError } = await supabase
      .from('employee_knowledge_analysis')
      .upsert(
        {
          user_id: employeeId,
          company_id: companyId,
          analysis_results: analysisResults,
          sessions_analyzed: totalSessions,
          analyzed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,company_id',
        }
      )

    if (upsertError) {
      console.error('Error caching analysis results:', upsertError)
      // Continue anyway - we'll return the results even if caching fails
    }

    return NextResponse.json({
      success: true,
      cached: false,
      analysis: analysisResults,
      analyzedAt: new Date().toISOString(),
      sessionsAnalyzed: totalSessions,
    })
  } catch (error) {
    console.error('Error in employee knowledge analysis:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
