import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const scenarioId = searchParams.get('scenario_id');
    const userId = searchParams.get('user_id');

    if (!scenarioId || !userId) {
      return NextResponse.json(
        { success: false, error: 'scenario_id and user_id are required' },
        { status: 400 }
      );
    }

    // Get all sessions for this scenario and user
    // Note: using session_data->>'scenario_id' to access JSON field
    const { data: sessions, error } = await supabaseAdmin
      .from('training_sessions')
      .select('*')
      .eq('employee_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching scenario stats:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Filter sessions by scenario_id from session_data
    const scenarioSessions = sessions?.filter(session => {
      const sessionScenarioId = session.session_data?.scenario_id || session.session_data?.scenarioId
      return sessionScenarioId === scenarioId
    }) || []

    // Calculate statistics
    const attemptCount = scenarioSessions.length;
    const lastAttempt = scenarioSessions[0]?.created_at || null;
    const completedSessions = scenarioSessions.filter(s => s.completed_at !== null);

    // For theory scenarios, calculate completion percentage based on answered questions
    let completionPercentage = 0;
    if (scenarioSessions.length > 0) {
      // Get the most recent session
      const latestSession = scenarioSessions[0];
      const scenarioType = latestSession.session_data?.scenario_type || latestSession.session_data?.scenarioType;

      if (scenarioType === 'theory') {
        // For theory, use transcript data to calculate answered questions
        const transcript = latestSession.transcript || [];
        const questionCount = transcript.filter((msg: any) =>
          msg.role === 'assistant' && msg.message?.includes('?')
        ).length;

        // Assuming each session should have a certain number of questions
        // You can adjust this based on your scenario configuration
        const expectedQuestions = 10; // or get from scenario.topic_ids length
        completionPercentage = questionCount > 0
          ? Math.round((questionCount / expectedQuestions) * 100)
          : 0;
      } else {
        // For service_practice and recommendations, it's binary: completed or not
        completionPercentage = completedSessions.length > 0 ? 100 : 0;
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        attemptCount,
        lastAttempt,
        completionPercentage,
        isCompleted: completedSessions.length > 0
      }
    });

  } catch (error) {
    console.error('Scenario stats error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch scenario stats'
      },
      { status: 500 }
    );
  }
}
