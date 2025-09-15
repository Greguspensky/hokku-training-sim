import { NextRequest, NextResponse } from 'next/server';
import { scenarioService } from '@/lib/scenarios';
import { getCurrentUser } from '@/lib/auth';
import { type LanguageCode } from '@/lib/translation';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      sourceLanguage = 'en',
      targetLanguages,
      force = false 
    }: {
      sourceLanguage?: LanguageCode;
      targetLanguages?: LanguageCode[];
      force?: boolean;
    } = body;

    // Auto-translate the entire scenario
    const scenario = await scenarioService.autoTranslateScenario(params.id, sourceLanguage);
    const translationStatus = scenarioService.getTranslationStatus(scenario);

    return NextResponse.json({
      success: true,
      scenario,
      translationStatus,
      message: 'Scenario translated successfully to all languages'
    });

  } catch (error) {
    console.error('Auto-translate scenario error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to translate scenario' 
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
    const { 
      field,
      language,
      translation 
    }: {
      field: 'title' | 'description';
      language: LanguageCode;
      translation: string;
    } = body;

    if (!field || !language || !translation) {
      return NextResponse.json(
        { error: 'field, language, and translation are required' },
        { status: 400 }
      );
    }

    const scenario = await scenarioService.addTranslation(
      params.id,
      field,
      language,
      translation
    );

    const translationStatus = scenarioService.getTranslationStatus(scenario);

    return NextResponse.json({
      success: true,
      scenario,
      translationStatus,
      message: `${field} translation updated for ${language}`
    });

  } catch (error) {
    console.error('Update translation error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update translation' 
      },
      { status: 500 }
    );
  }
}