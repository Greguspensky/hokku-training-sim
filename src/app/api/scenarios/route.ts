import { NextRequest, NextResponse } from 'next/server';
import { scenarioService, type CreateScenarioData } from '@/lib/scenarios';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const scenarioData: CreateScenarioData = {
      company_id: body.company_id,
      title: body.title,
      description: body.description,
      industry: body.industry,
      difficulty: body.difficulty || 'beginner',
      estimated_duration_minutes: body.estimated_duration_minutes || 30,
      source_language: body.source_language || 'en',
      auto_translate: body.auto_translate !== false // Default to true
    };

    // Validate required fields
    if (!scenarioData.company_id || !scenarioData.title || !scenarioData.description) {
      return NextResponse.json(
        { error: 'company_id, title, and description are required' },
        { status: 400 }
      );
    }

    const scenario = await scenarioService.createScenario(scenarioData);

    return NextResponse.json({
      success: true,
      scenario,
      message: scenarioData.auto_translate 
        ? 'Scenario created and auto-translated to all languages'
        : 'Scenario created in source language only'
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
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');

    if (!companyId) {
      return NextResponse.json(
        { error: 'company_id parameter is required' },
        { status: 400 }
      );
    }

    const scenarios = await scenarioService.getScenarios(companyId);

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