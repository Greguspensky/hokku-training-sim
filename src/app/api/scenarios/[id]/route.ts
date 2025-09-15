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
    
    // Validate required fields based on scenario type
    if (body.scenario_type === 'service_practice') {
      if (!body.title || !body.description || !body.client_behavior || !body.expected_response) {
        return NextResponse.json(
          { success: false, error: 'For service practice scenarios: title, description, client_behavior, and expected_response are required' },
          { status: 400 }
        );
      }
    }

    const scenario = await scenarioService.updateScenario(resolvedParams.id, body);

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