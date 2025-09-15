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
      title: body.title,
      description: body.description,
      scenario_type: body.scenario_type || 'service_practice',
      template_type: body.template_type || 'general_flow',
      client_behavior: body.client_behavior,
      expected_response: body.expected_response,
      difficulty: body.difficulty || 'beginner',
      estimated_duration_minutes: body.estimated_duration_minutes || 30
    };

    // Validate required fields based on scenario type
    if (!scenarioData.track_id || !scenarioData.company_id) {
      return NextResponse.json(
        { success: false, error: 'track_id and company_id are required' },
        { status: 400 }
      );
    }

    // Additional validation for service practice scenarios
    if (scenarioData.scenario_type === 'service_practice') {
      if (!scenarioData.title || !scenarioData.description || !scenarioData.client_behavior || !scenarioData.expected_response) {
        return NextResponse.json(
          { success: false, error: 'For service practice scenarios: title, description, client_behavior, and expected_response are required' },
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

