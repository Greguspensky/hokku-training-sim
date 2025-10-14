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
    // Now using the dedicated scenario_id column
    const { data: sessions, error } = await supabaseAdmin
      .from('training_sessions')
      .select('*')
      .eq('employee_id', userId)
      .eq('scenario_id', scenarioId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching scenario stats:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const scenarioSessions = sessions || []

    // Calculate statistics
    const attemptCount = scenarioSessions.length;
    const lastAttempt = scenarioSessions[0]?.created_at || null;
    const completedSessions = scenarioSessions.filter(s => s.completed_at !== null);

    // For theory scenarios, calculate completion percentage based on correctly answered questions
    let completionPercentage = 0;
    if (scenarioSessions.length > 0) {
      // Get the most recent session
      const latestSession = scenarioSessions[0];
      const scenarioType = latestSession.training_mode;

      if (scenarioType === 'theory') {
        // Step 1: Get the scenario details to find topic_ids
        const { data: scenario, error: scenarioError } = await supabaseAdmin
          .from('scenarios')
          .select('topic_ids')
          .eq('id', scenarioId)
          .single();

        if (!scenarioError && scenario && scenario.topic_ids && scenario.topic_ids.length > 0) {
          // Step 2: Get all questions for this scenario's topics
          const { data: questions, error: questionsError } = await supabaseAdmin
            .from('topic_questions')
            .select('id')
            .in('topic_id', scenario.topic_ids)
            .eq('is_active', true);

          if (!questionsError && questions) {
            const totalQuestions = questions.length;
            const questionIds = questions.map(q => q.id);

            if (totalQuestions > 0) {
              // Step 3: Get question attempts for this user and these questions
              // Find questions that have been answered correctly at least once
              const { data: correctAttempts, error: attemptsError } = await supabaseAdmin
                .from('question_attempts')
                .select('question_id, is_correct')
                .eq('employee_id', userId)
                .in('question_id', questionIds)
                .eq('is_correct', true);

              if (!attemptsError && correctAttempts) {
                // Count unique questions answered correctly
                const uniqueCorrectQuestions = new Set(correctAttempts.map(a => a.question_id));
                const correctCount = uniqueCorrectQuestions.size;

                // Calculate percentage
                completionPercentage = Math.round((correctCount / totalQuestions) * 100);
                console.log(`📊 Theory completion for scenario ${scenarioId}: ${correctCount}/${totalQuestions} questions correct (${completionPercentage}%)`);
              }
            }
          }
        }
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
