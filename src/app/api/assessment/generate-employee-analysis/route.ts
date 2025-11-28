import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { employee_id, employee_name, language = 'en', force_reanalysis = false, cache_only = false } = body

    if (!employee_id) {
      return NextResponse.json(
        { success: false, error: 'Employee ID is required' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    console.log('🤖 Generating AI analysis for employee:', employee_id, `(language: ${language}, force: ${force_reanalysis})`)

    // Try to get employee record for caching (optional - don't fail if not found)
    const { data: employeeRecord, error: employeeError } = await supabaseAdmin
      .from('employees')
      .select('id, user_id, service_practice_analysis_cache')
      .eq('user_id', employee_id)
      .maybeSingle()

    console.log('📋 Employee record lookup:', {
      found: !!employeeRecord,
      employee_id: employeeRecord?.id,
      user_id: employeeRecord?.user_id,
      has_cache: !!employeeRecord?.service_practice_analysis_cache,
      error: employeeError
    })

    // If we have a cached analysis, return it (unless force reanalysis)
    if (!force_reanalysis && employeeRecord?.service_practice_analysis_cache) {
      const cache = employeeRecord.service_practice_analysis_cache as any

      console.log('💾 Cache found:', {
        language: cache.language,
        requested_language: language,
        sessions_analyzed: cache.sessions_analyzed,
        generated_at: cache.generated_at
      })

      // Return cache if it matches requested language
      if (cache.language === language) {
        console.log(`✅ Returning cached analysis (${cache.sessions_analyzed} sessions, generated at ${cache.generated_at})`)
        return NextResponse.json({
          success: true,
          analysis: cache.analysis,
          metadata: {
            sessions_analyzed: cache.sessions_analyzed,
            generated_at: cache.generated_at,
            model: cache.model,
            language: cache.language
          },
          from_cache: true
        })
      } else {
        console.log(`🔄 Cache language mismatch (cached: ${cache.language}, requested: ${language})`)
      }
    } else if (force_reanalysis) {
      console.log('🔄 Force reanalysis requested, skipping cache')
    } else {
      console.log('📭 No cache found')
    }

    // If cache_only mode, check if we should skip generation
    if (cache_only) {
      const cache = employeeRecord?.service_practice_analysis_cache as any
      const hasCacheForLanguage = cache && cache.language === language

      if (!hasCacheForLanguage) {
        console.log('🚫 Cache-only mode: No cache available for this language, skipping generation')
        return NextResponse.json({
          success: false,
          error: 'No cached analysis available for this language',
          cache_only_mode: true
        })
      }
      // If we have cache for this language, it was already returned above, so we shouldn't reach here
    }

    // Fetch all completed Service Practice sessions with full assessments
    // Use employee_id directly (this is the users.id from auth)
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('training_sessions')
      .select('id, service_practice_assessment_results, service_assessment_completed_at, started_at, scenario_id')
      .eq('employee_id', employee_id)
      .eq('training_mode', 'service_practice')
      .eq('service_assessment_status', 'completed')
      .not('service_practice_assessment_results', 'is', null)
      .order('service_assessment_completed_at', { ascending: true })

    if (sessionsError) {
      console.error('❌ Error fetching sessions:', sessionsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch sessions' },
        { status: 500 }
      )
    }

    if (!sessions || sessions.length < 2) {
      return NextResponse.json({
        success: false,
        error: 'At least 2 completed sessions required for AI analysis'
      })
    }

    console.log(`📚 Found ${sessions.length} sessions to analyze`)

    // Fetch scenarios separately
    const scenarioIds = [...new Set(sessions.map(s => s.scenario_id).filter(Boolean))]
    const { data: scenarios, error: scenariosError } = await supabaseAdmin
      .from('scenarios')
      .select('id, title, customer_emotion_level')
      .in('id', scenarioIds)

    if (scenariosError) {
      console.error('❌ Error fetching scenarios:', scenariosError)
    }

    // Create scenario lookup map
    const scenarioMap = new Map(scenarios?.map(s => [s.id, s]) || [])

    // Prepare session summaries for GPT-4
    const sessionSummaries = sessions.map((session, index) => {
      const results = session.service_practice_assessment_results as any
      const scenario = scenarioMap.get(session.scenario_id)

      return `
### Session ${index + 1}: ${scenario?.title || 'Unknown Scenario'}
**Customer Emotion:** ${scenario?.customer_emotion_level || 'normal'}
**Date:** ${new Date(session.service_assessment_completed_at || session.started_at).toLocaleDateString()}
**Overall Score:** ${results.overall_score}/100

**Metrics:**
- Empathy: ${results.metrics?.empathy}/100
- Professionalism: ${results.metrics?.professionalism}/100
- Problem Resolution: ${results.metrics?.problem_resolution}/100
- Clarity: ${results.metrics?.clarity}/100
- Product Knowledge: ${results.metrics?.product_knowledge_accuracy}/100
${results.metrics?.deescalation !== undefined ? `- De-escalation: ${results.metrics.deescalation}/100` : ''}

**Strengths:**
${results.strengths?.map((s: any) => `- ${s.point || s}`).join('\n') || 'None recorded'}

**Areas for Improvement:**
${results.improvements?.map((i: any) => `- ${i.point || i}`).join('\n') || 'None recorded'}
      `.trim()
    })

    // Language name mapping
    const languageNames: { [key: string]: string } = {
      'en': 'English', 'ru': 'Russian', 'it': 'Italian', 'es': 'Spanish',
      'fr': 'French', 'de': 'German', 'pt': 'Portuguese', 'nl': 'Dutch',
      'pl': 'Polish', 'ka': 'Georgian', 'ja': 'Japanese', 'ko': 'Korean', 'zh': 'Chinese'
    }
    const languageName = languageNames[language] || 'English'

    // Create GPT-4 prompt
    const prompt = `You are an expert customer service coach analyzing an employee's performance across multiple Service Practice role-play sessions.

**Employee:** ${employee_name || 'Employee'}
**Total Sessions Analyzed:** ${sessions.length}

${sessionSummaries.join('\n\n---\n\n')}

Based on the above session data, provide a comprehensive coaching analysis ENTIRELY in ${languageName} (including all section titles) following this EXACT structure:

## [Translate "Overall Performance Summary" to ${languageName}]
(2-3 sentences about overall performance and trajectory)

## [Translate "Key Strengths (Top 3-5)" to ${languageName}]
(List consistent strengths with specific examples - use numbered list with bold key phrases)

## [Translate "Priority Development Areas (Top 3-5)" to ${languageName}]
(List critical improvement areas with actionable advice - use numbered list with bold key phrases)

## [Translate "Performance Trends" to ${languageName}]
(Describe patterns: improving/declining/stable scores, metric improvements, performance vs emotion levels)

## [Translate "Coaching Recommendations" to ${languageName}]
(3-5 specific, actionable recommendations for training focus, practice scenarios, skills to develop - use numbered list)

CRITICAL FORMATTING RULES:
1. EVERYTHING must be in ${languageName} - section titles AND content
2. Start EVERY section title with ## followed by a space, then the translated section title
3. Use **bold** for key phrases within bullet points
4. Use numbered lists (1. 2. 3.) for strengths, development areas, and recommendations
5. Add blank line between sections for proper spacing
6. Do NOT include "Next Steps" section
7. Do NOT use English for any section titles

Example format (with translated titles):
## [Section Title in ${languageName}]

Content here with **bold emphasis** where appropriate.

## [Next Section Title in ${languageName}]

1. First point with **key phrase** in bold
2. Second point with **another key phrase** in bold`

    console.log('🤖 Calling GPT-4 for analysis...')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert customer service coach. You MUST follow markdown formatting rules exactly.

MANDATORY FORMAT RULES:
1. Write the ENTIRE response (titles + content) in the requested language
2. Every section title MUST start with ## (two hash symbols followed by a space)
3. Translate ALL section titles to the target language - DO NOT use English titles
4. Use **bold** for emphasis within content, but NOT for section titles
5. Use numbered lists (1. 2. 3.) for structured points
6. Add blank lines between sections for spacing

CORRECT format example for Russian:
## Общая сводка производительности
Текст здесь с **жирным выделением** ключевых фраз.

## Ключевые сильные стороны (Топ 3-5)
1. Первый пункт с **ключевой фразой**
2. Второй пункт

WRONG format examples (DO NOT DO THIS):
Overall Performance Summary (English title - should be translated)
**Заголовок раздела** (using bold for title instead of ##)
Заголовок раздела (missing ## before title)

The ## markdown syntax works in ALL languages. Translate the titles, but keep the ## markdown.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    })

    let analysis = completion.choices[0]?.message?.content

    if (!analysis) {
      return NextResponse.json({
        success: false,
        error: 'Failed to generate analysis'
      })
    }

    console.log(`✅ AI analysis generated (${analysis.length} characters)`)

    // Post-process to ensure proper markdown formatting
    // Define section title patterns for each language
    const sectionTitles: { [key: string]: string[] } = {
      'en': ['Overall Performance Summary', 'Key Strengths', 'Priority Development Areas', 'Performance Trends', 'Coaching Recommendations'],
      'ru': ['Общая сводка производительности', 'Ключевые сильные стороны', 'Приоритетные области для развития', 'Тенденции производительности', 'Рекомендации по обучению'],
      'it': ['Riepilogo delle Prestazioni', 'Punti di Forza Chiave', 'Aree Prioritarie di Sviluppo', 'Tendenze delle Prestazioni', 'Raccomandazioni di Coaching'],
      'es': ['Resumen de Rendimiento General', 'Fortalezas Clave', 'Áreas Prioritarias de Desarrollo', 'Tendencias de Rendimiento', 'Recomendaciones de Coaching'],
      'fr': ['Résumé des Performances', 'Points Forts Clés', 'Domaines de Développement Prioritaires', 'Tendances des Performances', 'Recommandations de Coaching'],
      'de': ['Gesamtleistungszusammenfassung', 'Hauptstärken', 'Prioritäre Entwicklungsbereiche', 'Leistungstrends', 'Coaching-Empfehlungen'],
      'pt': ['Resumo de Desempenho Geral', 'Principais Pontos Fortes', 'Áreas Prioritárias de Desenvolvimento', 'Tendências de Desempenho', 'Recomendações de Coaching'],
      'nl': ['Algemene Prestatiesamenvatting', 'Belangrijkste Sterke Punten', 'Prioritaire Ontwikkelingsgebieden', 'Prestatietrends', 'Coaching Aanbevelingen'],
      'pl': ['Ogólne Podsumowanie Wydajności', 'Kluczowe Mocne Strony', 'Priorytetowe Obszary Rozwoju', 'Trendy Wydajności', 'Zalecenia Coachingowe'],
      'ka': ['საერთო შედეგების შეჯამება', 'ძირითადი ძლიერი მხარეები', 'პრიორიტეტული განვითარების სფეროები', 'შესრულების ტენდენციები', 'კოუჩინგის რეკომენდაციები'],
      'ja': ['全体的なパフォーマンスの概要', '主な強み', '優先的な開発分野', 'パフォーマンスの傾向', 'コーチングの推奨事項'],
      'ko': ['전반적인 성과 요약', '주요 강점', '우선 개발 영역', '성과 동향', '코칭 권장사항'],
      'zh': ['整体绩效总结', '主要优势', '优先发展领域', '绩效趋势', '辅导建议']
    }

    const titlesForLanguage = sectionTitles[language] || sectionTitles['en']

    // Split into lines and process
    const lines = analysis.split('\n')
    const processedLines: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      // Check if this line is a section title (with or without ##)
      const matchedTitle = titlesForLanguage.find(title =>
        line.includes(title) && !line.startsWith('##')
      )

      if (matchedTitle) {
        // Add blank line before section (except first section)
        if (processedLines.length > 0 && processedLines[processedLines.length - 1] !== '') {
          processedLines.push('')
        }

        // Add ## if missing
        if (!line.startsWith('##')) {
          // Extract just the title part (might have (Top 3-5) suffix)
          const titleLine = line.replace(/^\*\*/, '').replace(/\*\*$/, '') // Remove bold if present
          processedLines.push(`## ${titleLine}`)
        } else {
          processedLines.push(line)
        }

        // Add blank line after section title
        processedLines.push('')
      } else if (line) {
        processedLines.push(lines[i]) // Keep original line with indentation
      } else {
        processedLines.push('') // Keep blank lines
      }
    }

    analysis = processedLines.join('\n').trim()
    console.log('✅ Applied markdown formatting post-processing')

    // Save analysis to cache (if employee record exists)
    const cacheData = {
      analysis,
      generated_at: new Date().toISOString(),
      sessions_analyzed: sessions.length,
      language,
      model: 'gpt-4o-mini'
    }

    if (employeeRecord?.id) {
      const { error: cacheError } = await supabaseAdmin
        .from('employees')
        .update({ service_practice_analysis_cache: cacheData })
        .eq('id', employeeRecord.id)

      if (cacheError) {
        console.error('❌ Failed to save analysis cache:', cacheError)
        // Don't fail the request - we have the analysis even if caching failed
      } else {
        console.log('✅ Analysis cached successfully')
      }
    } else {
      console.log('⚠️ No employee record found - skipping cache (analysis still generated)')
    }

    return NextResponse.json({
      success: true,
      analysis,
      metadata: {
        sessions_analyzed: sessions.length,
        generated_at: cacheData.generated_at,
        model: 'gpt-4o-mini',
        language
      },
      from_cache: false
    })

  } catch (error) {
    console.error('❌ Error generating employee analysis:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
