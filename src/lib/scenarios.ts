import { supabaseAdmin } from './supabase';

export type ScenarioType = 'theory' | 'service_practice' | 'recommendations';
export type ScenarioTemplate = 'upset_customer' | 'upselling' | 'general_flow' | 'conflict_resolution' | 'recommendations_flow';

export interface ScenarioTemplateConfig {
  id: ScenarioTemplate;
  name: string;
  description: string;
  defaultClientBehavior: string;
  defaultExpectedResponse: string;
  applicableTypes: ScenarioType[];
}

export const SCENARIO_TEMPLATES: ScenarioTemplateConfig[] = [
  {
    id: 'upset_customer',
    name: 'Upset Customer',
    description: 'Customer service scenario dealing with frustrated or angry customers',
    defaultClientBehavior: 'The customer is visibly upset about a product/service issue. They may be raising their voice, expressing frustration, or making demands for immediate resolution.',
    defaultExpectedResponse: 'Remain calm and empathetic. Acknowledge the customer\'s frustration, actively listen to their concerns, apologize for the inconvenience, and work collaboratively to find a solution.',
    applicableTypes: ['service_practice']
  },
  {
    id: 'upselling',
    name: 'Upselling Opportunity',
    description: 'Sales scenario focused on identifying and presenting additional value to customers',
    defaultClientBehavior: 'Customer shows interest in a basic product/service but may benefit from premium features or complementary offerings. They ask questions about capabilities or mention specific needs.',
    defaultExpectedResponse: 'Listen for customer needs and pain points. Present relevant premium features or complementary products that address their specific requirements. Focus on value and benefits rather than just features.',
    applicableTypes: ['service_practice']
  },
  {
    id: 'general_flow',
    name: 'General Service Flow',
    description: 'Standard customer interaction following typical service procedures',
    defaultClientBehavior: 'Customer approaches with a standard request or inquiry. They are cooperative and seeking assistance with a routine matter.',
    defaultExpectedResponse: 'Follow established service procedures. Greet the customer professionally, identify their needs, provide accurate information or assistance, and ensure customer satisfaction before concluding the interaction.',
    applicableTypes: ['service_practice', 'theory']
  },
  {
    id: 'conflict_resolution',
    name: 'Conflict Resolution',
    description: 'Scenario involving disputes, disagreements, or complex problem-solving situations',
    defaultClientBehavior: 'Customer presents a complex issue involving multiple parties, conflicting information, or disputes about policies, billing, or service delivery.',
    defaultExpectedResponse: 'Remain neutral and professional. Gather all relevant information from all parties. Apply critical thinking to understand the root cause. Present fair solutions based on company policies while maintaining positive relationships.',
    applicableTypes: ['service_practice', 'theory']
  },
  {
    id: 'recommendations_flow',
    name: 'Product Recommendations',
    description: 'Video response training for providing product recommendations to customers',
    defaultClientBehavior: '',
    defaultExpectedResponse: '',
    applicableTypes: ['recommendations']
  }
];

export interface Track {
  id: string;
  company_id: string;
  name: string;
  description: string;
  target_audience: 'new_hire' | 'existing_employee';
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimated_duration_minutes: number;
  session_time_limit_minutes?: number;
  milestones: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Knowledge base associations for product knowledge scenarios
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
  customer_emotion_level?: 'calm' | 'frustrated' | 'angry' | 'extremely_angry';
  // Voice selection for ElevenLabs TTS
  voice_id?: string | 'random'; // Specific voice ID or 'random' for random selection
}

export interface CreateTrackData {
  company_id: string;
  name: string;
  description: string;
  target_audience: 'new_hire' | 'existing_employee';
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
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  estimated_duration_minutes?: number;
  session_time_limit_minutes?: number;
  milestones?: string[];
  knowledge_category_ids?: string[];
  knowledge_document_ids?: string[];
  topic_ids?: string[];
  recommendation_question_ids?: string[];
  recommendation_question_durations?: { [questionId: string]: number };
  instructions?: string;
  customer_emotion_level?: 'calm' | 'frustrated' | 'angry' | 'extremely_angry';
  voice_id?: string | 'random';
}

export interface UpdateScenarioData {
  track_id?: string;
  title?: string;
  description?: string;
  client_behavior?: string;
  expected_response?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  estimated_duration_minutes?: number;
  session_time_limit_minutes?: number;
  milestones?: string[];
  topic_ids?: string[];
  recommendation_question_ids?: string[];
  recommendation_question_durations?: { [questionId: string]: number };
  instructions?: string;
  customer_emotion_level?: 'calm' | 'frustrated' | 'angry' | 'extremely_angry';
  voice_id?: string | 'random';
}

class ScenarioService {
  /**
   * Create a new track
   */
  async createTrack(data: CreateTrackData): Promise<Track> {
    const { data: track, error } = await supabaseAdmin
      .from('tracks')
      .insert({
        company_id: data.company_id,
        name: data.name,
        description: data.description,
        target_audience: data.target_audience,
        is_active: true,
        avatar_mode: true
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return track;
  }

  /**
   * Create a new scenario
   */
  async createScenario(data: CreateScenarioData): Promise<Scenario> {
    // Provide defaults for theory scenarios
    let scenarioData = data;
    if (data.scenario_type === 'theory') {
      scenarioData = {
        ...data,
        title: data.title || 'Theory Q&A',
        description: data.description || 'Knowledge-based Q&A session',
        template_type: 'general_flow',
        client_behavior: data.client_behavior || 'N/A - Theory based',
        expected_response: data.expected_response || 'N/A - Theory based',
        milestones: []
      };
    }

    // Provide defaults for recommendations scenarios
    if (data.scenario_type === 'recommendations') {
      scenarioData = {
        ...data,
        description: data.description || 'Video response training for product recommendations',
        template_type: 'recommendations_flow',
        client_behavior: data.client_behavior || 'N/A - Recommendations based',
        expected_response: data.expected_response || 'N/A - Recommendations based',
        milestones: []
      };
    }

    // Prepare data for database insert (only using columns that exist)
    const insertData = {
      track_id: scenarioData.track_id,
      company_id: scenarioData.company_id,
      title: scenarioData.title,
      description: scenarioData.description,
      scenario_type: scenarioData.scenario_type,
      template_type: scenarioData.template_type,
      client_behavior: scenarioData.client_behavior,
      expected_response: scenarioData.expected_response,
      difficulty: scenarioData.difficulty || 'beginner',
      estimated_duration_minutes: scenarioData.estimated_duration_minutes || 30,
      session_time_limit_minutes: scenarioData.session_time_limit_minutes || 10,
      milestones: scenarioData.milestones || [],
      topic_ids: scenarioData.topic_ids || [],
      recommendation_question_ids: scenarioData.recommendation_question_ids || [],
      recommendation_question_durations: scenarioData.recommendation_question_durations || {},
      instructions: scenarioData.instructions,
      customer_emotion_level: scenarioData.customer_emotion_level || 'calm',
      voice_id: scenarioData.voice_id || 'random',
      is_active: true,
      knowledge_category_ids: scenarioData.knowledge_category_ids || [],
      knowledge_document_ids: scenarioData.knowledge_document_ids || [],
      avatar_mode: false,
      language: 'en'
    };

    const { data: scenario, error } = await supabaseAdmin
      .from('scenarios')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Add topic_ids to the returned scenario for consistency with interface
    return {
      ...scenario,
      topic_ids: scenarioData.topic_ids || []
    };
  }

  /**
   * Get tracks for a company
   */
  async getTracks(companyId: string): Promise<Track[]> {
    const { data: tracks, error } = await supabaseAdmin
      .from('tracks')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return tracks || [];
  }

  /**
   * Get scenarios for a track
   */
  async getScenariosByTrack(trackId: string): Promise<Scenario[]> {
    const { data: scenarios, error } = await supabaseAdmin
      .from('scenarios')
      .select('*')
      .eq('track_id', trackId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (scenarios || []).map(scenario => ({
      ...scenario,
      topic_ids: scenario.topic_ids || []
    }));
  }

  /**
   * Get all scenarios for a company
   */
  async getScenarios(companyId: string): Promise<Scenario[]> {
    const { data: scenarios, error } = await supabaseAdmin
      .from('scenarios')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (scenarios || []).map(scenario => ({
      ...scenario,
      topic_ids: scenario.topic_ids || []
    }));
  }

  /**
   * Get a single scenario by ID
   */
  async getScenario(scenarioId: string): Promise<Scenario | null> {
    const { data: scenario, error } = await supabaseAdmin
      .from('scenarios')
      .select('*')
      .eq('id', scenarioId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Scenario not found
      }
      console.error('Error fetching scenario:', error);
      throw new Error('Failed to fetch scenario');
    }

    return {
      ...scenario,
      topic_ids: scenario.topic_ids || []
    };
  }

  /**
   * Update a scenario
   */
  async updateScenario(scenarioId: string, updates: UpdateScenarioData): Promise<Scenario> {
    // Filter out fields that don't exist in database schema - only use existing columns
    const updateData = {
      track_id: updates.track_id,
      title: updates.title,
      description: updates.description,
      client_behavior: updates.client_behavior,
      expected_response: updates.expected_response,
      difficulty: updates.difficulty,
      estimated_duration_minutes: updates.estimated_duration_minutes,
      session_time_limit_minutes: updates.session_time_limit_minutes,
      milestones: updates.milestones || [],
      topic_ids: updates.topic_ids || [],
      recommendation_question_ids: updates.recommendation_question_ids,
      recommendation_question_durations: updates.recommendation_question_durations || {},
      instructions: updates.instructions,
      customer_emotion_level: updates.customer_emotion_level,
      voice_id: updates.voice_id,
      updated_at: new Date().toISOString()
    };

    const { data: scenario, error } = await supabaseAdmin
      .from('scenarios')
      .update(updateData)
      .eq('id', scenarioId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      ...scenario,
      topic_ids: updates.topic_ids || []
    };
  }

  /**
   * Delete a scenario
   */
  async deleteScenario(scenarioId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('scenarios')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', scenarioId);

    if (error) {
      throw error;
    }
  }

  /**
   * Get translation status for a scenario
   */
  getTranslationStatus(scenario: Scenario): { isTranslated: boolean; missingFields: string[] } {
    const requiredFields = ['title', 'description'];
    const missingFields = requiredFields.filter(field =>
      !scenario[field as keyof Scenario] || (scenario[field as keyof Scenario] as string).trim() === ''
    );

    return {
      isTranslated: missingFields.length === 0,
      missingFields
    };
  }

  /**
   * Get available templates for a scenario type
   */
  getScenarioTemplates(scenarioType: ScenarioType) {
    return SCENARIO_TEMPLATES.filter(template =>
      template.applicableTypes.includes(scenarioType)
    );
  }
}

export const scenarioService = new ScenarioService();