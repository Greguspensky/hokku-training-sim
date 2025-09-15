import { NextRequest, NextResponse } from 'next/server'
import { scenarioService } from '@/lib/scenarios'
import { type LanguageCode } from '@/lib/translation'
import { getCurrentUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { 
      scenario_ids, 
      source_language = 'en' 
    }: { 
      scenario_ids: string[]
      source_language?: LanguageCode 
    } = body

    if (!scenario_ids || !Array.isArray(scenario_ids) || scenario_ids.length === 0) {
      return NextResponse.json(
        { error: 'scenario_ids array is required and cannot be empty' },
        { status: 400 }
      )
    }

    // Validate scenario IDs
    if (scenario_ids.some(id => !id || typeof id !== 'string')) {
      return NextResponse.json(
        { error: 'All scenario IDs must be valid strings' },
        { status: 400 }
      )
    }

    console.log(`🔄 Starting batch translation for ${scenario_ids.length} scenarios from ${source_language}`)

    // Use the batch translate method from scenarioService
    const results = await scenarioService.batchTranslateScenarios(
      scenario_ids,
      source_language
    )

    const response = {
      success: true,
      totalScenarios: scenario_ids.length,
      successfulTranslations: results.success.length,
      failedTranslations: results.failed.length,
      results: {
        success: results.success,
        failed: results.failed
      },
      message: `Batch translation completed: ${results.success.length}/${scenario_ids.length} scenarios translated successfully`
    }

    console.log(`✅ Batch translation completed: ${results.success.length} success, ${results.failed.length} failed`)

    return NextResponse.json(response)

  } catch (error) {
    console.error('Batch translation error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Batch translation failed',
        totalScenarios: 0,
        successfulTranslations: 0,
        failedTranslations: 0
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Batch Translation API',
    endpoint: 'POST /api/scenarios/batch-translate',
    description: 'Translate multiple scenarios to all supported languages',
    parameters: {
      scenario_ids: 'Array of scenario IDs to translate (required)',
      source_language: 'Source language code (default: en)'
    },
    supportedLanguages: {
      en: 'English',
      ru: 'Russian', 
      de: 'German',
      es: 'Spanish',
      ka: 'Georgian',
      fr: 'French',
      it: 'Italian'
    }
  })
}