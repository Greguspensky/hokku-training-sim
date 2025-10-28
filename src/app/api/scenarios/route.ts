import { NextRequest, NextResponse } from 'next/server';
import { scenarioService, type CreateScenarioData } from '@/lib/scenarios';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    console.log('Scenario POST - User check:', { user });
    
    // Temporarily allow demo mode for testing
    const demoUser = user || {
      id: 'demo-user',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'manager'
    };
    
    console.log('Using user:', demoUser);

    const body = await request.json();
    const scenarioData: CreateScenarioData = {
      track_id: body.track_id,
      company_id: body.company_id,
      title: body.title || '', // Make title optional for theory scenarios
      description: '', // Set empty description since field was removed
      scenario_type: body.scenario_type || 'service_practice',
      template_type: body.template_type || 'general_flow',
      client_behavior: body.client_behavior,
      expected_response: body.expected_response,
      difficulty: body.difficulty || 'beginner',
      estimated_duration_minutes: body.estimated_duration_minutes || 30,
      session_time_limit_minutes: body.session_time_limit_minutes || 10,
      milestones: body.milestones || [],
      knowledge_category_ids: body.knowledge_category_ids || [],
      knowledge_document_ids: body.knowledge_document_ids || [],
      topic_ids: body.topic_ids || [],
      recommendation_question_ids: body.recommendation_question_ids || [],
      recommendation_question_durations: body.recommendation_question_durations || {},
      instructions: body.instructions,
      customer_emotion_level: body.customer_emotion_level || 'calm',
      voice_ids: body.voice_ids || (body.voice_id ? [body.voice_id] : ['random']) // Support both voice_ids array and legacy voice_id
    };

    // Validate required fields for all scenarios
    if (!scenarioData.track_id || !scenarioData.company_id) {
      return NextResponse.json(
        { success: false, error: 'track_id and company_id are required' },
        { status: 400 }
      );
    }

    // Validate required fields based on scenario type
    if (scenarioData.scenario_type === 'service_practice') {
      if (!scenarioData.title) {
        return NextResponse.json(
          { success: false, error: 'Situation is required for service practice scenarios' },
          { status: 400 }
        );
      }
      if (!scenarioData.client_behavior || !scenarioData.expected_response) {
        return NextResponse.json(
          { success: false, error: 'For service practice scenarios: client_behavior and expected_response are required' },
          { status: 400 }
        );
      }
    }

    // For theory scenarios, validate topic selection
    if (scenarioData.scenario_type === 'theory') {
      if (!scenarioData.topic_ids || scenarioData.topic_ids.length === 0) {
        return NextResponse.json(
          { success: false, error: 'At least one topic must be selected for theory scenarios' },
          { status: 400 }
        );
      }
    }

    // For recommendations scenarios, validate question selection
    if (scenarioData.scenario_type === 'recommendations') {
      if (!scenarioData.recommendation_question_ids || scenarioData.recommendation_question_ids.length === 0) {
        return NextResponse.json(
          { success: false, error: 'At least one recommendation question must be selected for recommendations scenarios' },
          { status: 400 }
        );
      }
    }

    const scenario = await scenarioService.createScenario(scenarioData);

    return NextResponse.json({
      success: true,
      scenario,
      message: 'Scenario created successfully'
    });

  } catch (error) {
    console.error('Create scenario error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create scenario' 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    // Temporarily allow demo mode for testing
    const demoUser = user || {
      id: 'demo-user',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'manager'
    };

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');

    const trackId = searchParams.get('track_id');

    if (!companyId && !trackId) {
      return NextResponse.json(
        { success: false, error: 'Either company_id or track_id parameter is required' },
        { status: 400 }
      );
    }

    let scenarios;
    if (trackId) {
      scenarios = await scenarioService.getScenariosByTrack(trackId);
    } else {
      scenarios = await scenarioService.getScenarios(companyId!);
    }

    return NextResponse.json({
      success: true,
      scenarios,
      count: scenarios.length
    });

  } catch (error) {
    console.error('Get scenarios error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch scenarios' 
      },
      { status: 500 }
    );
  }
}

