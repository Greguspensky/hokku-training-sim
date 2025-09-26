import {
  ElevenLabsVoice,
  ElevenLabsResponse,
  SupportedLanguageCode
} from './avatar-types'

class TTSService {
  private readonly apiKey = process.env.ELEVENLABS_API_KEY
  private readonly baseUrl = 'https://api.elevenlabs.io/v1'

  private voiceMap: Record<SupportedLanguageCode, ElevenLabsVoice> = {
    en: { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', language: 'en', gender: 'male' },
    es: { voice_id: 'VR6AewLTigWG4xSOukaG', name: 'Antoni', language: 'es', gender: 'male' },
    fr: { voice_id: 'ThT5KcBeYPX3keUQqHPh', name: 'Thomas', language: 'fr', gender: 'male' },
    de: { voice_id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', language: 'de', gender: 'female' },
    it: { voice_id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', language: 'it', gender: 'female' },
    pt: { voice_id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', language: 'pt', gender: 'male' },
    nl: { voice_id: 'bVMeCyTHy58xNoL34h3p', name: 'Jeremy', language: 'nl', gender: 'male' },
    pl: { voice_id: 'GBv7mTt0atIp3Br8iCZE', name: 'Matilda', language: 'pl', gender: 'female' },
    ru: { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam-Multilingual', language: 'ru', gender: 'male' },
    ka: { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam-Multilingual', language: 'ka', gender: 'male' },
    ja: { voice_id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', language: 'ja', gender: 'female' },
    ko: { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', language: 'ko', gender: 'female' },
    zh: { voice_id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', language: 'zh', gender: 'male' }
  }

  async synthesizeSpeech(
    text: string,
    languageCode: SupportedLanguageCode = 'en'
  ): Promise<ArrayBuffer> {
    if (!this.apiKey) {
      console.log('🚧 ElevenLabs API key not found, using fallback TTS')
      return this.fallbackTTS(text)
    }

    try {
      const voice = this.voiceMap[languageCode]
      if (!voice) {
        console.warn(`⚠️ No ElevenLabs voice configured for language: ${languageCode}, using fallback`)
        return this.fallbackTTS(text)
      }

      console.log(`🎤 Synthesizing speech: "${text.substring(0, 50)}..." in ${languageCode}`)

      const response = await fetch(`${this.baseUrl}/text-to-speech/${voice.voice_id}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true
          }
        })
      })

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.statusText}`)
      }

      const audioBuffer = await response.arrayBuffer()
      console.log(`✅ Generated ${audioBuffer.byteLength} bytes of audio`)

      return audioBuffer

    } catch (error) {
      console.error('❌ TTS synthesis failed:', error)
      return this.fallbackTTS(text)
    }
  }

  async synthesizeSpeechFromURL(
    text: string,
    languageCode: SupportedLanguageCode = 'en'
  ): Promise<string> {
    if (!this.apiKey) {
      console.log('🚧 ElevenLabs API key not found, using fallback TTS URL')
      return this.fallbackTTSUrl(text)
    }

    try {
      const voice = this.voiceMap[languageCode]
      console.log(`🎤 Generating TTS URL for: "${text.substring(0, 50)}..." in ${languageCode}`)

      const response = await fetch(`${this.baseUrl}/text-to-speech/${voice.voice_id}/stream`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true
          },
          response_format: 'mp3_44100_128'
        })
      })

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.statusText}`)
      }

      const result: ElevenLabsResponse = await response.json()

      if (result.audio_url) {
        console.log(`✅ Generated TTS URL: ${result.audio_url}`)
        return result.audio_url
      }

      throw new Error('No audio URL returned from ElevenLabs')

    } catch (error) {
      console.error('❌ TTS URL generation failed:', error)
      return this.fallbackTTSUrl(text)
    }
  }

  private async fallbackTTS(text: string): Promise<ArrayBuffer> {
    console.log('🔄 Using Web Speech API fallback')

    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        return new Promise((resolve) => {
          const utterance = new SpeechSynthesisUtterance(text)
          utterance.onend = () => {
            const emptyBuffer = new ArrayBuffer(0)
            resolve(emptyBuffer)
          }
          window.speechSynthesis.speak(utterance)
        })
      }
    } catch (error) {
      console.error('Fallback TTS failed:', error)
    }

    return new ArrayBuffer(0)
  }

  private fallbackTTSUrl(text: string): string {
    console.log('🔄 Using fallback TTS URL (empty)')
    return `data:audio/wav;base64,${btoa('RIFF')}`
  }

  async getAvailableVoices(): Promise<ElevenLabsVoice[]> {
    if (!this.apiKey) {
      return Object.values(this.voiceMap)
    }

    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      })

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.statusText}`)
      }

      const data = await response.json()
      return data.voices || Object.values(this.voiceMap)

    } catch (error) {
      console.error('❌ Failed to fetch voices:', error)
      return Object.values(this.voiceMap)
    }
  }

  getVoiceForLanguage(languageCode: SupportedLanguageCode): ElevenLabsVoice {
    return this.voiceMap[languageCode] || this.voiceMap.en
  }

  createAudioUrl(audioBuffer: ArrayBuffer): string {
    const blob = new Blob([audioBuffer], { type: 'audio/mpeg' })
    return URL.createObjectURL(blob)
  }

  async playAudio(audioBuffer: ArrayBuffer): Promise<void> {
    if (typeof window === 'undefined') return

    try {
      const audioUrl = this.createAudioUrl(audioBuffer)
      const audio = new Audio(audioUrl)

      return new Promise((resolve, reject) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl)
          resolve()
        }
        audio.onerror = (error) => {
          URL.revokeObjectURL(audioUrl)
          reject(error)
        }
        audio.play()
      })

    } catch (error) {
      console.error('❌ Audio playback failed:', error)
      throw error
    }
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

  async estimateAudioDuration(text: string, languageCode: SupportedLanguageCode = 'en'): Promise<number> {
    const wordsPerMinute = languageCode === 'en' ? 150 : 140
    const wordCount = text.split(' ').length
    const durationMinutes = wordCount / wordsPerMinute
    const durationMs = Math.max(2000, durationMinutes * 60 * 1000)

    console.log(`📊 Estimated audio duration: ${Math.round(durationMs)}ms for ${wordCount} words`)
    return durationMs
  }
}

export const ttsService = new TTSService()