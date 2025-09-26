import { ElevenLabsConversationService, ConversationMessage } from './elevenlabs-conversation'
import { QuestionPoolManager, type QuestionAttempt, type TopicQuestion } from './question-pool-manager'
import { KnowledgeExtractionService, type KnowledgeTopic } from './knowledge-extraction'
import { trainingSessionsService } from './training-sessions'
import { supabaseAdmin } from './supabase'

export interface AdaptiveSessionConfig {
  companyId: string
  employeeId: string
  agentId: string
  language: string
  trainingMode: 'theory' | 'service'
  recordingPreference: 'none' | 'audio' | 'audio_video'
  maxQuestions: number
  masteryThreshold: number
}

export interface SessionProgress {
  currentQuestionIndex: number
  totalQuestions: number
  questionsAsked: TopicQuestion[]
  questionsAnswered: QuestionAttempt[]
  currentTopic: KnowledgeTopic | null
  sessionScore: number
  improvementAreas: string[]
}

export class AdaptiveTrainingSession {
  private config: AdaptiveSessionConfig
  private conversationService: ElevenLabsConversationService | null = null
  private sessionId: string | null = null
  private progress: SessionProgress
  private isSessionActive = false
  private eventHandlers: Record<string, Function[]> = {}

  constructor(config: AdaptiveSessionConfig) {
    this.config = config
    this.progress = {
      currentQuestionIndex: 0,
      totalQuestions: 0,
      questionsAsked: [],
      questionsAnswered: [],
      currentTopic: null,
      sessionScore: 0,
      improvementAreas: []
    }
  }

  /**
   * Initialize the adaptive training session
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing adaptive training session...')

      // Get priority-based questions: unanswered → incorrect → correct
      const { questions, topics, strategy } = await QuestionPoolManager.getPriorityBasedQuestions(
        this.config.employeeId,
        this.config.companyId,
        this.config.maxQuestions
      )

      this.progress.questionsAsked = questions
      this.progress.totalQuestions = questions.length
      this.progress.currentTopic = topics[0] || null

      console.log(`📝 Loaded ${questions.length} adaptive questions using ${strategy} strategy`)
      console.log(`🎯 Topics to cover:`, topics.map(t => t.name))

      // Build structured prompt for ElevenLabs agent
      const structuredPrompt = this.buildStructuredPrompt(questions, topics)

      // Initialize ElevenLabs conversation service
      this.conversationService = new ElevenLabsConversationService({
        agentId: this.config.agentId,
        language: this.config.language,
        connectionType: 'webrtc',
        dynamicVariables: {
          training_mode: this.config.trainingMode,
          structured_questions: structuredPrompt,
          session_type: 'adaptive_assessment',
          total_questions: questions.length,
          employee_level: await this.getEmployeeLevel(),
          focus_areas: this.identifyFocusAreas(topics)
        }
      })

      this.setupEventListeners()

      this.emit('initialized', {
        questionsCount: questions.length,
        topics: topics.map(t => ({ id: t.id, name: t.name, category: t.category })),
        strategy
      })

    } catch (error) {
      console.error('❌ Failed to initialize adaptive session:', error)
      this.emit('error', error)
      throw error
    }
  }

  /**
   * Build structured prompt with specific questions for ElevenLabs agent
   */
  private buildStructuredPrompt(questions: TopicQuestion[], topics: KnowledgeTopic[]): string {
    const questionList = questions.map((q, index) => {
      return `${index + 1}. ${q.question_template}
   - Type: ${q.question_type}
   - Topic: ${topics.find(t => t.id === q.topic_id)?.name || 'Unknown'}
   - Points: ${q.points}
   - Expected Answer: ${q.correct_answer}
   ${q.answer_options ? `- Options: ${q.answer_options.join(', ')}` : ''}
   - Explanation: ${q.explanation}`
    }).join('\n\n')

    return `
You are conducting a structured knowledge assessment. Ask these EXACT questions in order:

${questionList}

IMPORTANT INSTRUCTIONS:
1. Ask questions exactly as written above
2. For multiple choice questions, present all options clearly
3. After receiving an answer, provide brief feedback using the explanation
4. Move immediately to the next question
5. Track which questions have been asked
6. Be encouraging but focus on assessment
7. If student asks clarification, provide it briefly then return to assessment

Current focus areas: ${topics.map(t => t.name).join(', ')}
Assessment goal: Evaluate knowledge gaps and provide targeted feedback.
`
  }

  /**
   * Start the training session
   */
  async startSession(): Promise<void> {
    if (!this.conversationService) {
      throw new Error('Session not initialized. Call initialize() first.')
    }

    try {
      console.log('▶️ Starting adaptive training session...')

      // Create training session record
      const sessionData = await trainingSessionsService.createSession({
        employee_id: this.config.employeeId,
        training_mode: this.config.trainingMode,
        language: this.config.language,
        recording_preference: this.config.recordingPreference,
        session_name: 'Adaptive Assessment Session'
      })

      this.sessionId = sessionData.id

      // Update question pool with real session ID
      this.progress.questionsAsked = this.progress.questionsAsked.map(q => ({
        ...q,
        session_id: this.sessionId!
      }))

      // Start ElevenLabs conversation
      await this.conversationService.connect()

      this.isSessionActive = true

      this.emit('sessionStarted', {
        sessionId: this.sessionId,
        totalQuestions: this.progress.totalQuestions
      })

      console.log('✅ Adaptive training session started:', this.sessionId)

    } catch (error) {
      console.error('❌ Failed to start session:', error)
      this.emit('error', error)
      throw error
    }
  }

  /**
   * Record a question attempt and update progress
   */
  async recordQuestionAttempt(
    questionIndex: number,
    userAnswer: string,
    isCorrect: boolean,
    timeSpent?: number
  ): Promise<void> {
    if (!this.sessionId || questionIndex >= this.progress.questionsAsked.length) {
      console.warn('⚠️ Invalid question attempt record')
      return
    }

    const question = this.progress.questionsAsked[questionIndex]
    const attempt: QuestionAttempt = {
      training_session_id: this.sessionId,
      employee_id: this.config.employeeId,
      topic_id: question.topic_id,
      question_id: question.id!,
      question_asked: question.question_template,
      employee_answer: userAnswer,
      correct_answer: question.correct_answer,
      is_correct: isCorrect,
      points_earned: isCorrect ? question.points : 0,
      time_spent_seconds: timeSpent,
      attempt_number: 1
    }

    this.progress.questionsAnswered.push(attempt)
    this.progress.currentQuestionIndex = questionIndex + 1
    this.progress.sessionScore += attempt.points_earned

    // Save to database
    await QuestionPoolManager.recordQuestionAttempt(attempt)

    // Update current topic if we've moved to a new one
    const nextQuestion = this.progress.questionsAsked[questionIndex + 1]
    if (nextQuestion) {
      const nextTopic = await this.getTopicById(nextQuestion.topic_id)
      this.progress.currentTopic = nextTopic
    }

    this.emit('questionAnswered', {
      questionIndex,
      isCorrect,
      pointsEarned: attempt.points_earned,
      currentScore: this.progress.sessionScore,
      progress: (questionIndex + 1) / this.progress.totalQuestions
    })

    console.log(`📊 Question ${questionIndex + 1}/${this.progress.totalQuestions} answered:`, {
      correct: isCorrect,
      points: attempt.points_earned,
      totalScore: this.progress.sessionScore
    })
  }

  /**
   * End the training session and save results
   */
  async endSession(): Promise<{
    sessionId: string
    finalScore: number
    totalQuestions: number
    correctAnswers: number
    improvementAreas: string[]
    sessionSummary: any
  }> {
    if (!this.sessionId) {
      throw new Error('No active session to end')
    }

    try {
      console.log('🏁 Ending adaptive training session...')

      // Calculate final results
      const correctAnswers = this.progress.questionsAnswered.filter(a => a.is_correct).length
      const accuracy = this.progress.totalQuestions > 0
        ? correctAnswers / this.progress.totalQuestions
        : 0

      // Identify improvement areas based on incorrect answers
      const improvementTopics = new Set<string>()
      for (const attempt of this.progress.questionsAnswered) {
        if (!attempt.is_correct) {
          const topic = await this.getTopicById(attempt.topic_id)
          if (topic) {
            improvementTopics.add(topic.name)
          }
        }
      }

      this.progress.improvementAreas = Array.from(improvementTopics)

      // Update session record
      const sessionSummary = {
        conversation_transcript: await this.getConversationHistory(),
        final_score: this.progress.sessionScore,
        questions_answered: this.progress.totalQuestions,
        correct_answers: correctAnswers,
        accuracy_percentage: Math.round(accuracy * 100),
        topics_covered: this.getTopicsCovered(),
        improvement_areas: this.progress.improvementAreas,
        session_strategy: 'adaptive_assessment'
      }

      await trainingSessionsService.updateSession(this.sessionId, {
        conversation_transcript: sessionSummary.conversation_transcript,
        final_score: sessionSummary.final_score,
        session_metadata: sessionSummary,
        ended_at: new Date().toISOString()
      })

      // Disconnect conversation service
      if (this.conversationService) {
        await this.conversationService.disconnect()
      }

      this.isSessionActive = false

      const result = {
        sessionId: this.sessionId,
        finalScore: this.progress.sessionScore,
        totalQuestions: this.progress.totalQuestions,
        correctAnswers,
        improvementAreas: this.progress.improvementAreas,
        sessionSummary
      }

      this.emit('sessionEnded', result)

      console.log('✅ Adaptive training session completed:', result)

      return result

    } catch (error) {
      console.error('❌ Error ending session:', error)
      this.emit('error', error)
      throw error
    }
  }

  /**
   * Get current session progress
   */
  getProgress(): SessionProgress {
    return { ...this.progress }
  }

  /**
   * Event system
   */
  on(event: string, handler: Function): void {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = []
    }
    this.eventHandlers[event].push(handler)
  }

  private emit(event: string, data?: any): void {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => handler(data))
    }
  }

  /**
   * Private helper methods
   */
  private async getEmployeeLevel(): Promise<string> {
    try {
      const stats = await QuestionPoolManager.getEmployeeStats(this.config.employeeId)
      if (stats.averageMastery >= 0.8) return 'advanced'
      if (stats.averageMastery >= 0.6) return 'intermediate'
      return 'beginner'
    } catch {
      return 'beginner'
    }
  }

  private identifyFocusAreas(topics: KnowledgeTopic[]): string {
    const categories = new Set(topics.map(t => t.category))
    return Array.from(categories).join(', ')
  }

  private async getTopicById(topicId: string): Promise<KnowledgeTopic | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('knowledge_topics')
        .select('*')
        .eq('id', topicId)
        .single()

      return error ? null : data
    } catch {
      return null
    }
  }

  private getTopicsCovered(): string[] {
    const topics = new Set<string>()
    this.progress.questionsAnswered.forEach(attempt => {
      const question = this.progress.questionsAsked.find(q => q.id === attempt.question_id)
      if (question) {
        // We'll need to map topic ID to name - for now use topic ID
        topics.add(attempt.topic_id)
      }
    })
    return Array.from(topics)
  }

  private async getConversationHistory(): Promise<ConversationMessage[]> {
    if (!this.conversationService) return []

    try {
      return this.conversationService.getConversationHistory()
    } catch {
      return []
    }
  }

  private setupEventListeners(): void {
    if (!this.conversationService) return

    this.conversationService.on('connected', () => {
      this.emit('connected')
    })

    this.conversationService.on('disconnected', () => {
      this.emit('disconnected')
    })

    this.conversationService.on('agentMessage', (message: ConversationMessage) => {
      this.emit('agentMessage', message)
    })

    this.conversationService.on('userMessage', (message: ConversationMessage) => {
      this.emit('userMessage', message)

      // Auto-evaluate user response (simplified - in production you'd use more sophisticated evaluation)
      this.evaluateUserResponse(message.content)
    })

    this.conversationService.on('error', (error: any) => {
      this.emit('error', error)
    })
  }

  private async evaluateUserResponse(response: string): Promise<void> {
    if (this.progress.currentQuestionIndex >= this.progress.totalQuestions) {
      return
    }

    const currentQuestion = this.progress.questionsAsked[this.progress.currentQuestionIndex]
    if (!currentQuestion) return

    // Simple evaluation - in production, you'd want more sophisticated NLP
    const isCorrect = this.evaluateAnswer(response, currentQuestion)

    await this.recordQuestionAttempt(
      this.progress.currentQuestionIndex,
      response,
      isCorrect
    )

    // Check if session is complete
    if (this.progress.currentQuestionIndex >= this.progress.totalQuestions) {
      setTimeout(() => this.endSession(), 1000) // Give a moment for final agent response
    }
  }

  private evaluateAnswer(userResponse: string, question: TopicQuestion): boolean {
    // Simplified answer evaluation - in production you'd want more sophisticated matching
    const userLower = userResponse.toLowerCase().trim()
    const correctLower = question.correct_answer.toLowerCase().trim()

    // For multiple choice, check if response contains correct option
    if (question.question_type === 'multiple_choice' && question.answer_options) {
      const correctOption = question.answer_options.find(option =>
        option.toLowerCase() === correctLower
      )
      if (correctOption) {
        return userLower.includes(correctOption.toLowerCase())
      }
    }

    // For open-ended questions, check for key terms or similarity
    if (question.question_type === 'open_ended') {
      // Simple keyword matching - in production use semantic similarity
      const keywords = correctLower.split(/[\s,\.]+/)
      const matchingKeywords = keywords.filter(keyword =>
        keyword.length > 2 && userLower.includes(keyword)
      )
      return matchingKeywords.length / keywords.length >= 0.5 // 50% keyword match
    }

    // For true/false questions
    if (question.question_type === 'true_false') {
      const isTrue = correctLower.includes('true') || correctLower.includes('yes')
      const userSaysTrue = userLower.includes('true') || userLower.includes('yes')
      const userSaysFalse = userLower.includes('false') || userLower.includes('no')

      return (isTrue && userSaysTrue) || (!isTrue && userSaysFalse)
    }

    return false
  }
}