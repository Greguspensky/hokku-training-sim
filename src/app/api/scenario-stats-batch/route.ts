import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const scenarioIdsParam = searchParams.get('scenario_ids'); // Comma-separated list
    const userId = searchParams.get('user_id');

    if (!scenarioIdsParam || !userId) {
      return NextResponse.json(
        { success: false, error: 'scenario_ids and user_id are required' },
        { status: 400 }
      );
    }

    // Parse scenario IDs
    const scenarioIds = scenarioIdsParam.split(',').filter(Boolean);

    if (scenarioIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one scenario_id is required' },
        { status: 400 }
      );
    }

    // Fetch all sessions for these scenarios and this user in one query
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('training_sessions')
      .select('*')
      .eq('employee_id', userId)
      .in('scenario_id', scenarioIds)
      .order('created_at', { ascending: false });

    if (sessionsError) {
      console.error('Error fetching scenario sessions:', sessionsError);
      return NextResponse.json(
        { success: false, error: sessionsError.message },
        { status: 500 }
      );
    }

    // Group sessions by scenario_id
    const sessionsByScenario = new Map<string, any[]>();
    for (const session of sessions || []) {
      if (!sessionsByScenario.has(session.scenario_id)) {
        sessionsByScenario.set(session.scenario_id, []);
      }
      sessionsByScenario.get(session.scenario_id)!.push(session);
    }

    // Fetch all scenarios metadata in one query
    const { data: scenarios, error: scenariosError } = await supabaseAdmin
      .from('scenarios')
      .select('id, scenario_type, topic_ids')
      .in('id', scenarioIds);

    if (scenariosError) {
      console.error('Error fetching scenarios:', scenariosError);
      return NextResponse.json(
        { success: false, error: scenariosError.message },
        { status: 500 }
      );
    }

    // Create a map of scenario metadata
    const scenarioMap = new Map(scenarios?.map(s => [s.id, s]) || []);

    // Collect all topic IDs from theory scenarios
    const allTopicIds = new Set<string>();
    for (const scenario of scenarios || []) {
      if (scenario.scenario_type === 'theory' && scenario.topic_ids) {
        scenario.topic_ids.forEach((topicId: string) => allTopicIds.add(topicId));
      }
    }

    // Fetch all questions for these topics in one batch query
    let questionsByTopic = new Map<string, string[]>();
    if (allTopicIds.size > 0) {
      const { data: questions, error: questionsError } = await supabaseAdmin
        .from('topic_questions')
        .select('id, topic_id')
        .in('topic_id', Array.from(allTopicIds))
        .eq('is_active', true);

      if (!questionsError && questions) {
        // Group questions by topic_id
        for (const question of questions) {
          if (!questionsByTopic.has(question.topic_id)) {
            questionsByTopic.set(question.topic_id, []);
          }
          questionsByTopic.get(question.topic_id)!.push(question.id);
        }
      }
    }

    // Get all question IDs across all topics
    const allQuestionIds = new Set<string>();
    questionsByTopic.forEach(qIds => qIds.forEach(qId => allQuestionIds.add(qId)));

    // Fetch all correct attempts for this user in one batch query
    let correctAttemptsByQuestion = new Set<string>();
    if (allQuestionIds.size > 0) {
      const { data: correctAttempts, error: attemptsError } = await supabaseAdmin
        .from('question_attempts')
        .select('question_id')
        .eq('user_id', userId)  // Fixed: question_attempts uses user_id, not employee_id
        .in('question_id', Array.from(allQuestionIds))
        .eq('is_correct', true);

      if (!attemptsError && correctAttempts) {
        correctAttempts.forEach(a => correctAttemptsByQuestion.add(a.question_id));
      }
    }

    // Calculate stats for each scenario
    const statsMap: Record<string, any> = {};

    for (const scenarioId of scenarioIds) {
      const scenarioSessions = sessionsByScenario.get(scenarioId) || [];
      const scenario = scenarioMap.get(scenarioId);

      // Basic stats
      const attemptCount = scenarioSessions.length;
      const lastAttempt = scenarioSessions[0]?.created_at || null;
      const completedSessions = scenarioSessions.filter(s => s.completed_at !== null);

      // Calculate completion percentage
      let completionPercentage = 0;

      if (scenario?.scenario_type === 'theory' && scenario.topic_ids && scenario.topic_ids.length > 0) {
        // Get all questions for this scenario's topics
        const scenarioQuestionIds = new Set<string>();
        for (const topicId of scenario.topic_ids) {
          const topicQuestions = questionsByTopic.get(topicId) || [];
          topicQuestions.forEach(qId => scenarioQuestionIds.add(qId));
        }

        const totalQuestions = scenarioQuestionIds.size;
        if (totalQuestions > 0) {
          // Count how many of these questions have been answered correctly
          let correctCount = 0;
          for (const questionId of scenarioQuestionIds) {
            if (correctAttemptsByQuestion.has(questionId)) {
              correctCount++;
            }
          }

          completionPercentage = Math.round((correctCount / totalQuestions) * 100);
        }
      } else {
        // For service_practice and recommendations, it's binary: completed or not
        completionPercentage = completedSessions.length > 0 ? 100 : 0;
      }

      statsMap[scenarioId] = {
        attemptCount,
        lastAttempt,
        completionPercentage,
        isCompleted: completedSessions.length > 0
      };
    }

    console.log(`📊 Batch stats for ${scenarioIds.length} scenarios calculated for user ${userId}`);

    return NextResponse.json({
      success: true,
      stats: statsMap
    });

  } catch (error) {
    console.error('Batch scenario stats error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch batch scenario stats'
      },
      { status: 500 }
    );
  }
}
