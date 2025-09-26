import {
  SpeechToTextResponse,
  WhisperResponse,
  VoiceActivityEvent,
  SupportedLanguageCode
} from './avatar-types'

class STTService {
  private readonly apiKey = process.env.OPENAI_API_KEY
  private readonly baseUrl = 'https://api.openai.com/v1/audio/transcriptions'

  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private isRecording = false
  private onTranscriptionCallback?: (response: SpeechToTextResponse) => void
  private onVoiceActivityCallback?: (event: VoiceActivityEvent) => void

  async transcribeAudio(
    audioBlob: Blob,
    language: SupportedLanguageCode = 'en'
  ): Promise<SpeechToTextResponse> {
    if (!this.apiKey) {
      console.log('🚧 OpenAI API key not found, using fallback STT')
      return this.fallbackSTT(audioBlob)
    }

    try {
      console.log(`🎯 Transcribing ${audioBlob.size} bytes of audio in ${language}`)

      const formData = new FormData()
      formData.append('file', audioBlob, 'audio.webm')
      formData.append('model', 'whisper-1')
      formData.append('language', language)
      formData.append('response_format', 'verbose_json')

      const startTime = Date.now()

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Whisper API error: ${response.statusText}`)
      }

      const data: WhisperResponse = await response.json()
      const processingTime = Date.now() - startTime

      console.log(`✅ Transcription completed in ${processingTime}ms: "${data.text.substring(0, 100)}..."`)

      return {
        text: data.text.trim(),
        confidence: 0.95, // Whisper doesn't provide confidence, use high default
        language: data.language || language,
        duration_ms: Math.round((data.duration || 0) * 1000)
      }

    } catch (error) {
      console.error('❌ STT transcription failed:', error)
      return this.fallbackSTT(audioBlob)
    }
  }

  async startContinuousRecording(
    onTranscription: (response: SpeechToTextResponse) => void,
    onVoiceActivity?: (event: VoiceActivityEvent) => void,
    language: SupportedLanguageCode = 'en'
  ): Promise<void> {
    if (this.isRecording) {
      console.log('⚠️ Already recording, stopping previous session')
      this.stopRecording()
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      })

      this.onTranscriptionCallback = onTranscription
      this.onVoiceActivityCallback = onVoiceActivity

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      this.audioChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }

      this.mediaRecorder.onstop = async () => {
        if (this.audioChunks.length > 0) {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })

          if (audioBlob.size > 1000) { // Only transcribe if there's meaningful audio
            try {
              const transcription = await this.transcribeAudio(audioBlob, language)
              if (transcription.text.length > 0) {
                this.onTranscriptionCallback?.(transcription)
              }
            } catch (error) {
              console.error('❌ Continuous transcription error:', error)
            }
          }
        }

        this.audioChunks = []

        // If still recording, start next chunk
        if (this.isRecording && this.mediaRecorder) {
          this.mediaRecorder.start(3000) // 3-second chunks
        }
      }

      // Add voice activity detection
      this.addVoiceActivityDetection(stream)

      this.mediaRecorder.start(3000) // Record in 3-second chunks
      this.isRecording = true

      console.log('🎤 Started continuous recording with 3-second chunks')

    } catch (error) {
      console.error('❌ Failed to start continuous recording:', error)
      throw error
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      console.log('🛑 Stopping continuous recording')
      this.isRecording = false
      this.mediaRecorder.stop()

      // Stop all tracks
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop())
    }
  }

  async recordSingleResponse(
    language: SupportedLanguageCode = 'en',
    timeoutMs: number = 10000
  ): Promise<SpeechToTextResponse> {
    console.log(`🎤 Recording single response (timeout: ${timeoutMs}ms)`)

    return new Promise(async (resolve, reject) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000
          }
        })

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        })

        const chunks: Blob[] = []
        let silenceTimeout: NodeJS.Timeout

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data)
          }
        }

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach(track => track.stop())

          if (chunks.length > 0) {
            const audioBlob = new Blob(chunks, { type: 'audio/webm' })
            try {
              const transcription = await this.transcribeAudio(audioBlob, language)
              resolve(transcription)
            } catch (error) {
              reject(error)
            }
          } else {
            resolve({
              text: '',
              confidence: 0,
              language,
              duration_ms: 0
            })
          }
        }

        // Auto-stop recording after timeout
        const autoStopTimeout = setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop()
          }
        }, timeoutMs)

        // Add voice activity detection for auto-stop on silence
        this.addVoiceActivityDetection(stream, (event) => {
          if (event.type === 'silence') {
            clearTimeout(silenceTimeout)
            silenceTimeout = setTimeout(() => {
              if (mediaRecorder.state === 'recording') {
                console.log('🔇 Auto-stopping due to silence')
                clearTimeout(autoStopTimeout)
                mediaRecorder.stop()
              }
            }, 2000) // Stop after 2 seconds of silence
          } else if (event.type === 'start') {
            clearTimeout(silenceTimeout)
          }
        })

        mediaRecorder.start()

      } catch (error) {
        reject(error)
      }
    })
  }

  private addVoiceActivityDetection(
    stream: MediaStream,
    onActivity?: (event: VoiceActivityEvent) => void
  ): void {
    try {
      const audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()

      analyser.fftSize = 512
      analyser.minDecibels = -90
      analyser.maxDecibels = -10
      analyser.smoothingTimeConstant = 0.85

      source.connect(analyser)

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      let isSpeaking = false
      let silenceStart = 0
      const silenceThreshold = 2000 // 2 seconds

      const checkAudioLevel = () => {
        if (!this.isRecording && !onActivity) return

        analyser.getByteFrequencyData(dataArray)

        // Calculate average volume
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i]
        }
        const average = sum / bufferLength

        const threshold = 20 // Voice activity threshold
        const currentTime = Date.now()

        if (average > threshold) {
          if (!isSpeaking) {
            isSpeaking = true
            const event: VoiceActivityEvent = {
              type: 'start',
              timestamp: currentTime,
              confidence: Math.min(average / 100, 1)
            }
            this.onVoiceActivityCallback?.(event)
            onActivity?.(event)
          }
          silenceStart = currentTime
        } else {
          if (isSpeaking && (currentTime - silenceStart) > silenceThreshold) {
            isSpeaking = false
            const event: VoiceActivityEvent = {
              type: 'silence',
              timestamp: currentTime
            }
            this.onVoiceActivityCallback?.(event)
            onActivity?.(event)
          }
        }

        requestAnimationFrame(checkAudioLevel)
      }

      checkAudioLevel()

    } catch (error) {
      console.error('❌ Voice activity detection setup failed:', error)
    }
  }

  private async fallbackSTT(audioBlob: Blob): Promise<SpeechToTextResponse> {
    console.log('🔄 Using Web Speech API fallback')

    try {
      if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
        return new Promise((resolve) => {
          const recognition = new (window as any).webkitSpeechRecognition()
          recognition.continuous = false
          recognition.interimResults = false
          recognition.lang = 'en-US'

          recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript
            const confidence = event.results[0][0].confidence

            resolve({
              text: transcript,
              confidence: confidence || 0.8,
              language: 'en',
              duration_ms: 0
            })
          }

          recognition.onerror = () => {
            resolve({
              text: '',
              confidence: 0,
              language: 'en',
              duration_ms: 0
            })
          }

          recognition.start()
        })
      }
    } catch (error) {
      console.error('Fallback STT failed:', error)
    }

    return {
      text: '',
      confidence: 0,
      language: 'en',
      duration_ms: 0
    }
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording
  }

  async getUserMediaConstraints(): Promise<MediaStreamConstraints> {
    return {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,
        channelCount: 1
      },
      video: false
    }
  }
}

export const sttService = new STTService()