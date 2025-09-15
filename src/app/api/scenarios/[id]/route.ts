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
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const scenario = await scenarioService.getScenario(params.id);
    
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
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const scenario = await scenarioService.updateScenario(params.id, body);

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
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    await scenarioService.deleteScenario(params.id);

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