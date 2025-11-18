// Avatar session types and interfaces

export type AvatarSessionStatus = 'active' | 'completed' | 'stopped' | 'error'
export type TranscriptSpeaker = 'avatar' | 'user'

export interface TranscriptEntry {
  speaker: TranscriptSpeaker
  text: string
  timestamp: string
  duration_ms?: number
}

export interface AvatarSession {
  id: string
  assignment_id: string
  scenario_id: string
  employee_id: string
  language: string
  started_at: string
  ended_at?: string
  duration_minutes: number
  questions_asked: number
  correct_answers: number
  incorrect_answers: number
  total_responses: number
  transcript: TranscriptEntry[]
  video_url?: string
  audio_url?: string
  status: AvatarSessionStatus
  created_at: string
  updated_at: string
}

export interface CreateAvatarSessionData {
  assignment_id: string
  scenario_id: string
  employee_id: string
  language: string
}

export interface UpdateAvatarSessionData {
  ended_at?: string
  duration_minutes?: number
  questions_asked?: number
  correct_answers?: number
  incorrect_answers?: number
  total_responses?: number
  transcript?: TranscriptEntry[]
  video_url?: string
  audio_url?: string
  status?: AvatarSessionStatus
}

export interface GeneratedQuestion {
  id: string
  text: string
  category?: string
  expected_topics?: string[]
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
}

export interface SessionConfig {
  language: string
  duration_minutes: number
  knowledge_category_ids?: string[]
  knowledge_document_ids?: string[]
}

export interface SpeechToTextResponse {
  text: string
  confidence: number
  language?: string
  duration_ms: number
}

export interface TextToSpeechRequest {
  text: string
  language: string
  voice_id?: string
}

export interface VoiceActivityEvent {
  type: 'start' | 'end' | 'silence'
  timestamp: number
  confidence?: number
}

export interface SessionAnalytics {
  session_id: string
  questions_answered: number
  avg_response_time_ms: number
  silence_periods: number
  interruptions: number
  clarity_score?: number
  engagement_score?: number
}

// ElevenLabs API types
export interface ElevenLabsVoice {
  voice_id: string
  name: string
  language: string
  gender: 'male' | 'female'
  accent?: string
}

export interface ElevenLabsResponse {
  audio_base64?: string
  audio_url?: string
  characters: number
  request_id: string
}

// Whisper API types
export interface WhisperResponse {
  text: string
  language: string
  duration: number
  segments?: {
    start: number
    end: number
    text: string
  }[]
}

// Language support
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ka', name: 'Georgian', flag: '🇬🇪' },
  { code: 'cs', name: 'Czech', flag: '🇨🇿' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' }
] as const

export type SupportedLanguageCode = typeof SUPPORTED_LANGUAGES[number]['code']