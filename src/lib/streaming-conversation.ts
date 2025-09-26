/**
 * Streaming Conversation Service
 * Handles real-time, natural dialogue with word-by-word processing
 * Similar to ElevenLabs conversational AI approach
 */

export interface ConversationConfig {
  language: string
  sampleRate: number
  chunkSize: number
  voiceActivityThreshold: number
  silenceTimeout: number // ms to wait before considering speech ended
  interruptionThreshold: number // volume level that triggers interruption
}

export interface ConversationChunk {
  type: 'partial' | 'final'
  text: string
  confidence: number
  speaker: 'user' | 'avatar'
  timestamp: number
  audioData?: ArrayBuffer
}

export interface ConversationState {
  isListening: boolean
  isSpeaking: boolean
  currentUtterance: string
  partialTranscript: string
  conversationHistory: ConversationChunk[]
  voiceActivityLevel: number
}

export class StreamingConversationService {
  private mediaRecorder: MediaRecorder | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private microphone: MediaStreamAudioSourceNode | null = null

  private isRecording = false
  private isProcessingAudio = false
  private audioChunks: Blob[] = []
  private accumulatedChunks: Blob[] = []
  private lastSpeechTime = 0
  private silenceTimer: NodeJS.Timeout | null = null
  private lastSTTTime = 0
  private STT_INTERVAL = 3000 // Send to STT every 3 seconds for complete audio files

  private config: ConversationConfig
  private state: ConversationState
  private eventListeners: Map<string, Function[]> = new Map()

  constructor(config: ConversationConfig) {
    this.config = config
    this.state = {
      isListening: false,
      isSpeaking: false,
      currentUtterance: '',
      partialTranscript: '',
      conversationHistory: [],
      voiceActivityLevel: 0
    }
  }

  /**
   * Initialize the streaming conversation system
   */
  async initialize(stream: MediaStream): Promise<void> {
    try {
      // Setup audio context for real-time analysis
      this.audioContext = new AudioContext({ sampleRate: this.config.sampleRate })
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 256
      this.analyser.smoothingTimeConstant = 0.8

      // Connect microphone to analyser
      this.microphone = this.audioContext.createMediaStreamSource(stream)
      this.microphone.connect(this.analyser)

      // Setup MediaRecorder for audio chunks
      // Use shorter timeslices and send individual chunks instead of accumulating
      let options: MediaRecorderOptions = {}

      // Try MP4 first as it may work better with individual chunks
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options = { mimeType: 'audio/mp4' }
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus' }
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' }
      }

      console.log(`🎙️ Using audio format: ${options.mimeType || 'default'}`)
      this.mediaRecorder = new MediaRecorder(stream, options)

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
          this.processAudioChunk(event.data)
        }
      }

      // Start continuous recording with small chunks
      this.startContinuousRecording()

      // Start voice activity detection
      this.startVoiceActivityDetection()

      console.log('✅ Streaming conversation initialized')
      this.emit('initialized')

    } catch (error) {
      console.error('❌ Failed to initialize streaming conversation:', error)
      throw error
    }
  }

  /**
   * Start continuous audio recording with longer complete segments
   */
  private startContinuousRecording(): void {
    if (!this.mediaRecorder) return

    this.isRecording = true
    // Use longer timeslice to ensure complete audio files (3 seconds)
    this.mediaRecorder.start(3000)

    // Restart recording every chunk to maintain continuous flow
    this.mediaRecorder.onstop = () => {
      if (this.isRecording && this.mediaRecorder) {
        this.mediaRecorder.start(3000)
      }
    }
  }

  /**
   * Real-time voice activity detection
   */
  private startVoiceActivityDetection(): void {
    if (!this.analyser) return

    const bufferLength = this.analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const detectVoiceActivity = () => {
      if (!this.analyser) return

      this.analyser.getByteFrequencyData(dataArray)

      // Calculate average volume level
      const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength
      this.state.voiceActivityLevel = average

      const isSpeaking = average > this.config.voiceActivityThreshold
      const currentTime = Date.now()

      if (isSpeaking) {
        this.lastSpeechTime = currentTime

        if (!this.state.isListening) {
          this.startListening()
        }

        // Clear silence timer
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer)
          this.silenceTimer = null
        }

      } else if (this.state.isListening) {
        // Start silence timer if not already started
        if (!this.silenceTimer) {
          this.silenceTimer = setTimeout(() => {
            this.stopListening()
          }, this.config.silenceTimeout)
        }
      }

      // Continue monitoring
      requestAnimationFrame(detectVoiceActivity)
    }

    detectVoiceActivity()
  }

  /**
   * Process audio chunk - send individual chunks directly to STT
   */
  private async processAudioChunk(audioChunk: Blob): Promise<void> {
    if (!this.state.isListening) return

    const currentTime = Date.now()
    const timeSinceLastSTT = currentTime - this.lastSTTTime

    // Send individual chunks directly if enough time has passed and chunk is large enough
    if (timeSinceLastSTT >= this.STT_INTERVAL && audioChunk.size >= 10000) {
      await this.sendChunkToSTT(audioChunk)
      this.lastSTTTime = currentTime
    }
  }

  /**
   * Send individual chunk to STT
   */
  private async sendChunkToSTT(audioChunk: Blob): Promise<void> {
    if (this.isProcessingAudio) return

    try {
      this.isProcessingAudio = true

      console.log(`🎙️ Sending individual audio chunk: ${audioChunk.size} bytes`)

      // Convert to proper format for STT API
      const formData = new FormData()
      const mimeType = audioChunk.type || 'audio/webm'
      let extension = 'webm' // default
      if (mimeType.includes('wav')) extension = 'wav'
      else if (mimeType.includes('mp4')) extension = 'mp4'
      else if (mimeType.includes('webm')) extension = 'webm'

      formData.append('audio', audioChunk, `chunk.${extension}`)
      formData.append('language', this.config.language)
      formData.append('streaming', 'true')

      const response = await fetch('/api/stt-streaming', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.transcript) {
          this.handleTranscriptionChunk(result.transcript, result.is_final || false)
        }
      }

    } catch (error) {
      console.error('❌ STT chunk processing failed:', error)
    } finally {
      this.isProcessingAudio = false
    }
  }

  /**
   * Handle streaming transcription results
   */
  private handleTranscriptionChunk(text: string, isFinal: boolean): void {
    const chunk: ConversationChunk = {
      type: isFinal ? 'final' : 'partial',
      text: text,
      confidence: 0.8, // Would come from STT service
      speaker: 'user',
      timestamp: Date.now()
    }

    if (isFinal) {
      // Add to conversation history
      this.state.conversationHistory.push(chunk)
      this.state.currentUtterance = text
      this.state.partialTranscript = ''

      console.log(`👤 User (final): ${text}`)
      this.emit('userSpeechFinal', chunk)

      // Generate avatar response
      this.generateAvatarResponse(text)

    } else {
      // Update partial transcript
      this.state.partialTranscript = text
      console.log(`👤 User (partial): ${text}`)
      this.emit('userSpeechPartial', chunk)
    }

    this.emit('transcriptionUpdate', chunk)
  }

  /**
   * Generate and stream avatar response
   */
  private async generateAvatarResponse(userInput: string): Promise<void> {
    try {
      console.log('🤖 Generating avatar response...')
      this.state.isSpeaking = true
      this.emit('avatarStartSpeaking')

      // Get next question or response based on conversation context
      const response = await fetch('/api/avatar-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput,
          conversationHistory: this.state.conversationHistory,
          language: this.config.language
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          await this.speakWithStreaming(result.text)
        }
      }

    } catch (error) {
      console.error('❌ Avatar response generation failed:', error)
    } finally {
      this.state.isSpeaking = false
      this.emit('avatarStopSpeaking')
    }
  }

  /**
   * Stream TTS audio with real-time playback
   */
  private async speakWithStreaming(text: string): Promise<void> {
    try {
      // Emit avatar response text for transcript
      this.emit('avatarResponse', text)

      const response = await fetch('/api/tts-streaming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          language: this.config.language,
          streaming: true
        })
      })

      if (response.ok) {
        const contentType = response.headers.get('content-type')

        if (contentType && contentType.includes('audio/')) {
          // Direct audio stream from ElevenLabs
          console.log('✅ Playing ElevenLabs streaming audio')
          await this.playStreamingResponse(response)
        } else {
          // Try to parse as JSON for fallback scenarios
          try {
            const result = await response.json()
            if (result.provider === 'browser' || !result.audioData) {
              // Use browser TTS fallback
              console.log('🔄 Using browser TTS fallback')
              await this.speakWithBrowserTTS(text)
            } else if (result.audioData) {
              console.log('✅ Playing ElevenLabs base64 audio')
              await this.playBase64Audio(result.audioData)
            }
          } catch (jsonError) {
            // If JSON parsing fails, assume it's binary audio data
            console.log('⚠️ JSON parsing failed, treating as binary audio:', jsonError)
            await this.playStreamingResponse(response)
          }
        }
      }

    } catch (error) {
      console.error('❌ Streaming TTS failed:', error)
      // Fallback to browser TTS
      await this.speakWithBrowserTTS(text)
    }
  }

  /**
   * Play streaming audio response
   */
  private async playStreamingResponse(response: Response): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl)
          resolve()
        }
        audio.onerror = (error) => {
          URL.revokeObjectURL(audioUrl)
          reject(error)
        }

        audio.play()
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Play base64 encoded audio
   */
  private async playBase64Audio(base64Audio: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const audioBlob = new Blob([
          Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0))
        ], { type: 'audio/mpeg' })

        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl)
          resolve()
        }
        audio.onerror = (error) => {
          URL.revokeObjectURL(audioUrl)
          reject(error)
        }

        audio.play()
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Browser TTS fallback
   */
  private async speakWithBrowserTTS(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve()
        return
      }

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = this.config.language === 'ru' ? 'ru-RU' :
                       this.config.language === 'ka' ? 'ka-GE' : 'en-US'
      utterance.rate = 1.0
      utterance.pitch = 1.0
      utterance.volume = 0.8

      utterance.onend = () => resolve()
      utterance.onerror = () => resolve()

      window.speechSynthesis.speak(utterance)
    })
  }

  /**
   * Start a new conversation session
   */
  async startConversation(context: { companyId: string, scenarioContext: any }): Promise<void> {
    try {
      console.log('🚀 Starting conversation session')

      // Generate initial greeting/question
      const response = await fetch('/api/avatar-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput: '', // No user input for initial greeting
          conversationHistory: [],
          language: this.config.language,
          companyId: context.companyId,
          scenarioContext: context.scenarioContext
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          await this.speakWithStreaming(result.text)
        }
      }

    } catch (error) {
      console.error('❌ Failed to start conversation:', error)
      throw error
    }
  }

  /**
   * Start listening for user input
   */
  private startListening(): void {
    if (this.state.isListening) return

    this.state.isListening = true
    this.state.partialTranscript = ''
    console.log('👂 Started listening')
    this.emit('listeningStarted')
  }

  /**
   * Stop listening for user input
   */
  private stopListening(): void {
    if (!this.state.isListening) return

    this.state.isListening = false
    console.log('🔇 Stopped listening')
    this.emit('listeningStopped')

    // Clear silence timer
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
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
   * Get current conversation state
   */
  getState(): ConversationState {
    return { ...this.state }
  }

  /**
   * Stop the streaming conversation
   */
  stop(): void {
    this.isRecording = false

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
    }

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
    }

    if (this.audioContext) {
      this.audioContext.close()
    }

    console.log('🛑 Streaming conversation stopped')
    this.emit('stopped')
  }
}