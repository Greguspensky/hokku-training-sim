/**
 * ElevenLabs Conversational AI Service
 * Replaces the previous streaming conversation system with ElevenLabs integrated platform
 * Handles real-time STT, LLM processing, and TTS in a single integrated system
 */

import { Conversation } from '@elevenlabs/client'
import { CustomerEmotionLevel, getEmotionDefinition } from './customer-emotions'
import { resolveVoiceId, getVoiceName, getVoiceGender, getGenderLanguageHint } from './elevenlabs-voices'

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

// Service practice greetings - simple neutral "Hello" for all scenarios
// Emotion emerges naturally during conversation based on scenario premise
const SERVICE_PRACTICE_GREETINGS = {
  'en': "Hello.",
  'ru': "Здравствуйте.",
  'it': "Salve.",
  'es': "Hola.",
  'fr': "Bonjour.",
  'de': "Hallo.",
  'pt': "Olá.",
  'nl': "Hallo.",
  'pl': "Cześć.",
  'ka': "გამარჯობა.",
  'ja': "こんにちは。",
  'ko': "안녕하세요.",
  'zh': "你好。"
} as const

export interface ElevenLabsConversationConfig {
  agentId: string
  language: string
  voiceId?: string  // ElevenLabs Voice ID or 'random'
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
   * Get language-specific greeting for first message
   * Returns simple "Hello" for service practice (emotion emerges naturally during conversation)
   * Returns session intro for theory mode
   */
  private getScenarioSpecificGreeting(language: string, trainingMode: string): string {
    let greeting: string

    if (trainingMode === 'service_practice') {
      // Simple neutral "Hello" greeting - emotion emerges naturally based on scenario
      greeting = SERVICE_PRACTICE_GREETINGS[language as keyof typeof SERVICE_PRACTICE_GREETINGS] || SERVICE_PRACTICE_GREETINGS['en']
      console.log(`🎭 Customer neutral greeting for ${language}: "${greeting}"`)
    } else {
      // For theory mode, AI acts as examiner
      greeting = THEORY_GREETINGS[language as keyof typeof THEORY_GREETINGS] || THEORY_GREETINGS['en']
      console.log(`🎓 Theory examiner greeting for ${language}: "${greeting}"`)
    }

    console.log(`🌍 Selected greeting for ${trainingMode} mode in ${language}`)
    console.log(`💬 Localized greeting: "${greeting}"`)

    return greeting
  }

  /**
   * Get establishment-specific customer role context for universal role guardrails
   * Supports multiple business types: coffee shops, restaurants, hotels, retail, salons, etc.
   */
  private getCustomerRoleContext(establishmentType: string, lang: string): string {
    const contexts: Record<string, { en: string, ru: string }> = {
      'coffee shop': {
        en: 'You want to buy coffee and food items, not serve them.',
        ru: 'Ты хочешь купить кофе и еду, а не продавать их.'
      },
      'restaurant': {
        en: 'You want to order and eat food, not take orders or serve dishes.',
        ru: 'Ты хочешь заказать и съесть еду, а не принимать заказы.'
      },
      'cafe': {
        en: 'You want to order food and drinks, not work here.',
        ru: 'Ты хочешь заказать еду и напитки, а не работать здесь.'
      },
      'retail store': {
        en: 'You want to buy products, not sell them to other customers.',
        ru: 'Ты хочешь купить товары, а не продавать их другим.'
      },
      'hotel': {
        en: 'You want to book a room and receive service, not check in guests.',
        ru: 'Ты хочешь забронировать номер, а не регистрировать гостей.'
      },
      'salon': {
        en: 'You want to book services for yourself, not provide services to others.',
        ru: 'Ты хочешь записаться на услуги, а не оказывать их другим.'
      }
    }

    // Default fallback for any custom establishment type
    const defaultContext = {
      en: `You want to receive service at this ${establishmentType}, not provide it.`,
      ru: `Ты хочешь получить услугу в этом заведении, а не оказывать её.`
    }

    const context = contexts[establishmentType.toLowerCase()] || defaultContext
    return lang === 'ru' ? context.ru : context.en
  }

  /**
   * Get language-aware system prompt with dynamic variables
   */
  private getLanguageAwareSystemPrompt(
    dynamicVariables?: Record<string, any>,
    voiceId?: string,
    language?: string
  ): string {
    const trainingMode = dynamicVariables?.training_mode || 'theory'

    let basePrompt: string

    if (trainingMode === 'service_practice') {
      // Service Practice Mode: AI acts as customer
      // Using ElevenLabs' six building blocks structure for better role consistency

      // Get voice identity for personalization
      const voiceName = getVoiceName(voiceId)
      const voiceGender = getVoiceGender(voiceId)
      const customerName = (voiceName !== 'Random Voice' && voiceName !== 'Unknown Voice')
        ? voiceName
        : 'a customer'
      const establishmentType = dynamicVariables?.establishment_type || 'coffee shop'

      // Check if we have emotion-specific instructions from dynamic variables
      const emotionLevel = dynamicVariables?.customer_emotion_level as CustomerEmotionLevel | undefined
      const emotionDefinition = emotionLevel ? getEmotionDefinition(emotionLevel) : null

      if (emotionDefinition) {
        // Optimized emotion-based prompt following ElevenLabs six building blocks
        // 51% reduction from 3,800 → 1,850 characters while preserving all critical logic

        // Helper function to get harassment response based on emotion intensity
        const getHarassmentResponse = (level: CustomerEmotionLevel, lang: string): string => {
          const responses: Record<CustomerEmotionLevel, { en: string, ru: string }> = {
            sunshine: {
              en: "I'm sorry, but that's really inappropriate.",
              ru: "Извините, но это действительно неуместно."
            },
            cold: {
              en: "Excuse me? That's completely out of line.",
              ru: "Извините? Это совершенно неуместно."
            },
            in_a_hurry: {
              en: "What?! That's RUDE. I want to speak to your manager.",
              ru: "Что?! Это ГРУБО. Я хочу поговорить с менеджером."
            },
            angry: {
              en: "EXCUSE ME?! That is COMPLETELY inappropriate! I want your MANAGER!",
              ru: "ИЗВИНИТЕ?! Это СОВЕРШЕННО неуместно! Позовите МЕНЕДЖЕРА!"
            },
            extremely_angry: {
              en: "What did you just SAY?! Get your MANAGER. NOW!",
              ru: "Что вы только что СКАЗАЛИ?! Позовите МЕНЕДЖЕРА. СЕЙЧАС!"
            }
          }
          return responses[level]?.[lang === 'ru' ? 'ru' : 'en'] || responses[level]?.en
        }

        basePrompt = `# CRITICAL ROLE: CUSTOMER ONLY

You are ONLY a customer at this ${establishmentType}. You NEVER work here.
You are here to RECEIVE service, not to PROVIDE service to others.
You NEVER serve customers, take orders, or ask others what they want.

${this.getCustomerRoleContext(establishmentType, dynamicVariables?.language || 'en')}

If you find yourself asking "What would you like?" in ANY form, STOP - you're breaking character.

## Role Lock - Forbidden Staff Phrases

In Russian, NEVER say:
- "Что будете заказывать?" / "Что вы хотели бы заказать?" / "Что желаете?" (asking what to order)
- "Могу помочь?" / "Чем могу помочь?" (offering help as staff)
- "Что вам принести?" / "Что вам показать?" (offering to bring/show something)
- "Я принесу вам..." / "Сейчас сделаю..." (offering to do something for customer)

In English, NEVER say:
- "What would you like?" / "What can I get you?" / "What'll it be?" (asking what to order)
- "How can I help you?" / "Can I help you?" (offering help as staff)
- "Let me get that for you" / "I'll bring that" (offering to serve)
- "I'll make that for you" / "Coming right up" (acting as employee)

Your role: CUSTOMER who receives service.
Employee's role: STAFF who provides service.

Never switch these roles.

---

# RESPONSE REQUIREMENT

Always respond with full words as a customer. Never use only punctuation or silence.

If you're confused by what the employee says:
- Russian: "Извините, не понял" / "Можете повторить?" / "Что вы имеете в виду?"
- English: "Sorry, I didn't understand" / "Can you repeat that?" / "What do you mean?"
- If you need time: "Дайте подумать..." / "Let me think..."

NEVER respond with only "..." or "…" - always provide actual words in character.

---

# Personality
You are ${customerName}, a customer at a ${establishmentType}.

Situation: ${dynamicVariables?.scenario_title || 'You are visiting this establishment seeking service'}

${emotionDefinition.personality}

# Environment
You're at the counter speaking with the employee who serves you. Voice conversation in ${dynamicVariables?.language || 'English'}.

## Menu Variety
When ordering, vary your choices across different items from the available menu. Don't default to the same item every time - explore seasonal drinks, try pastries, consider different coffee preparations. Real customers have preferences that change based on mood, time of day, and curiosity about new items.

# Tone
${emotionDefinition.tone}

Common phrases: ${emotionDefinition.linguisticMarkers.slice(0, 7).join(', ')}

Max 1-2 sentences per response unless engaged.

# Goal
${emotionDefinition.behavioralGoals}

${emotionDefinition.emotionalConsistencyRules}

De-escalation: ${emotionDefinition.deEscalationTriggers}

# Critical Boundaries

## If Employee Makes Goodbye Gesture Early
If employee says goodbye before you complete your order/service → Respond naturally: "Wait, I haven't ordered yet!" / "Подождите, я еще не заказал!"

## Harassment Response
If employee comments on your appearance/looks/body/attracts to you → Immediate response: "${getHarassmentResponse(emotionLevel, dynamicVariables?.language || 'en')}"
Demand to speak to manager. This is unacceptable.

## Reality Check
Question absurd claims. Use common sense about prices and services.

Examples:
- Wildly wrong prices: If menu says 550 but employee says 550,000 → "That's ridiculous. The menu says 550."
- Impossible claims: "This ${establishmentType === 'coffee shop' ? 'coffee' : establishmentType === 'restaurant' ? 'meal' : 'product'} will make you fly?" → "Come on, seriously?"
- Clear errors: Point them out naturally as a real customer would

Stay grounded in reality.

# Available Menu

${dynamicVariables?.knowledge_context || 'No menu information available.'}

IMPORTANT: When ordering, you MUST ONLY choose items from the menu above. DO NOT order items that are not listed.

${getGenderLanguageHint(voiceGender, language || dynamicVariables?.language || 'en') ? '\n---\n' + getGenderLanguageHint(voiceGender, language || dynamicVariables?.language || 'en') : ''}`
      } else {
        // Fallback generic customer (no emotion level specified)
        const establishmentType = dynamicVariables?.establishment_type || 'coffee shop'

        basePrompt = `# CRITICAL ROLE: CUSTOMER ONLY

You are ONLY a customer at this ${establishmentType}. You NEVER work here.
You are here to RECEIVE service, not to PROVIDE service to others.
You NEVER serve customers, take orders, or ask others what they want.

${this.getCustomerRoleContext(establishmentType, dynamicVariables?.language || 'en')}

If you find yourself asking "What would you like?" in ANY form, STOP - you're breaking character.

## Role Lock - Forbidden Staff Phrases

In Russian, NEVER say:
- "Что будете заказывать?" / "Что вы хотели бы заказать?" / "Что желаете?" (asking what to order)
- "Могу помочь?" / "Чем могу помочь?" (offering help as staff)
- "Что вам принести?" / "Что вам показать?" (offering to bring/show something)
- "Я принесу вам..." / "Сейчас сделаю..." (offering to do something for customer)

In English, NEVER say:
- "What would you like?" / "What can I get you?" / "What'll it be?" (asking what to order)
- "How can I help you?" / "Can I help you?" (offering help as staff)
- "Let me get that for you" / "I'll bring that" (offering to serve)
- "I'll make that for you" / "Coming right up" (acting as employee)

Your role: CUSTOMER who receives service.
Employee's role: STAFF who provides service.

Never switch these roles.

---

# RESPONSE REQUIREMENT

Always respond with full words as a customer. Never use only punctuation or silence.

If you're confused by what the employee says:
- Russian: "Извините, не понял" / "Можете повторить?" / "Что вы имеете в виду?"
- English: "Sorry, I didn't understand" / "Can you repeat that?" / "What do you mean?"
- If you need time: "Дайте подумать..." / "Let me think..."

NEVER respond with only "..." or "…" - always provide actual words in character.

---

# Personality
You are a customer at a ${establishmentType}. You came here for service.

${dynamicVariables?.client_behavior || 'Act as a typical customer seeking help.'}

# Environment
Voice roleplay training in ${dynamicVariables?.language || 'English'}. You are the CUSTOMER. The human is the EMPLOYEE.

## Menu Variety
When ordering, vary your choices across different items from the available menu. Don't default to the same item every time - explore seasonal drinks, try pastries, consider different coffee preparations. Real customers have preferences that change based on mood, time of day, and curiosity about new items.

# Tone
Conversational, natural. Ask questions, express needs, react to service quality.

# Goal
Stay in customer role. Never switch to providing service. Test employee's skills through realistic customer interactions.

# Critical Boundaries

## If Employee Makes Goodbye Gesture Early
If employee says goodbye before you complete your order/service → "Wait, I haven't ordered yet!" / "Подождите, я еще не заказал!"

## Harassment Response
If employee comments on appearance/looks/body → "That's completely inappropriate! I want your manager!" / "Это совершенно неуместно! Позовите менеджера!"

## Reality Check
Question absurd claims. Use common sense about prices and services.

Examples:
- Wildly wrong prices: If menu says 550 but employee says 550,000 → "That's ridiculous."
- Impossible claims: Point them out naturally as a real customer would
- Clear errors: Question them with common sense

# Available Menu

${dynamicVariables?.knowledge_context || 'No menu information available.'}

IMPORTANT: When ordering, you MUST ONLY choose items from the menu above. DO NOT order items that are not listed.`
      }
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

    // Debug: Log first 500 characters of system prompt for verification
    if (trainingMode === 'service_practice') {
      console.log('🎭 System prompt preview (first 500 chars):')
      console.log(basePrompt.substring(0, 500))
    }

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
        console.log('- Scenario title:', this.config.dynamicVariables.scenario_title || 'not provided')
        console.log('- Client behavior:', this.config.dynamicVariables.client_behavior?.substring(0, 50) + '...')
        console.log('- Documents available:', this.config.dynamicVariables.documents_available)
        console.log('- Knowledge context preview:', this.config.dynamicVariables.knowledge_context?.substring(0, 150) + '...')
        console.log('- Instructions preview:', this.config.dynamicVariables.examiner_instructions?.substring(0, 100) + '...')
      } else {
        console.warn('⚠️ No dynamic variables provided to ElevenLabs conversation')
      }

      // Debug: Log voice ID configuration
      console.log('🎤 Voice configuration:')
      console.log('- voiceId from config:', this.config.voiceId)
      console.log(`- Voice identity: ${getVoiceName(this.config.voiceId)} (${getVoiceGender(this.config.voiceId)})`)
      console.log('- Establishment type:', this.config.dynamicVariables?.establishment_type || 'coffee shop (default)')
      console.log('- Resolved voice ID:', this.config.voiceId ? resolveVoiceId(this.config.voiceId) : 'none')
      console.log('- Will override voice?', !!(this.config.voiceId))

      // Build overrides config (for scenarios that use overrides)
      const overridesConfig = (this.config.dynamicVariables &&
        (this.config.dynamicVariables?.training_mode === 'theory' ||
         this.config.dynamicVariables?.training_mode === 'service_practice')) ? {
        overrides: {
          agent: {
            firstMessage: this.getScenarioSpecificGreeting(
              this.config.language,
              this.config.dynamicVariables.training_mode
            ),
            prompt: {
              prompt: this.getLanguageAwareSystemPrompt(
                this.config.dynamicVariables,
                this.config.voiceId,
                this.config.language
              )
            },
            language: this.config.language
          },
          // Voice override - must be at same level as agent per ElevenLabs docs
          ...(this.config.voiceId && {
            tts: {
              voiceId: resolveVoiceId(this.config.voiceId)  // Using double quotes as suggested by ElevenLabs
            }
          })
        }
      } : {}

      // Log the complete overrides structure (per ElevenLabs support suggestion)
      if (overridesConfig.overrides) {
        console.log('🎤 Sending full overrides config to ElevenLabs:')
        console.log(JSON.stringify(overridesConfig.overrides, null, 2))
        if (this.config.voiceId) {
          console.warn('⚠️ NOTE: Voice overrides require "Voice ID Overrides" enabled in Dashboard > Security')
          console.warn('⚠️ Allow 5 minutes propagation delay after enabling the setting')
        }

        // Enhanced debug logging for data transmission verification
        const systemPrompt = overridesConfig.overrides.agent?.prompt?.prompt
        if (systemPrompt) {
          console.log('📝 System Prompt Preview (first 500 chars):')
          console.log(systemPrompt.substring(0, 500))
          console.log('📝 System Prompt Preview (last 500 chars):')
          console.log('...' + systemPrompt.substring(Math.max(0, systemPrompt.length - 500)))
          console.log(`📊 Total System Prompt Length: ${systemPrompt.length} characters`)
        }
      }

      // Enhanced dynamic variables logging
      console.log('🔧 Dynamic Variables Summary:')
      console.log('- training_mode:', this.config.dynamicVariables?.training_mode)
      console.log('- customer_emotion_level:', this.config.dynamicVariables?.customer_emotion_level)
      console.log('- knowledge_context:', this.config.dynamicVariables?.knowledge_context ?
        `✅ Included (${this.config.dynamicVariables.knowledge_context.length} chars)` : '❌ NOT included')
      console.log('- client_behavior:', this.config.dynamicVariables?.client_behavior ?
        `✅ Included (${this.config.dynamicVariables.client_behavior.length} chars)` : '❌ NOT included')
      console.log('- scenario_title:', this.config.dynamicVariables?.scenario_title || 'not provided')

      // Start ElevenLabs conversation session with dynamic variables
      this.conversation = await Conversation.startSession({
        agentId: this.config.agentId,
        connectionType: this.config.connectionType,
        conversationToken: token,

        // Pass dynamic variables for training context
        ...(this.config.dynamicVariables && { dynamicVariables: this.config.dynamicVariables }),

        // Add overrides (voice override now RE-ENABLED per ElevenLabs support)
        ...overridesConfig,

        // Event handlers
        onConnect: () => {
          console.log('✅ ElevenLabs conversation connected')
          this.state.isConnected = true
          this.state.connectionStatus = 'connected'

          // Try to capture conversation ID immediately
          this.tryCapturingConversationId('onConnect event')

          // Set up LiveKit room event listeners for track subscriptions
          if (this.conversation?.connection?.room) {
            const room = this.conversation.connection.room
            console.log('🎧 Setting up LiveKit room event listeners for audio tracks')

            // Listen for track subscribed events
            room.on('trackSubscribed', (track: any, publication: any, participant: any) => {
              if (track.kind === 'audio') {
                console.log('🎵 Audio track subscribed from remote participant!')
                console.log('   Track:', track)
                console.log('   Publication:', publication)
                console.log('   Participant:', participant)
                this.emit('remoteAudioTrackAvailable', track)
              }
            })

            console.log('✅ LiveKit room event listeners registered')
          }

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
   * Get the remote audio stream for recording (cross-platform compatible)
   * Works on all devices: Desktop Chrome/Safari, Mobile iOS/Android
   */
  getRemoteAudioStream(): MediaStream | null {
    try {
      if (!this.conversation) {
        console.warn('⚠️ Conversation not initialized, cannot get audio stream')
        return null
      }

      console.log('🔍 Attempting to extract ElevenLabs audio stream...')
      console.log('🔍 Conversation object type:', typeof this.conversation)
      console.log('🔍 Conversation object keys:', Object.keys(this.conversation || {}))

      // Method 1: Try to access peer connection directly from conversation object
      if (this.conversation.connection) {
        console.log('✅ Found conversation.connection')
        console.log('🔍 Connection keys:', Object.keys(this.conversation.connection))

        // Check for WebRTC peer connection
        if (this.conversation.connection.peerConnection) {
          console.log('✅ Found peerConnection')
          const peerConnection = this.conversation.connection.peerConnection

          // Get remote streams from peer connection
          const remoteStream = peerConnection.getRemoteStreams
            ? peerConnection.getRemoteStreams()[0]
            : null

          if (remoteStream && remoteStream.getAudioTracks().length > 0) {
            console.log('✅ Extracted remote audio from peerConnection.getRemoteStreams()')
            console.log(`   Audio tracks: ${remoteStream.getAudioTracks().length}`)
            return remoteStream
          }

          // Try modern API: getReceivers()
          const receivers = peerConnection.getReceivers()
          if (receivers && receivers.length > 0) {
            console.log(`✅ Found ${receivers.length} receivers`)

            const audioReceiver = receivers.find(r => r.track && r.track.kind === 'audio')
            if (audioReceiver && audioReceiver.track) {
              const stream = new MediaStream([audioReceiver.track])
              console.log('✅ Created MediaStream from audio receiver track')
              return stream
            }
          }
        }

        // Check for room connection (LiveKit style) - PRIMARY METHOD
        if (this.conversation.connection.room) {
          console.log('✅ Found connection.room (LiveKit)')
          const room = this.conversation.connection.room
          console.log('🔍 Room object:', room)
          console.log('🔍 Room keys:', Object.keys(room))

          // Try to get remote participants
          if (room.remoteParticipants) {
            console.log('✅ Found remoteParticipants')
            const participants = Array.from(room.remoteParticipants.values())
            console.log(`🔍 Found ${participants.length} remote participants`)

            if (participants.length > 0) {
              const participant = participants[0]
              console.log('✅ Found remote participant:', participant)
              console.log('🔍 Participant keys:', Object.keys(participant))

              // Method 1: Get audio tracks from audioTrackPublications (LiveKit API)
              if (participant.audioTrackPublications) {
                console.log('🔍 Found audioTrackPublications')
                const audioTracks = Array.from(participant.audioTrackPublications.values())
                console.log(`🔍 Found ${audioTracks.length} audio track publications`)

                if (audioTracks.length > 0) {
                  const audioPublication = audioTracks[0]
                  console.log('🔍 Audio publication:', audioPublication)
                  console.log('🔍 Audio publication keys:', Object.keys(audioPublication))

                  // Check if track is available
                  if (audioPublication.track) {
                    console.log('✅ Found audio track in publication')
                    const track = audioPublication.track

                    // LiveKit tracks have a mediaStreamTrack property
                    if (track.mediaStreamTrack) {
                      const stream = new MediaStream([track.mediaStreamTrack])
                      console.log('✅ Extracted audio from LiveKit participant (audioTrackPublications)')
                      console.log(`   Audio tracks: ${stream.getAudioTracks().length}`)
                      return stream
                    } else if (track.track) {
                      // Alternative property name
                      const stream = new MediaStream([track.track])
                      console.log('✅ Extracted audio from LiveKit participant (track.track)')
                      console.log(`   Audio tracks: ${stream.getAudioTracks().length}`)
                      return stream
                    } else {
                      console.log('🔍 Track object:', track)
                      console.log('🔍 Track keys:', Object.keys(track))
                    }
                  } else if (audioPublication.audioTrack) {
                    // Try alternative property
                    const track = audioPublication.audioTrack
                    if (track.mediaStreamTrack) {
                      const stream = new MediaStream([track.mediaStreamTrack])
                      console.log('✅ Extracted audio from LiveKit participant (audioTrack.mediaStreamTrack)')
                      return stream
                    }
                  } else {
                    console.warn('⚠️ Audio publication has no track')
                  }
                }
              }

              // Method 2: Try deprecated audioTracks property (fallback)
              if (participant.audioTracks) {
                console.log('🔍 Found deprecated audioTracks property')
                const audioTracks = Array.from(participant.audioTracks.values())
                if (audioTracks.length > 0) {
                  const audioPublication = audioTracks[0]
                  if (audioPublication.track && audioPublication.track.mediaStreamTrack) {
                    const stream = new MediaStream([audioPublication.track.mediaStreamTrack])
                    console.log('✅ Extracted audio from LiveKit participant (deprecated audioTracks)')
                    return stream
                  }
                }
              }
            }
          }
        }
      }

      // Method 2: Try to find audio elements created by SDK
      console.log('🔍 Fallback: Searching for audio elements in DOM...')
      const audioElements = document.querySelectorAll('audio')
      console.log(`🔍 Found ${audioElements.length} audio elements in DOM`)

      if (audioElements.length === 0) {
        console.warn('⚠️ No audio elements found - agent may not have spoken yet')
        return null
      }

      // Find the audio element that's likely used by ElevenLabs
      for (let i = audioElements.length - 1; i >= 0; i--) {
        const audio = audioElements[i]
        // Check if this audio element has a MediaStream source (WebRTC audio)
        if (audio.srcObject && audio.srcObject instanceof MediaStream) {
          const stream = audio.srcObject as MediaStream
          if (stream.getAudioTracks().length > 0) {
            console.log('✅ Found ElevenLabs audio element with MediaStream')
            console.log(`   Audio tracks: ${stream.getAudioTracks().length}`)
            return stream
          }
        }
      }

      console.warn('⚠️ Could not find ElevenLabs audio stream using any method')
      console.warn('💡 Available conversation properties:', Object.keys(this.conversation || {}))
      return null

    } catch (error) {
      console.error('❌ Failed to get remote audio stream:', error)
      return null
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