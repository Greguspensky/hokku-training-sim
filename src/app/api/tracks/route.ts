import { NextRequest, NextResponse } from 'next/server';
import { scenarioService } from '@/lib/scenarios';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    // Temporarily allow demo mode for testing
    const demoUser = user || {
      id: 'demo-user',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'manager'
    };

    const body = await request.json();
    const { company_id, name, description, target_audience } = body;

    if (!company_id || !name || !description || !target_audience) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const track = await scenarioService.createTrack({
      company_id,
      name,
      description,
      target_audience
    });

    return NextResponse.json({
      success: true,
      track,
      message: 'Track created successfully'
    });

  } catch (error) {
    console.error('Create track error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create track' 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'company_id is required' },
        { status: 400 }
      );
    }

    const tracks = await scenarioService.getTracks(companyId);

    return NextResponse.json({
      success: true,
      tracks
    });

  } catch (error) {
    console.error('Get tracks error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch tracks' 
      },
      { status: 500 }
    );
  }
}