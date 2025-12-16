/**
 * Scenario and Track Type Definitions
 * Centralized types for training scenarios and tracks
 */

export type ScenarioType = 'theory' | 'service_practice' | 'recommendations' | 'flipboard';

export type ScenarioTemplate =
  | 'upset_customer'
  | 'upselling'
  | 'general_flow'
  | 'conflict_resolution'
  | 'recommendations_flow';

export type ScenarioDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type CustomerEmotionLevel =
  | 'normal'
  | 'cold'
  | 'in_a_hurry'
  | 'angry'
  | 'extremely_angry';

export interface ScenarioTemplateConfig {
  id: ScenarioTemplate;
  name: string;
  description: string;
  defaultClientBehavior: string;
  defaultExpectedResponse: string;
  applicableTypes: ScenarioType[];
}

export interface Scenario {
  id: string;
  track_id: string;
  company_id: string;
  title: string;
  description: string;
  scenario_type: ScenarioType;
  template_type: ScenarioTemplate;
  client_behavior: string;
  expected_response: string;
  difficulty: ScenarioDifficulty;
  estimated_duration_minutes: number;
  session_time_limit_minutes?: number;
  milestones: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Knowledge base associations
  knowledge_category_ids?: string[];
  knowledge_document_ids?: string[];
  // Topic associations for theory scenarios
  topic_ids?: string[];
  // Recommendations scenario support
  recommendation_question_ids?: string[];
  recommendation_question_durations?: { [questionId: string]: number };
  instructions?: string;
  // Avatar mode support
  avatar_mode?: boolean;
  language?: string;
  // Customer emotion level for service practice scenarios
  customer_emotion_level?: CustomerEmotionLevel;
  // Voice selection for ElevenLabs TTS (multi-select support)
  voice_ids?: string[];
  // Legacy support for single voice (deprecated)
  voice_id?: string | 'random';
  // Custom first message for Service Practice scenarios
  first_message?: string | null;
  // Employee role for Flipboard scenarios
  employee_role?: string;
}

export interface CreateScenarioData {
  track_id: string;
  company_id: string;
  title: string;
  description: string;
  scenario_type: ScenarioType;
  template_type?: ScenarioTemplate;
  client_behavior?: string;
  expected_response?: string;
  difficulty?: ScenarioDifficulty;
  estimated_duration_minutes?: number;
  session_time_limit_minutes?: number;
  milestones?: string[];
  knowledge_category_ids?: string[];
  knowledge_document_ids?: string[];
  topic_ids?: string[];
  recommendation_question_ids?: string[];
  recommendation_question_durations?: { [questionId: string]: number };
  instructions?: string;
  customer_emotion_level?: CustomerEmotionLevel;
  voice_ids?: string[];
  voice_id?: string | 'random';
  first_message?: string;
  employee_role?: string;
}

export interface UpdateScenarioData {
  track_id?: string;
  title?: string;
  description?: string;
  client_behavior?: string;
  expected_response?: string;
  difficulty?: ScenarioDifficulty;
  estimated_duration_minutes?: number;
  session_time_limit_minutes?: number;
  milestones?: string[];
  knowledge_category_ids?: string[];
  knowledge_document_ids?: string[];
  topic_ids?: string[];
  recommendation_question_ids?: string[];
  recommendation_question_durations?: { [questionId: string]: number };
  instructions?: string;
  customer_emotion_level?: CustomerEmotionLevel;
  voice_ids?: string[];
  voice_id?: string | 'random';
  first_message?: string;
  employee_role?: string;
}
