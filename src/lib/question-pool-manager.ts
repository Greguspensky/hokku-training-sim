import { supabaseAdmin } from './supabase'
import type { KnowledgeTopic, TopicQuestion } from './knowledge-extraction'

export interface EmployeeProgress {
  id?: string
  user_id: string  // Changed from employee_id to match existing table
  topic_id: string
  mastery_level: number // 0.00 to 1.00
  total_attempts: number
  correct_attempts: number
  last_attempt_at?: string
  mastered_at?: string
  topic_name?: string
  topic_category?: string
  topic_difficulty?: number
}

export interface QuestionAttempt {
  id?: string
  training_session_id: string
  user_id: string  // Changed from employee_id to match existing table
  topic_id: string
  question_id: string
  question_asked: string
  employee_answer: string
  correct_answer: string
  is_correct: boolean
  points_earned: number
  time_spent_seconds?: number
  attempt_number: number
}

export interface QuestionWithStatus extends TopicQuestion {
  status: 'unanswered' | 'incorrect' | 'correct'
  topic_name?: string
  topic_category?: string
}

export interface QuestionTemplate {
  template: string
  variables: string[]
  difficulty: 1 | 2 | 3
  category: string
}

export class QuestionPoolManager {
  /**
   * Pre-defined question templates for common knowledge categories
   */
  private static readonly QUESTION_TEMPLATES: Record<string, QuestionTemplate[]> = {
    menu: [
      {
        template: "What sizes are available for {item}?",
        variables: ["item"],
        difficulty: 1,
        category: "menu"
      },
      {
        template: "What is the price of {item} in {size}?",
        variables: ["item", "size"],
        difficulty: 1,
        category: "menu"
      },
      {
        template: "Which ingredients are used in {item}?",
        variables: ["item"],
        difficulty: 2,
        category: "menu"
      },
      {
        template: "What is the difference between {item1} and {item2}?",
        variables: ["item1", "item2"],
        difficulty: 2,
        category: "menu"
      },
      {
        template: "How should {item} be prepared or served?",
        variables: ["item"],
        difficulty: 2,
        category: "menu"
      }
    ],
    procedures: [
      {
        template: "What is the first step in the {procedure} process?",
        variables: ["procedure"],
        difficulty: 1,
        category: "procedures"
      },
      {
        template: "How long should you {action} when {situation}?",
        variables: ["action", "situation"],
        difficulty: 2,
        category: "procedures"
      },
      {
        template: "What should you do if {problem} occurs?",
        variables: ["problem"],
        difficulty: 2,
        category: "procedures"
      },
      {
        template: "Who should you contact for {situation}?",
        variables: ["situation"],
        difficulty: 1,
        category: "procedures"
      }
    ],
    policies: [
      {
        template: "What is the company policy regarding {topic}?",
        variables: ["topic"],
        difficulty: 1,
        category: "policies"
      },
      {
        template: "Is {action} allowed according to company policy?",
        variables: ["action"],
        difficulty: 1,
        category: "policies"
      },
      {
        template: "What are the consequences of {violation}?",
        variables: ["violation"],
        difficulty: 2,
        category: "policies"
      }
    ],
    general: [
      {
        template: "What do you know about {topic}?",
        variables: ["topic"],
        difficulty: 1,
        category: "general"
      },
      {
        template: "How would you explain {concept} to a new employee?",
        variables: ["concept"],
        difficulty: 2,
        category: "general"
      },
      {
        template: "Why is {topic} important for our business?",
        variables: ["topic"],
        difficulty: 3,
        category: "general"
      }
    ]
  }

  /**
   * Get employee's current progress for all topics
   */
  static async getEmployeeProgress(employeeId: string): Promise<EmployeeProgress[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('user_topic_progress')
        .select(`
          *,
          knowledge_topics!inner(
            name,
            category,
            difficulty_level
          )
        `)
        .eq('user_id', employeeId)

      if (error) {
        console.error('❌ Error fetching employee progress:', error)
        return []
      }

      // Transform the data to include topic info
      const progress = data?.map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        topic_id: item.topic_id,
        mastery_level: item.mastery_level || 0,
        total_attempts: item.total_attempts || 0,
        correct_attempts: item.correct_attempts || 0,
        last_attempt_at: item.last_attempt_at,
        mastered_at: item.mastered_at,
        topic_name: item.knowledge_topics?.name,
        topic_category: item.knowledge_topics?.category,
        topic_difficulty: item.knowledge_topics?.difficulty_level
      })) || []

      return progress
    } catch (error) {
      console.warn('⚠️ Progress table may not exist yet:', error)
      return []
    }
  }

  /**
   * Get topics that need more practice based on employee progress
   */
  static async getTopicsNeedingPractice(
    employeeId: string,
    companyId: string,
    masteryThreshold: number = 0.8
  ): Promise<KnowledgeTopic[]> {
    try {
      // Get employee progress
      const progress = await this.getEmployeeProgress(employeeId)
      const progressMap = new Map(progress.map(p => [p.topic_id, p]))

      // Get all topics for company
      const { data: allTopics, error } = await supabaseAdmin
        .from('knowledge_topics')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)

      if (error || !allTopics) {
        console.warn('⚠️ Topics table may not exist yet:', error)
        return []
      }

      // Filter topics that need practice
      return allTopics.filter(topic => {
        const topicProgress = progressMap.get(topic.id)
        return !topicProgress || topicProgress.mastery_level < masteryThreshold
      })

    } catch (error) {
      console.warn('⚠️ Database tables may not exist yet:', error)
      return []
    }
  }

  /**
   * Get questions for a specific topic, prioritizing by employee's weak areas
   */
  static async getQuestionsForTopic(
    topicId: string,
    employeeId: string,
    limit: number = 5
  ): Promise<TopicQuestion[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('topic_questions')
        .select('*')
        .eq('topic_id', topicId)
        .eq('is_active', true)
        .limit(limit)

      if (error) {
        console.warn('⚠️ Questions table may not exist yet:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.warn('⚠️ Database tables may not exist yet:', error)
      return []
    }
  }

  /**
   * Generate questions using templates (fallback when database doesn't have enough questions)
   */
  static generateQuestionFromTemplate(
    template: QuestionTemplate,
    topic: KnowledgeTopic,
    variables: Record<string, string>
  ): TopicQuestion {
    let questionText = template.template

    // Replace variables in template
    template.variables.forEach(variable => {
      const value = variables[variable] || `[${variable}]`
      questionText = questionText.replace(`{${variable}}`, value)
    })

    return {
      topic_id: topic.id!,
      question_template: questionText,
      question_type: 'open_ended' as const,
      correct_answer: `Answer should demonstrate understanding of ${topic.name}`,
      difficulty_level: template.difficulty,
      points: template.difficulty,
      explanation: `This question tests knowledge of ${topic.name} in the ${topic.category} category`,
      is_active: true
    }
  }

  /**
   * Get questions with priority-based selection: unanswered → incorrect → correct
   */
  static async getPriorityBasedQuestions(
    employeeId: string,
    companyId: string,
    maxQuestions: number = 5
  ): Promise<{
    questions: QuestionWithStatus[]
    topics: KnowledgeTopic[]
    strategy: string
  }> {
    console.log(`🎯 Getting priority-based questions for employee ${employeeId}`)

    try {
      // Get all questions with their status (using same logic as question-progress API)
      const { data: allQuestions, error: questionsError } = await supabaseAdmin
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
        .eq('is_active', true)
        .eq('knowledge_topics.company_id', companyId)

      if (questionsError || !allQuestions || allQuestions.length === 0) {
        console.warn('⚠️ No questions found, falling back to legacy method')
        return this.getAdaptiveQuestions(employeeId, companyId, 'temp-session', maxQuestions)
      }

      // Get user's question attempts to determine status
      const { data: attempts } = await supabaseAdmin
        .from('question_attempts')
        .select('*')
        .eq('user_id', employeeId)

      console.log(`📚 Found ${allQuestions.length} questions, ${attempts?.length || 0} attempts`)

      // Create attempt lookup map (same logic as question-progress API)
      const attemptMap = new Map()
      attempts?.forEach(attempt => {
        const key = attempt.question_id || `${attempt.topic_id}_${attempt.question_asked}`
        if (!attemptMap.has(key) || new Date(attempt.created_at) > new Date(attemptMap.get(key).created_at)) {
          attemptMap.set(key, attempt)
        }
      })

      // Process each question to determine status
      const questionsWithStatus = allQuestions.map(question => {
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
          ...question,
          status,
          topic_name: topic.name,
          topic_category: topic.category
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
        if (a.difficulty_level !== b.difficulty_level) {
          return a.difficulty_level - b.difficulty_level
        }

        // Third priority: alphabetical by topic name
        return a.topic_name.localeCompare(b.topic_name)
      }

      const sortedQuestions = questionsWithStatus.sort(prioritySorting)

      // Select questions up to maxQuestions limit
      const selectedQuestions = sortedQuestions.slice(0, maxQuestions)

      // Get unique topics from selected questions
      const topicsMap = new Map()
      selectedQuestions.forEach(q => {
        const topic = Array.isArray(q.knowledge_topics)
          ? q.knowledge_topics[0]
          : q.knowledge_topics
        topicsMap.set(topic.id, topic)
      })
      const selectedTopics = Array.from(topicsMap.values())

      // Log selection summary
      const statusCounts = selectedQuestions.reduce((acc, q) => {
        acc[q.status] = (acc[q.status] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      console.log(`🎯 Priority-based selection completed:`)
      console.log(`  📝 Selected ${selectedQuestions.length}/${questionsWithStatus.length} questions`)
      console.log(`  📊 Status breakdown:`, statusCounts)
      console.log(`  🏷️ Topics: ${selectedTopics.length}`)

      return {
        questions: selectedQuestions,
        topics: selectedTopics,
        strategy: 'priority_based'
      }

    } catch (error) {
      console.error('❌ Error getting priority-based questions:', error)
      // Fallback to existing method
      return this.getAdaptiveQuestions(employeeId, companyId, 'temp-session', maxQuestions)
    }
  }

  /**
   * Get appropriate questions for an employee based on their progress (legacy method)
   */
  static async getAdaptiveQuestions(
    employeeId: string,
    companyId: string,
    sessionId: string,
    maxQuestions: number = 5
  ): Promise<{
    questions: TopicQuestion[]
    topics: KnowledgeTopic[]
    strategy: string
  }> {
    console.log(`🎯 Getting adaptive questions for employee ${employeeId}`)

    try {
      // Get topics that need practice
      const topicsNeedingPractice = await this.getTopicsNeedingPractice(employeeId, companyId)

      if (topicsNeedingPractice.length === 0) {
        console.log('✅ Employee has mastered all topics or no topics available')
        return {
          questions: [],
          topics: [],
          strategy: 'all_mastered'
        }
      }

      // Sort topics by priority (least mastered first, then by difficulty)
      const progress = await this.getEmployeeProgress(employeeId)
      const progressMap = new Map(progress.map(p => [p.topic_id, p]))

      topicsNeedingPractice.sort((a, b) => {
        const progressA = progressMap.get(a.id!) || { mastery_level: 0, total_attempts: 0 }
        const progressB = progressMap.get(b.id!) || { mastery_level: 0, total_attempts: 0 }

        // Prioritize by mastery level (lowest first)
        if (progressA.mastery_level !== progressB.mastery_level) {
          return progressA.mastery_level - progressB.mastery_level
        }

        // Then by attempts (fewer attempts first - topics they haven't practiced much)
        if (progressA.total_attempts !== progressB.total_attempts) {
          return progressA.total_attempts - progressB.total_attempts
        }

        // Finally by difficulty (easier first)
        return a.difficulty_level - b.difficulty_level
      })

      // Select questions from top priority topics
      const selectedQuestions: TopicQuestion[] = []
      const selectedTopics: KnowledgeTopic[] = []
      let questionsPerTopic = Math.ceil(maxQuestions / Math.min(topicsNeedingPractice.length, 3))

      for (const topic of topicsNeedingPractice.slice(0, 3)) {
        if (selectedQuestions.length >= maxQuestions) break

        const topicQuestions = await this.getQuestionsForTopic(
          topic.id!,
          employeeId,
          questionsPerTopic
        )

        // If no questions in database, generate from templates
        if (topicQuestions.length === 0) {
          const templates = this.QUESTION_TEMPLATES[topic.category] || this.QUESTION_TEMPLATES.general
          const template = templates[Math.floor(Math.random() * templates.length)]

          const generatedQuestion = this.generateQuestionFromTemplate(template, topic, {
            item: topic.name,
            topic: topic.name,
            procedure: topic.name,
            concept: topic.name
          })

          topicQuestions.push(generatedQuestion)
        }

        selectedQuestions.push(...topicQuestions.slice(0, questionsPerTopic))
        selectedTopics.push(topic)
      }

      console.log(`📝 Selected ${selectedQuestions.length} questions from ${selectedTopics.length} topics`)

      return {
        questions: selectedQuestions.slice(0, maxQuestions),
        topics: selectedTopics,
        strategy: 'adaptive_priority'
      }

    } catch (error) {
      console.error('❌ Error getting adaptive questions:', error)

      // Fallback: use hard-coded questions
      return this.getFallbackQuestions(companyId)
    }
  }

  /**
   * Fallback questions when database is not available
   */
  private static getFallbackQuestions(companyId: string): {
    questions: TopicQuestion[]
    topics: KnowledgeTopic[]
    strategy: string
  } {
    const fallbackTopic: KnowledgeTopic = {
      id: 'fallback-topic',
      company_id: companyId,
      name: 'Coffee Shop Knowledge',
      description: 'Basic coffee shop operations and menu knowledge',
      category: 'general',
      difficulty_level: 1,
      is_active: true
    }

    const fallbackQuestions: TopicQuestion[] = [
      {
        id: 'fallback-q1',
        topic_id: 'fallback-topic',
        question_template: 'What sizes are available for cappuccino?',
        question_type: 'multiple_choice',
        correct_answer: '250ml, 350ml, 450ml',
        answer_options: ['250ml, 350ml, 450ml', 'Only 350ml', '200ml, 400ml, 600ml'],
        difficulty_level: 1,
        points: 2,
        explanation: 'Cappuccino comes in three sizes according to our menu',
        is_active: true
      },
      {
        id: 'fallback-q2',
        topic_id: 'fallback-topic',
        question_template: 'What is the price difference between a 250ml and 450ml cappuccino?',
        question_type: 'open_ended',
        correct_answer: 'The price difference varies based on current menu pricing',
        difficulty_level: 2,
        points: 3,
        explanation: 'Understanding price differences helps with customer service',
        is_active: true
      }
    ]

    return {
      questions: fallbackQuestions,
      topics: [fallbackTopic],
      strategy: 'fallback'
    }
  }

  /**
   * Record a question attempt and update progress
   */
  static async recordQuestionAttempt(attempt: QuestionAttempt): Promise<void> {
    try {
      // Save attempt record
      const { error: attemptError } = await supabaseAdmin
        .from('question_attempts')
        .insert(attempt)

      if (attemptError) {
        console.warn('⚠️ Could not save attempt record:', attemptError)
      }

      // Update employee progress
      await this.updateEmployeeProgress(
        attempt.user_id,
        attempt.topic_id,
        attempt.is_correct,
        attempt.points_earned
      )

    } catch (error) {
      console.warn('⚠️ Database tables may not exist yet:', error)
    }
  }

  /**
   * Update employee's progress for a topic
   */
  private static async updateEmployeeProgress(
    userId: string,
    topicId: string,
    isCorrect: boolean,
    pointsEarned: number
  ): Promise<void> {
    try {
      // Get current progress
      const { data: current } = await supabaseAdmin
        .from('user_topic_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('topic_id', topicId)
        .single()

      const now = new Date().toISOString()
      const newTotalAttempts = (current?.total_attempts || 0) + 1
      const newCorrectAttempts = (current?.correct_attempts || 0) + (isCorrect ? 1 : 0)
      const newMasteryLevel = Math.min(1.0, newCorrectAttempts / newTotalAttempts)

      const progressData = {
        user_id: userId,
        topic_id: topicId,
        mastery_level: newMasteryLevel,
        total_attempts: newTotalAttempts,
        correct_attempts: newCorrectAttempts,
        last_attempt_at: now,
        mastered_at: newMasteryLevel >= 0.8 && !current?.mastered_at ? now : current?.mastered_at,
        updated_at: now
      }

      if (current) {
        // Update existing progress
        const { error } = await supabaseAdmin
          .from('user_topic_progress')
          .update(progressData)
          .eq('user_id', userId)
          .eq('topic_id', topicId)

        if (error) {
          console.warn('⚠️ Could not update progress:', error)
        }
      } else {
        // Insert new progress record
        const { error } = await supabaseAdmin
          .from('user_topic_progress')
          .insert({ ...progressData, created_at: now })

        if (error) {
          console.warn('⚠️ Could not create progress record:', error)
        }
      }

    } catch (error) {
      console.warn('⚠️ Progress tracking not available:', error)
    }
  }

  /**
   * Get summary statistics for an employee
   */
  static async getEmployeeStats(employeeId: string): Promise<{
    totalTopics: number
    masteredTopics: number
    totalAttempts: number
    averageMastery: number
    recentActivity: Date | null
  }> {
    try {
      const progress = await this.getEmployeeProgress(employeeId)

      const totalTopics = progress.length
      const masteredTopics = progress.filter(p => p.mastery_level >= 0.8).length
      const totalAttempts = progress.reduce((sum, p) => sum + p.total_attempts, 0)
      const averageMastery = totalTopics > 0
        ? progress.reduce((sum, p) => sum + p.mastery_level, 0) / totalTopics
        : 0

      const recentActivity = progress
        .map(p => p.last_attempt_at ? new Date(p.last_attempt_at) : null)
        .filter(date => date !== null)
        .sort((a, b) => b!.getTime() - a!.getTime())[0] || null

      return {
        totalTopics,
        masteredTopics,
        totalAttempts,
        averageMastery,
        recentActivity
      }

    } catch (error) {
      console.warn('⚠️ Could not get employee stats:', error)
      return {
        totalTopics: 0,
        masteredTopics: 0,
        totalAttempts: 0,
        averageMastery: 0,
        recentActivity: null
      }
    }
  }
}