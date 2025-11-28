/**
 * Training Session Type Definitions
 * Session data, transcript, and recording types
 */

import type { ConversationMessage } from '@/lib/elevenlabs-conversation';
import type { ScenarioKnowledgeContext } from '@/lib/elevenlabs-knowledge';

export type TrainingMode = 'theory' | 'service_practice' | 'recommendation_tts';

export type RecordingPreference = 'none' | 'audio' | 'audio_video';

export type SessionStatus = 'pending' | 'completed' | 'failed';

export type AvatarSessionStatus = 'active' | 'completed' | 'stopped' | 'error';

export type TranscriptSpeaker = 'avatar' | 'user';

export interface TranscriptEntry {
  speaker: TranscriptSpeaker;
  text: string;
  timestamp: string;
  duration_ms?: number;
}

export interface TrainingSession {
  id: string;
  employee_id: string;
  assignment_id: string;
  company_id: string;
  scenario_id?: string | null;
  session_name: string;
  training_mode: TrainingMode;
  language: string;
  agent_id: string;
  knowledge_context: ScenarioKnowledgeContext | null;
  conversation_transcript: ConversationMessage[];
  session_duration_seconds: number;
  started_at: string;
  ended_at: string;
  created_at: string;
  // Recording fields
  recording_preference: RecordingPreference;
  recording_consent_timestamp?: string | null;
  audio_recording_url?: string | null;
  video_recording_url?: string | null;
  audio_file_size?: number | null;
  video_file_size?: number | null;
  recording_duration_seconds?: number | null;
  // ElevenLabs integration
  elevenlabs_conversation_id?: string | null;
  // Assessment result caching
  theory_assessment_results?: any | null;
  assessment_completed_at?: string | null;
  assessment_status?: SessionStatus;
  // Service practice assessment caching
  service_practice_assessment_results?: any | null;
  service_assessment_completed_at?: string | null;
  service_assessment_status?: SessionStatus;
}

export interface CreateSessionData {
  employee_id: string;
  assignment_id: string;
  company_id: string;
  scenario_id?: string | null;
  training_mode: TrainingMode;
  language: string;
  agent_id: string;
  knowledge_context?: ScenarioKnowledgeContext | null;
  conversation_transcript: ConversationMessage[];
  started_at: Date;
  ended_at: Date;
  session_duration_seconds?: number;
  // Recording data
  recording_preference: RecordingPreference;
  recording_consent_timestamp?: Date | null;
  audio_recording_url?: string | null;
  video_recording_url?: string | null;
  audio_file_size?: number | null;
  video_file_size?: number | null;
  recording_duration_seconds?: number | null;
}

export interface SessionConfig {
  language: string;
  duration_minutes: number;
  knowledge_category_ids?: string[];
  knowledge_document_ids?: string[];
}

export interface SessionAnalytics {
  session_id: string;
  questions_answered: number;
  avg_response_time_ms: number;
  silence_periods: number;
  interruptions: number;
  clarity_score?: number;
  engagement_score?: number;
}

export interface AvatarSession {
  id: string;
  assignment_id: string;
  scenario_id: string;
  employee_id: string;
  language: string;
  started_at: string;
  ended_at?: string;
  duration_minutes: number;
  questions_asked: number;
  correct_answers: number;
  incorrect_answers: number;
  total_responses: number;
  transcript: TranscriptEntry[];
  video_url?: string;
  audio_url?: string;
  status: AvatarSessionStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateAvatarSessionData {
  assignment_id: string;
  scenario_id: string;
  employee_id: string;
  language: string;
}

export interface UpdateAvatarSessionData {
  ended_at?: string;
  duration_minutes?: number;
  questions_asked?: number;
  correct_answers?: number;
  incorrect_answers?: number;
  total_responses?: number;
  transcript?: TranscriptEntry[];
  video_url?: string;
  audio_url?: string;
  status?: AvatarSessionStatus;
}
