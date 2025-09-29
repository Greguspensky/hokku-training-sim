import { NextRequest, NextResponse } from 'next/server';
import { scenarioService } from '@/lib/scenarios';
import { getCurrentUser } from '@/lib/auth';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    
    // Temporarily allow demo mode for testing
    const demoUser = user || {
      id: 'demo-user',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'manager'
    };

    const resolvedParams = await params;
    const scenario = await scenarioService.getScenario(resolvedParams.id);
    
    if (!scenario) {
      return NextResponse.json(
        { error: 'Scenario not found' },
        { status: 404 }
      );
    }

    const translationStatus = scenarioService.getTranslationStatus(scenario);

    return NextResponse.json({
      success: true,
      scenario,
      translationStatus
    });

  } catch (error) {
    console.error('Get scenario error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch scenario' 
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    console.log('Scenario PATCH - User check:', { user });
    
    // Temporarily allow demo mode for testing
    const demoUser = user || {
      id: 'demo-user',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'manager'
    };
    
    console.log('Using user:', demoUser);

    const resolvedParams = await params;
    const body = await request.json();
    
    console.log('Updating scenario ID:', resolvedParams.id);
    console.log('Update data:', body);
    
    // Prepare update data, including topic_ids for theory scenarios
    const updateData = {
      title: body.title || '',
      description: body.description,
      client_behavior: body.client_behavior,
      expected_response: body.expected_response,
      difficulty: body.difficulty,
      estimated_duration_minutes: body.estimated_duration_minutes,
      milestones: body.milestones || [],
      topic_ids: body.topic_ids || []
    };
    
    // Validate required fields based on scenario type
    if (body.scenario_type === 'service_practice') {
      if (!body.title) {
        return NextResponse.json(
          { success: false, error: 'Situation is required for service practice scenarios' },
          { status: 400 }
        );
      }
      if (!body.client_behavior || !body.expected_response) {
        return NextResponse.json(
          { success: false, error: 'Client behavior and expected response are required for service practice scenarios' },
          { status: 400 }
        );
      }
    }

    // For theory scenarios, validate topic selection
    if (body.scenario_type === 'theory') {
      if (!body.topic_ids || body.topic_ids.length === 0) {
        return NextResponse.json(
          { success: false, error: 'At least one topic must be selected for theory scenarios' },
          { status: 400 }
        );
      }
    }

    const scenario = await scenarioService.updateScenario(resolvedParams.id, updateData);

    return NextResponse.json({
      success: true,
      scenario,
      message: 'Scenario updated successfully'
    });

  } catch (error) {
    console.error('Update scenario error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update scenario' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    
    // Temporarily allow demo mode for testing
    const demoUser = user || {
      id: 'demo-user',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'manager'
    };

    const resolvedParams = await params;
    await scenarioService.deleteScenario(resolvedParams.id);

    return NextResponse.json({
      success: true,
      message: 'Scenario deleted successfully'
    });

  } catch (error) {
    console.error('Delete scenario error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete scenario' 
      },
      { status: 500 }
    );
  }
}