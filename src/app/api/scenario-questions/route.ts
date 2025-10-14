import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { QuestionPoolManager } from '@/lib/question-pool-manager'
import { scenarioService } from '@/lib/scenarios'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scenarioId = searchParams.get('scenario_id')
    const employeeId = searchParams.get('employee_id')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam) : null

    console.log(`🎯 Fetching questions for scenario: ${scenarioId}, employee: ${employeeId}, limit: ${limit || 'all'}`)

    if (!scenarioId) {
      return NextResponse.json({
        success: false,
        error: 'Scenario ID is required'
      }, { status: 400 })
    }

    // Get the scenario with its topic_ids
    const scenario = await scenarioService.getScenario(scenarioId)

    if (!scenario) {
      return NextResponse.json({
        success: false,
        error: 'Scenario not found'
      }, { status: 404 })
    }

    // For theory scenarios, load questions based on topic_ids
    if (scenario.scenario_type === 'theory' && scenario.topic_ids && scenario.topic_ids.length > 0) {
      console.log(`📖 Theory scenario found with ${scenario.topic_ids.length} topics:`, scenario.topic_ids)

      // Get questions for the specific topics
      let query = supabaseAdmin
        .from('topic_questions')
        .select(`
          id,
          topic_id,
          question_template,
          question_type,
          correct_answer,
          answer_options,
          difficulty_level,
          points,
          explanation,
          is_active,
          knowledge_topics!inner(
            id,
            name,
            category,
            difficulty_level,
            company_id
          )
        `)
        .in('topic_id', scenario.topic_ids)
        .eq('is_active', true)
        .order('difficulty_level', { ascending: true })

      // Only apply limit if specified
      if (limit) {
        query = query.limit(limit)
      }

      const { data: questionsData, error } = await query

      if (error) {
        console.error('❌ Error fetching scenario questions:', error)
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch questions'
        }, { status: 500 })
      }

      if (!questionsData || questionsData.length === 0) {
        return NextResponse.json({
          success: true,
          questions: [],
          scenario: {
            id: scenario.id,
            title: scenario.title,
            type: scenario.scenario_type,
            topics: scenario.topic_ids
          },
          message: 'No questions found for this scenario topics'
        })
      }

      // If employeeId is provided, get questions with priority logic
      if (employeeId) {
        // Get user's question attempts to determine status
        const { data: attempts } = await supabaseAdmin
          .from('question_attempts')
          .select('*')
          .eq('user_id', employeeId)

        console.log(`📚 Found ${questionsData.length} questions, ${attempts?.length || 0} attempts for employee`)

        // Create attempt lookup map
        const attemptMap = new Map()
        attempts?.forEach(attempt => {
          const key = attempt.question_id || `${attempt.topic_id}_${attempt.question_asked}`
          if (!attemptMap.has(key) || new Date(attempt.created_at) > new Date(attemptMap.get(key).created_at)) {
            attemptMap.set(key, attempt)
          }
        })

        // Process each question to determine status
        const questionsWithStatus = questionsData.map(question => {
          const topic = Array.isArray(question.knowledge_topics)
            ? question.knowledge_topics[0]
            : question.knowledge_topics

          // Try to find attempt by question_id first, then by topic + question text
          let attempt = attemptMap.get(question.id)
          if (!attempt) {
            attempt = Array.from(attemptMap.values()).find(a =>
              a.topic_id === topic.id &&
              (a.question_asked?.toLowerCase().includes(question.question_template.toLowerCase().substring(0, 20)) ||
               question.question_template.toLowerCase().includes(a.question_asked?.toLowerCase().substring(0, 20)))
            )
          }

          const status = attempt
            ? (attempt.is_correct ? 'correct' : 'incorrect')
            : 'unanswered'

          return {
            id: question.id,
            question: question.question_template,
            questionType: question.question_type,
            correctAnswer: question.correct_answer,
            answerOptions: question.answer_options,
            difficultyLevel: question.difficulty_level,
            points: question.points,
            explanation: question.explanation,
            status,
            topic: {
              id: topic.id,
              name: topic.name,
              category: topic.category
            }
          }
        })

        // Apply priority-based sorting: unanswered → incorrect → correct
        const prioritySorting = (a: any, b: any) => {
          const priorityOrder = { 'unanswered': 0, 'incorrect': 1, 'correct': 2 }

          // First priority: status (unanswered first, then incorrect, then correct)
          if (priorityOrder[a.status] !== priorityOrder[b.status]) {
            return priorityOrder[a.status] - priorityOrder[b.status]
          }

          // Second priority: difficulty (easier first)
          if (a.difficultyLevel !== b.difficultyLevel) {
            return a.difficultyLevel - b.difficultyLevel
          }

          // Third priority: alphabetical by topic name
          return a.topic.name.localeCompare(b.topic.name)
        }

        const sortedQuestions = questionsWithStatus.sort(prioritySorting)

        // Log selection summary
        const statusCounts = sortedQuestions.reduce((acc, q) => {
          acc[q.status] = (acc[q.status] || 0) + 1
          return acc
        }, {} as Record<string, number>)

        console.log(`🎯 Priority-based selection for scenario:`)
        console.log(`  📝 Found ${sortedQuestions.length} questions`)
        console.log(`  📊 Status breakdown:`, statusCounts)

        return NextResponse.json({
          success: true,
          questions: sortedQuestions,
          scenario: {
            id: scenario.id,
            title: scenario.title,
            type: scenario.scenario_type,
            topics: scenario.topic_ids
          },
          statusBreakdown: statusCounts,
          strategy: 'priority_based_scenario'
        })
      } else {
        // No employee ID - just return questions without status
        const formattedQuestions = questionsData.map(question => {
          const topic = Array.isArray(question.knowledge_topics)
            ? question.knowledge_topics[0]
            : question.knowledge_topics

          return {
            id: question.id,
            question: question.question_template,
            questionType: question.question_type,
            correctAnswer: question.correct_answer,
            answerOptions: question.answer_options,
            difficultyLevel: question.difficulty_level,
            points: question.points,
            explanation: question.explanation,
            status: 'unanswered' as const,
            topic: {
              id: topic.id,
              name: topic.name,
              category: topic.category
            }
          }
        })

        return NextResponse.json({
          success: true,
          questions: formattedQuestions,
          scenario: {
            id: scenario.id,
            title: scenario.title,
            type: scenario.scenario_type,
            topics: scenario.topic_ids
          },
          strategy: 'scenario_topics'
        })
      }
    } else {
      // Non-theory scenario or no topic_ids
      return NextResponse.json({
        success: true,
        questions: [],
        scenario: {
          id: scenario.id,
          title: scenario.title,
          type: scenario.scenario_type,
          topics: scenario.topic_ids || []
        },
        message: scenario.scenario_type === 'theory'
          ? 'Theory scenario has no topics assigned'
          : 'Service practice scenarios do not have predefined questions'
      })
    }

  } catch (error) {
    console.error('❌ Error in scenario-questions API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error fetching scenario questions' },
      { status: 500 }
    )
  }
}