import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')

    if (!companyId) {
      return NextResponse.json({
        success: false,
        error: 'Company ID is required'
      }, { status: 400 })
    }

    console.log(`🔍 Fetching recommendation questions for company: ${companyId}`)

    const { data: questions, error } = await supabaseAdmin
      .from('recommendation_questions')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching recommendation questions:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch recommendation questions'
      }, { status: 500 })
    }

    console.log(`✅ Found ${questions?.length || 0} recommendation questions`)

    return NextResponse.json({
      success: true,
      questions: questions || []
    })

  } catch (error) {
    console.error('❌ Error in recommendation-questions API (GET):', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { questions, category, difficulty_level, company_id } = body

    if (!questions || !category || !difficulty_level || !company_id) {
      return NextResponse.json({
        success: false,
        error: 'Questions, category, difficulty level, and company ID are required'
      }, { status: 400 })
    }

    console.log(`💡 Adding recommendation questions for company: ${company_id}`)
    console.log(`📝 Category: ${category}, Difficulty: ${difficulty_level}`)

    // Split questions by line and clean them up
    const questionLines = questions.split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)

    if (questionLines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid questions found'
      }, { status: 400 })
    }

    console.log(`📊 Processing ${questionLines.length} questions`)

    // Insert each question into the database
    const questionsToInsert = questionLines.map((questionText: string) => ({
      id: crypto.randomUUID(),
      company_id,
      question_text: questionText,
      category: category.trim(),
      difficulty_level: parseInt(difficulty_level),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))

    const { data: insertedQuestions, error } = await supabaseAdmin
      .from('recommendation_questions')
      .insert(questionsToInsert)
      .select()

    if (error) {
      console.error('❌ Error inserting recommendation questions:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to save recommendation questions'
      }, { status: 500 })
    }

    console.log(`✅ Successfully saved ${insertedQuestions?.length || 0} recommendation questions`)

    return NextResponse.json({
      success: true,
      questionsSaved: insertedQuestions?.length || 0,
      category,
      difficulty_level,
      questions: insertedQuestions
    })

  } catch (error) {
    console.error('❌ Error in recommendation-questions API (POST):', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}