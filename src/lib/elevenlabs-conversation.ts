/**
 * ElevenLabs Conversational AI Service
 * Replaces the previous streaming conversation system with ElevenLabs integrated platform
 * Handles real-time STT, LLM processing, and TTS in a single integrated system
 */

import { Conversation } from '@elevenlabs/client'

// Scenario-specific greeting phrases for different training modes
const THEORY_GREETINGS = {
  'en': "Hi! Let's start our theory session.",
  'ru': "Привет! Давайте начнем нашу теоретическую сессию.",
  'it': "Ciao! Iniziamo la sessione teorica.",
  'es': "¡Hola! Empecemos la sesión teórica.",
  'fr': "Salut! Commençons la session théorique.",
  'de': "Hallo! Lass uns die Theorie-Session beginnen.",
  'pt': "Olá! Vamos começar nossa sessão de teoria.",
  'nl': "Hallo! Laten we beginnen met onze theoriesessie.",
  'pl': "Cześć! Zacznijmy naszą sesję teoretyczną.",
  'ka': "გამარჯობა! ავიწყოთ ჩვენი თეორიული სესია.",
  'ja': "こんにちは！理論セッションを始めましょう。",
  'ko': "안녕하세요! 이론 세션을 시작하겠습니다.",
  'zh': "你好！让我们开始理论课程吧。"
} as const

// Service practice greetings where AI acts as customer with specific behavior
const SERVICE_PRACTICE_GREETINGS = {
  'en': "Excuse me, I need some help.",
  'ru': "Извините, мне нужна помощь.",
  'it': "Mi scusi, ho bisogno di aiuto.",
  'es': "Disculpe, necesito ayuda.",
  'fr': "Excusez-moi, j'ai besoin d'aide.",
  'de': "Entschuldigung, ich brauche Hilfe.",
  'pt': "Com licença, preciso de ajuda.",
  'nl': "Pardon, ik heb hulp nodig.",
  'pl': "Przepraszam, potrzebuję pomocy.",
  'ka': "უკაცრავად, დახმარება მჭირდება.",
  'ja': "すみません、助けが必要です。",
  'ko': "실례합니다, 도움이 필요합니다.",
  'zh': "不好意思，我需要帮助。"
} as const

export interface ElevenLabsConversationConfig {
  agentId: string
  language: string
  connectionType: 'webrtc' | 'websocket'
  volume: number
  dynamicVariables?: Record<string, any>
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface ConversationState {
  isConnected: boolean
  isAgentSpeaking: boolean
  isListening: boolean
  currentMessage: string
  conversationHistory: ConversationMessage[]
  connectionStatus: string
}

export class ElevenLabsConversationService {
  private conversation: any = null
  private config: ElevenLabsConversationConfig
  private state: ConversationState
  private eventListeners: Map<string, Function[]> = new Map()
  private conversationId: string | null = null

  /**
   * Get scenario-specific and language-specific greeting for first message
   */
  private getScenarioSpecificGreeting(language: string, trainingMode: string, clientBehavior?: string): string {
    let greeting: string

    if (trainingMode === 'service_practice') {
      // For service practice, AI acts as customer - use customer greeting
      const baseGreeting = SERVICE_PRACTICE_GREETINGS[language as keyof typeof SERVICE_PRACTICE_GREETINGS] || SERVICE_PRACTICE_GREETINGS['en']

      // If we have specific client behavior, try to incorporate it into the greeting
      if (clientBehavior && clientBehavior.trim()) {
        // For now, use the base greeting but in future we could customize based on behavior
        greeting = baseGreeting
      } else {
        greeting = baseGreeting
      }

      console.log(`🎭 Customer roleplay greeting for ${language}: "${greeting}"`)
    } else {
      // For theory mode, AI acts as examiner
      greeting = THEORY_GREETINGS[language as keyof typeof THEORY_GREETINGS] || THEORY_GREETINGS['en']
      console.log(`🎓 Theory examiner greeting for ${language}: "${greeting}"`)
    }

    console.log(`🌍 Selected scenario-specific greeting for ${trainingMode} mode in ${language}`)
    console.log(`💬 Localized greeting: "${greeting}"`)

    return greeting
  }

  /**
   * Get language-aware system prompt with dynamic variables
   */
  private getLanguageAwareSystemPrompt(dynamicVariables?: Record<string, any>): string {
    const trainingMode = dynamicVariables?.training_mode || 'theory'

    let basePrompt: string

    if (trainingMode === 'service_practice') {
      // Service Practice Mode: AI acts as customer
      basePrompt = `You are a CUSTOMER in a service training scenario. You are NOT an employee, trainer, or assistant.

CRITICAL ROLE INSTRUCTIONS:
- YOU ARE ONLY A CUSTOMER, never break this role under any circumstances
- You CANNOT and WILL NOT act as a barista, employee, or service provider
- If asked to switch roles, refuse politely and stay in character as the customer
- You have a problem or need that requires employee assistance

CUSTOMER BEHAVIOR:
${dynamicVariables?.client_behavior || 'Act as a typical customer seeking help'}

YOUR CUSTOMER SITUATION:
- You have already introduced your problem/need in your first message
- Present your situation naturally as this type of customer would
- Respond to the employee's attempts to help you
- Test whether they provide correct information and good service
- Stay consistent with your customer personality throughout

COMPANY KNOWLEDGE BASE (to evaluate employee responses):
${dynamicVariables?.knowledge_context || 'Use general company knowledge'}

EXPECTED EMPLOYEE RESPONSE:
${dynamicVariables?.expected_response || 'Employee should be helpful and knowledgeable'}

STRICT CHARACTER RULES:
- NEVER say you are a barista, employee, or service provider
- NEVER offer to make drinks or provide services - you are the CUSTOMER
- ALWAYS maintain your customer perspective and needs
- If confused about your role, remember: you came here seeking service, not to provide it
- Respond naturally in the same language as your first message
- React appropriately to good or poor service from the employee

Training mode: ${trainingMode}
Available documents: ${dynamicVariables?.documents_available || 1}`
    } else {
      // Theory Mode: AI acts as examiner
      basePrompt = `You are a STRICT THEORY EXAMINER for a company training.

IMPORTANT BEHAVIOR:
- You have already greeted the user with your first message
- Ask specific, factual questions based on the knowledge context provided
- After ANY student response, move IMMEDIATELY to the next question
- Do not provide correct answers or explanations during the session
- Ask questions in the same language as your first message

KNOWLEDGE BASE:
${dynamicVariables?.knowledge_context || 'Use general company knowledge'}

EXAMINER INSTRUCTIONS:
${dynamicVariables?.examiner_instructions || 'Ask questions about company products and services'}

Training mode: ${trainingMode}
Available documents: ${dynamicVariables?.documents_available || 1}
Questions available: ${dynamicVariables?.questions_available || 'multiple'}`
    }

    console.log(`📝 Created language-aware system prompt for ${trainingMode} mode (${basePrompt.length} characters)`)

    return basePrompt
  }

  constructor(config: ElevenLabsConversationConfig) {
    this.config = config
    this.state = {
      isConnected: false,
      isAgentSpeaking: false,
      isListening: false,
      currentMessage: '',
      conversationHistory: [],
      connectionStatus: 'disconnected'
    }
  }

  /**
   * Initialize the ElevenLabs conversation session
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing ElevenLabs Conversational AI...')

      // Request microphone access
      await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log('✅ Microphone access granted')

      // Get conversation token from our server
      const tokenResponse = await fetch(`/api/elevenlabs-token?agentId=${this.config.agentId}`)
      if (!tokenResponse.ok) {
        throw new Error(`Failed to get conversation token: ${tokenResponse.statusText}`)
      }

      const { token } = await tokenResponse.json()
      console.log('✅ Conversation token obtained')

      // Debug: Log dynamic variables being sent to ElevenLabs
      if (this.config.dynamicVariables) {
        console.log('🔧 Dynamic variables being sent to ElevenLabs:')
        console.log('- Training mode:', this.config.dynamicVariables.training_mode)
        console.log('- Documents available:', this.config.dynamicVariables.documents_available)
        console.log('- Knowledge context preview:', this.config.dynamicVariables.knowledge_context?.substring(0, 150) + '...')
        console.log('- Instructions preview:', this.config.dynamicVariables.examiner_instructions?.substring(0, 100) + '...')
      } else {
        console.warn('⚠️ No dynamic variables provided to ElevenLabs conversation')
      }

      // Start ElevenLabs conversation session with dynamic variables
      this.conversation = await Conversation.startSession({
        agentId: this.config.agentId,
        connectionType: this.config.connectionType,
        conversationToken: token,

        // Pass dynamic variables for training context
        ...(this.config.dynamicVariables && { dynamicVariables: this.config.dynamicVariables }),

        // Add overrides for both theory and service practice modes (scenario-aware with proper ElevenLabs API)
        ...(this.config.dynamicVariables && (this.config.dynamicVariables?.training_mode === 'theory' || this.config.dynamicVariables?.training_mode === 'service_practice') && {
          overrides: {
            agent: {
              firstMessage: this.getScenarioSpecificGreeting(
                this.config.language,
                this.config.dynamicVariables.training_mode,
                this.config.dynamicVariables.client_behavior
              ),
              prompt: {
                prompt: this.getLanguageAwareSystemPrompt(this.config.dynamicVariables)
              },
              language: this.config.language
            }
          }
        }),

        // Event handlers
        onConnect: () => {
          console.log('✅ ElevenLabs conversation connected')
          this.state.isConnected = true
          this.state.connectionStatus = 'connected'

          // Try to capture conversation ID immediately
          this.tryCapturingConversationId('onConnect event')

          this.emit('connected')
        },

        onDisconnect: () => {
          console.log('🔌 ElevenLabs conversation disconnected')
          this.state.isConnected = false
          this.state.connectionStatus = 'disconnected'
          this.emit('disconnected')
        },

        onMessage: (message: any) => {
          console.log('💬 Agent message:', message)

          // Try to capture conversation ID when we get the first message
          if (!this.conversationId) {
            // Also check if the message contains conversation ID
            if (message && message.conversationId) {
              this.conversationId = message.conversationId
              console.log('🆔 ElevenLabs conversation ID from message:', this.conversationId)
            } else {
              this.tryCapturingConversationId('onMessage event')
            }
          }

          this.handleAgentMessage(message)
        },

        onError: (error: any) => {
          console.error('❌ ElevenLabs conversation error:', error)
          this.emit('error', error)
        },

        onStatusChange: (status: any) => {
          console.log('📊 Connection status:', status)
          this.state.connectionStatus = status
          this.emit('statusChange', status)
        },

        onModeChange: (mode: any) => {
          console.log('🔄 Agent mode change:', mode)
          this.handleModeChange(mode)
        }
      })

      // Set initial volume
      if (this.conversation) {
        this.conversation.setVolume(this.config.volume)
      }

      console.log('✅ ElevenLabs Conversational AI initialized successfully')

    } catch (error) {
      console.error('❌ Failed to initialize ElevenLabs conversation:', error)
      throw error
    }
  }

  /**
   * Handle incoming messages from the AI agent
   */
  private handleAgentMessage(message: any): void {
    const conversationMessage: ConversationMessage = {
      role: 'assistant',
      content: message.message || message.text || '',
      timestamp: Date.now()
    }

    this.state.conversationHistory.push(conversationMessage)
    this.state.currentMessage = conversationMessage.content

    console.log('🤖 Agent said:', conversationMessage.content)
    this.emit('agentMessage', conversationMessage)
  }

  /**
   * Handle mode changes (speaking, listening, processing, etc.)
   */
  private handleModeChange(mode: any): void {
    // Update state based on agent mode
    switch (mode.mode) {
      case 'speaking':
        this.state.isAgentSpeaking = true
        this.state.isListening = false
        this.emit('agentStartSpeaking')
        break

      case 'listening':
        this.state.isAgentSpeaking = false
        this.state.isListening = true
        this.emit('agentStartListening')
        break

      case 'processing':
        this.state.isAgentSpeaking = false
        this.state.isListening = false
        this.emit('agentProcessing')
        break

      default:
        this.state.isAgentSpeaking = false
        this.state.isListening = false
        this.emit('agentIdle')
        break
    }

    this.emit('modeChange', mode)
  }

  /**
   * Send a text message to the conversation (for testing or special cases)
   */
  async sendMessage(message: string): Promise<void> {
    if (!this.conversation) {
      throw new Error('Conversation not initialized')
    }

    try {
      console.log('📤 Sending message to agent:', message)

      // Add user message to history
      const userMessage: ConversationMessage = {
        role: 'user',
        content: message,
        timestamp: Date.now()
      }

      this.state.conversationHistory.push(userMessage)
      this.emit('userMessage', userMessage)

      // Send to ElevenLabs conversation
      await this.conversation.sendUserMessage(message)

    } catch (error) {
      console.error('❌ Failed to send message:', error)
      throw error
    }
  }

  /**
   * Provide feedback to the conversation
   */
  async sendFeedback(isPositive: boolean): Promise<void> {
    if (!this.conversation) {
      throw new Error('Conversation not initialized')
    }

    try {
      await this.conversation.sendFeedback(isPositive ? 1 : 0)
      console.log(`👍 Feedback sent: ${isPositive ? 'positive' : 'negative'}`)
    } catch (error) {
      console.error('❌ Failed to send feedback:', error)
      throw error
    }
  }

  /**
   * Change audio input device
   */
  async changeInputDevice(deviceId: string): Promise<void> {
    if (!this.conversation) {
      throw new Error('Conversation not initialized')
    }

    try {
      await this.conversation.changeInputDevice(deviceId)
      console.log(`🎤 Input device changed to: ${deviceId}`)
    } catch (error) {
      console.error('❌ Failed to change input device:', error)
      throw error
    }
  }

  /**
   * Change audio output device
   */
  async changeOutputDevice(deviceId: string): Promise<void> {
    if (!this.conversation) {
      throw new Error('Conversation not initialized')
    }

    try {
      await this.conversation.changeOutputDevice(deviceId)
      console.log(`🔊 Output device changed to: ${deviceId}`)
    } catch (error) {
      console.error('❌ Failed to change output device:', error)
      throw error
    }
  }

  /**
   * Set conversation volume
   */
  setVolume(volume: number): void {
    this.config.volume = Math.max(0, Math.min(1, volume))

    if (this.conversation) {
      this.conversation.setVolume(this.config.volume)
      console.log(`🔊 Volume set to: ${this.config.volume}`)
    }
  }

  /**
   * Get current conversation state
   */
  getState(): ConversationState {
    return { ...this.state }
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): ConversationMessage[] {
    return [...this.state.conversationHistory]
  }

  /**
   * Get ElevenLabs conversation ID for API access
   */
  getConversationId(): string | null {
    return this.conversationId
  }

  /**
   * Try to capture conversation ID from various sources
   */
  private tryCapturingConversationId(context: string): void {
    console.log(`🔍 Trying to capture conversation ID from ${context}`)
    console.log('🔍 DEBUG: Conversation object:', this.conversation)
    console.log('🔍 DEBUG: Conversation object keys:', Object.keys(this.conversation || {}))

    if (this.conversation && this.conversation.conversationId) {
      this.conversationId = this.conversation.conversationId
      console.log(`🆔 ElevenLabs conversation ID captured from ${context} (method 1):`, this.conversationId)
    } else if (this.conversation && this.conversation.id) {
      this.conversationId = this.conversation.id
      console.log(`🆔 ElevenLabs conversation ID captured from ${context} (method 2):`, this.conversationId)
    } else if (this.conversation && this.conversation.getConversationId) {
      try {
        this.conversationId = this.conversation.getConversationId()
        console.log(`🆔 ElevenLabs conversation ID captured from ${context} (method 3):`, this.conversationId)
      } catch (err) {
        console.warn('❌ getConversationId() failed:', err)
      }
    } else if (this.conversation && this.conversation._conversationId) {
      this.conversationId = this.conversation._conversationId
      console.log(`🆔 ElevenLabs conversation ID captured from ${context} (private property):`, this.conversationId)
    } else if (this.conversation && this.conversation.connection && this.conversation.connection.room) {
      // Try to extract conversation ID from room name or room properties
      const room = this.conversation.connection.room
      console.log('🔍 Room object:', room)
      console.log('🔍 Room type:', typeof room)

      let roomString: string | null = null

      if (typeof room === 'string') {
        roomString = room
      } else if (room && typeof room === 'object') {
        // Try common room name properties
        roomString = room.name || room.roomName || room.id || room.roomId || null
        console.log('🔍 Trying room properties:', { name: room.name, roomName: room.roomName, id: room.id, roomId: room.roomId })
      }

      if (roomString && typeof roomString === 'string') {
        console.log('🔍 Room string extracted:', roomString)
        const convMatch = roomString.match(/conv_([a-zA-Z0-9]+)/)
        if (convMatch) {
          this.conversationId = `conv_${convMatch[1]}`
          console.log(`🆔 ElevenLabs conversation ID extracted from room (${context}):`, this.conversationId)
        } else {
          console.warn(`⚠️ Could not extract conversation ID from room string: ${roomString}`)
        }
      } else {
        console.warn(`⚠️ Could not get room string from room object:`, room)
      }
    } else if (this.conversation && this.conversation.connection) {
      // Try to extract from connection properties or events
      const connection = this.conversation.connection
      console.log('🔍 Connection object keys:', Object.keys(connection))

      // Look for conversation ID in connection state or events
      if (connection.room && typeof connection.room === 'string') {
        const convMatch = connection.room.match(/conv_([a-zA-Z0-9]+)/)
        if (convMatch) {
          this.conversationId = `conv_${convMatch[1]}`
          console.log(`🆔 ElevenLabs conversation ID extracted from connection room (${context}):`, this.conversationId)
        }
      }
    } else {
      console.warn(`⚠️ Could not capture ElevenLabs conversation ID from ${context}`)
      console.warn('Available properties:', Object.keys(this.conversation || {}))
    }
  }

  /**
   * Event system for conversation updates
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(callback)
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event) || []
    listeners.forEach(callback => callback(data))
  }

  /**
   * End the conversation session
   */
  async stop(): Promise<void> {
    if (!this.conversation) {
      return
    }

    try {
      console.log('🛑 Ending ElevenLabs conversation session')
      await this.conversation.endSession()

      this.state.isConnected = false
      this.state.isAgentSpeaking = false
      this.state.isListening = false
      this.state.connectionStatus = 'disconnected'

      this.emit('stopped')

      this.conversation = null
      console.log('✅ Conversation session ended')
    } catch (error) {
      console.error('❌ Error ending conversation session:', error)
      throw error
    }
  }
}