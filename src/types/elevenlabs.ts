/**
 * ElevenLabs Type Definitions
 * Voice configuration, TTS, and conversational AI types
 */

export interface ElevenLabsVoice {
  id: string;
  name: string;
  description?: string;
  voice_id?: string; // For compatibility with avatar-types
  language?: string;
  gender?: 'male' | 'female' | 'neutral';
  age?: 'young' | 'middle_aged' | 'old';
  accent?: string;
  use_case?: string;
  preview_url?: string;
}

export interface ElevenLabsVoiceConfig {
  voiceId: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export interface ConversationState {
  service: any | null;
  isInitialized: boolean;
  isActive: boolean;
  isConnected: boolean;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  agentSpeaking: boolean;
  listening: boolean;
  currentMessage: string;
  history: any[];
}

export interface GeneratedQuestion {
  id: string;
  text: string;
  category?: string;
  expected_topics?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

export interface SpeechToTextResponse {
  text: string;
  confidence: number;
  language?: string;
  duration_ms: number;
}

export interface TextToSpeechRequest {
  text: string;
  language: string;
  voice_id?: string;
}

export interface VoiceActivityEvent {
  type: 'start' | 'end' | 'silence';
  timestamp: number;
  confidence?: number;
}

export interface ElevenLabsConfig {
  apiKey: string;
  agentId: string;
  voiceSettings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
}

export interface ConversationConfig {
  agent_id: string;
  requires_auth: boolean;
  client_events?: string[];
  server_events?: string[];
}

export interface ConversationDynamicVariables {
  [key: string]: string | number | boolean;
}
