/**
 * ElevenLabs Conversational AI Service
 * Replaces the previous streaming conversation system with ElevenLabs integrated platform
 * Handles real-time STT, LLM processing, and TTS in a single integrated system
 */

import { Conversation } from '@elevenlabs/client'
import { CustomerEmotionLevel, getEmotionDefinition } from './customer-emotions'

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
  private getScenarioSpecificGreeting(language: string, trainingMode: string, emotionLevel?: CustomerEmotionLevel, clientBehavior?: string): string {
    let greeting: string

    if (trainingMode === 'service_practice') {
      // For service practice, AI acts as customer - use customer greeting
      const baseGreeting = SERVICE_PRACTICE_GREETINGS[language as keyof typeof SERVICE_PRACTICE_GREETINGS] || SERVICE_PRACTICE_GREETINGS['en']

      // Customize greeting based on emotion level
      if (emotionLevel) {
        const emotionDefinition = getEmotionDefinition(emotionLevel)

        // Use emotional linguistic markers in greeting
        switch(emotionLevel) {
          case 'frustrated':
            greeting = language === 'ru' ? 'Извините, мне срочно нужна помощь.' :
                      language === 'it' ? 'Mi scusi, ho urgentemente bisogno di aiuto.' :
                      language === 'es' ? 'Disculpe, necesito ayuda urgentemente.' :
                      'Excuse me, I need help right away.'
            break
          case 'angry':
            greeting = language === 'ru' ? 'Послушайте, у меня серьезная проблема!' :
                      language === 'it' ? 'Senta, ho un problema serio!' :
                      language === 'es' ? '¡Oiga, tengo un problema serio!' :
                      'Listen, I have a serious problem!'
            break
          case 'extremely_angry':
            greeting = language === 'ru' ? 'Это НЕПРИЕМЛЕМО! Мне нужен менеджер!' :
                      language === 'it' ? 'Questo è INACCETTABILE! Ho bisogno del manager!' :
                      language === 'es' ? '¡Esto es INACEPTABLE! ¡Necesito al gerente!' :
                      'This is UNACCEPTABLE! I need to speak to a manager!'
            break
          case 'calm':
          default:
            greeting = baseGreeting
            break
        }

        console.log(`🎭 ${emotionDefinition.icon} ${emotionDefinition.label} greeting for ${language}: "${greeting}"`)
      } else {
        greeting = baseGreeting
        console.log(`🎭 Customer roleplay greeting for ${language}: "${greeting}"`)
      }
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
      // Using ElevenLabs' six building blocks structure for better role consistency

      // Check if we have emotion-specific instructions from dynamic variables
      const emotionLevel = dynamicVariables?.customer_emotion_level as CustomerEmotionLevel | undefined
      const emotionDefinition = emotionLevel ? getEmotionDefinition(emotionLevel) : null

      if (emotionDefinition) {
        // Use comprehensive emotion-based system prompt
        basePrompt = `# Personality
You are a ${emotionDefinition.label.toLowerCase()} at a ${dynamicVariables?.establishment_type || 'coffee shop'}.
${emotionDefinition.personality}

You are NOT an employee, assistant, or service provider under any circumstances.
You came here as a paying customer who needs help and service from the establishment's employees.

Language: ${dynamicVariables?.language || 'English'}
Emotional State: ${emotionLevel}

# Environment
You are in a training simulation where a human trainee is practicing customer service skills.
You are the CUSTOMER role - the human is the EMPLOYEE role.
This is voice-based roleplay training for de-escalation and conflict resolution skills.

# Tone
${emotionDefinition.tone}

LINGUISTIC MARKERS TO USE:
${emotionDefinition.linguisticMarkers.map(marker => `- "${marker}"`).join('\n')}

# Goal
${emotionDefinition.behavioralGoals}

Your primary objective is to remain consistently in the customer role throughout the entire interaction.
Present realistic customer scenarios for the trainee to practice handling.
NEVER switch to providing service - you are always the one receiving service.

# Guardrails - Emotional Consistency
${emotionDefinition.emotionalConsistencyRules}

DE-ESCALATION CONDITIONS:
The employee can improve your mood by: ${emotionDefinition.deEscalationTriggers}

CRITICAL ROLE BOUNDARIES:
- You are ONLY a customer, never break this role
- NEVER act as employee, assistant, barista, or service provider
- NEVER offer services, recommendations, or employee assistance
- If confused about user input, respond AS A CUSTOMER seeking clarification
- When uncertain, default to asking for employee help rather than providing it
- Stay in character as a ${emotionLevel?.replace('_', ' ')} customer throughout

CONFUSION HANDLING PROTOCOL:
- If user input is unclear → Respond as customer asking for clarification
- If role ambiguity occurs → Reinforce your customer position naturally
- NEVER interpret confusion as permission to switch roles

COMPANY KNOWLEDGE (for evaluating employee responses):
${dynamicVariables?.knowledge_context || 'Use general service industry knowledge'}

SCENARIO CONTEXT:
${dynamicVariables?.client_behavior || 'Act as customer in this service scenario'}

# Tools
[None needed for this roleplay scenario]

Training mode: ${trainingMode}
Emotional Level: ${emotionLevel}
Available documents: ${dynamicVariables?.documents_available || 1}`
      } else {
        // Fallback to original generic customer behavior (for backwards compatibility)
        basePrompt = `# Personality
You are a customer seeking service at a ${dynamicVariables?.establishment_type || 'coffee shop'}. You are NOT an employee, assistant, or service provider under any circumstances.
You came here as a paying customer who needs help and service from the establishment's employees.

# Environment
You are in a training simulation where a human trainee is practicing customer service skills.
You are the CUSTOMER role - the human is the EMPLOYEE role.
This is voice-based roleplay training.
Language: ${dynamicVariables?.language || 'English'}

# Tone
Speak naturally as a customer would - conversational, sometimes uncertain about what you want, occasionally asking follow-up questions.
Use customer-appropriate language: ask questions, express needs, react to service quality.
Match the emotional tone of your customer behavior profile.

# Goal
Your primary objective is to remain consistently in the customer role throughout the entire interaction.
Present realistic customer scenarios for the trainee to practice handling.
NEVER switch to providing service - you are always the one receiving service.
Test the employee's knowledge and service skills through your customer interactions.

# Guardrails
CRITICAL ROLE BOUNDARIES:
- You are ONLY a customer, never break this role
- NEVER act as employee, assistant, barista, or service provider
- NEVER offer services, recommendations, or employee assistance
- If confused about user input, respond AS A CUSTOMER seeking clarification
- When uncertain, default to asking for employee help rather than providing it
- If the human seems confused, stay in character and ask them to clarify as their customer

CONFUSION HANDLING PROTOCOL:
- If user input is unclear → Respond as customer asking for clarification
- If role ambiguity occurs → Reinforce your customer position naturally
- NEVER interpret confusion as permission to switch roles
- Example responses when confused:
  * "Извините, можете повторить?" (Russian)
  * "Sorry, could you repeat that?" (English)
  * "Mi scusi, può ripetere?" (Italian)

CUSTOMER BEHAVIOR PROFILE:
${dynamicVariables?.client_behavior || 'Act as a typical customer seeking help with questions about products or services'}

ROLE REMINDER: You came here seeking service, not to provide it. When in doubt, ask for employee assistance.

COMPANY KNOWLEDGE (for evaluating employee responses):
${dynamicVariables?.knowledge_context || 'Use general service industry knowledge'}

EXPECTED EMPLOYEE RESPONSE (context only, not your role):
${dynamicVariables?.expected_response || 'Employee should be helpful and knowledgeable'}

# Tools
[None needed for this roleplay scenario]

Training mode: ${trainingMode}
Available documents: ${dynamicVariables?.documents_available || 1}`
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
                this.config.dynamicVariables.customer_emotion_level as CustomerEmotionLevel | undefined,
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