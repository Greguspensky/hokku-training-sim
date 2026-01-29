import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Helper function to get training mode display name
function getTrainingModeDisplay(trainingMode: string): string {
  const modeMap: Record<string, string> = {
    'theory': 'Theory Q&A',
    'service_practice': 'Service Practice',
    'recommendation_tts': 'Recommendation',
    'recommendation': 'Recommendation'
  }
  return modeMap[trainingMode] || trainingMode
}

/**
 * API endpoint to record when a training session starts
 * Creates a minimal training_session record for attempt counting
 * The record will be updated with full details when the session ends
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      sessionId,
      employeeId,
      assignmentId,
      companyId,
      scenarioId,
      trainingMode,
      language,
      agentId
    } = body

    // Validate required fields
    if (!sessionId || !employeeId || !assignmentId || !companyId || !trainingMode) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: sessionId, employeeId, assignmentId, companyId, trainingMode'
        },
        { status: 400 }
      )
    }

    // Check if session record already exists (to prevent duplicates)
    const { data: existingSession } = await supabaseAdmin
      .from('training_sessions')
      .select('id')
      .eq('id', sessionId)
      .single()

    if (existingSession) {
      console.log(`⚠️ Session ${sessionId} already exists - skipping duplicate creation`)
      return NextResponse.json({
        success: true,
        message: 'Session already exists',
        sessionId: sessionId
      })
    }

    // 🔒 BLOCK: Check for unanalyzed previous theory sessions (per-scenario)
    if (trainingMode === 'theory' && scenarioId) {
      console.log(`🔍 Checking for unanalyzed theory sessions for scenario: ${scenarioId}`)

      const { data: previousSessions, error: checkError } = await supabaseAdmin
        .from('training_sessions')
        .select('id, session_name, started_at, assessment_status')
        .eq('employee_id', employeeId)
        .eq('scenario_id', scenarioId)
        .eq('training_mode', 'theory')
        .neq('id', sessionId) // Exclude the current session being created
        .order('started_at', { ascending: false })
        .limit(1)

      if (checkError) {
        console.error('❌ Error checking previous sessions:', checkError)
        // Don't block on error - allow session to proceed
      } else if (previousSessions && previousSessions.length > 0) {
        const lastSession = previousSessions[0]
        const isAnalyzed = lastSession.assessment_status === 'completed'

        console.log(`📊 Last session status: ${lastSession.assessment_status || 'pending'}`)

        if (!isAnalyzed) {
          console.warn(`🔒 BLOCKED: Employee must analyze previous session before starting new one`)
          return NextResponse.json({
            success: false,
            error: 'ANALYSIS_REQUIRED',
            message: 'You must analyze your previous theory session before starting a new one',
            blockingSessionId: lastSession.id,
            blockingSessionName: lastSession.session_name,
            requiresAnalysis: true
          }, { status: 423 }) // 423 Locked
        } else {
          console.log(`✅ Previous session analyzed - allowing new session`)
        }
      } else {
        console.log(`✅ No previous sessions found - allowing first session`)
      }
    }

    // Create minimal session record to count as an attempt
    const now = new Date().toISOString()
    const sessionRecord = {
      id: sessionId, // Use the provided sessionId
      employee_id: employeeId,
      assignment_id: assignmentId,
      company_id: companyId,
      scenario_id: scenarioId || null,
      session_name: `${getTrainingModeDisplay(trainingMode)} Session - In Progress`,
      training_mode: trainingMode,
      language: language || 'en',
      agent_id: agentId || 'unknown',
      knowledge_context: null,
      conversation_transcript: [],
      session_duration_seconds: 0,
      started_at: now,
      ended_at: now, // Will be updated when session actually ends
      recording_preference: 'none', // Will be updated when session ends
      created_at: now
    }

    console.log('📝 Creating minimal session record for attempt counting:', sessionId)

    const { data, error } = await supabaseAdmin
      .from('training_sessions')
      .insert(sessionRecord)
      .select()
      .single()

    if (error) {
      console.error('❌ Error creating session start record:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    console.log('✅ Session start recorded successfully:', sessionId)

    return NextResponse.json({
      success: true,
      sessionId: data.id
    })

  } catch (error) {
    console.error('❌ Failed to record session start:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record session start'
      },
      { status: 500 }
    )
  }
}
