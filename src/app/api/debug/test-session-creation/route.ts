/**
 * Debug endpoint to test session creation flow
 * POST /api/debug/test-session-creation
 * Body: { userId, scenarioId, trainingMode }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, scenarioId, trainingMode } = body

    console.log('🧪 Testing session creation flow:', { userId, scenarioId, trainingMode })

    if (!userId || !scenarioId || !trainingMode) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, scenarioId, trainingMode' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Verify user exists
    console.log('1️⃣ Checking if user exists...')
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name, role, company_id')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json({
        success: false,
        step: 'user_lookup',
        error: 'User not found',
        details: userError
      }, { status: 404 })
    }
    console.log('✅ User found:', user.email)

    // Step 2: Verify scenario exists
    console.log('2️⃣ Checking if scenario exists...')
    const { data: scenario, error: scenarioError } = await supabase
      .from('scenarios')
      .select('id, title, company_id, customer_emotion_level')
      .eq('id', scenarioId)
      .single()

    if (scenarioError || !scenario) {
      return NextResponse.json({
        success: false,
        step: 'scenario_lookup',
        error: 'Scenario not found',
        details: scenarioError
      }, { status: 404 })
    }
    console.log('✅ Scenario found:', scenario.title)

    // Step 3: Check company match
    console.log('3️⃣ Verifying company match...')
    if (user.company_id !== scenario.company_id) {
      return NextResponse.json({
        success: false,
        step: 'company_verification',
        error: 'Company mismatch',
        user_company: user.company_id,
        scenario_company: scenario.company_id
      }, { status: 403 })
    }
    console.log('✅ Company matches')

    // Step 4: Try to create session
    console.log('4️⃣ Attempting to create training session...')
    const sessionData = {
      user_id: userId,
      employee_id: userId, // Some tables use this
      scenario_id: scenarioId,
      training_mode: trainingMode,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    }

    const { data: session, error: sessionError } = await supabase
      .from('training_sessions')
      .insert(sessionData)
      .select()
      .single()

    if (sessionError) {
      return NextResponse.json({
        success: false,
        step: 'session_creation',
        error: 'Failed to create session',
        details: sessionError,
        attempted_data: sessionData
      }, { status: 500 })
    }

    console.log('✅ Session created successfully:', session.id)

    // Step 5: Verify session was saved
    console.log('5️⃣ Verifying session in database...')
    const { data: verifySession, error: verifyError } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('id', session.id)
      .single()

    if (verifyError || !verifySession) {
      return NextResponse.json({
        success: false,
        step: 'session_verification',
        error: 'Session not found after creation',
        details: verifyError
      }, { status: 500 })
    }

    console.log('✅ Session verified in database')

    return NextResponse.json({
      success: true,
      message: 'Session creation flow test completed successfully',
      session_id: session.id,
      steps_completed: [
        'user_lookup',
        'scenario_lookup',
        'company_verification',
        'session_creation',
        'session_verification'
      ],
      session_data: verifySession
    })

  } catch (error) {
    console.error('❌ Test session creation failed:', error)
    return NextResponse.json(
      {
        success: false,
        step: 'unknown',
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
