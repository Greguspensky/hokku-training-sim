import { supabaseAdmin } from './supabase';

export type ScenarioType = 'theory' | 'service_practice';
export type ScenarioTemplate = 'upset_customer' | 'upselling' | 'general_flow' | 'conflict_resolution';

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
  milestones: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Knowledge base associations for product knowledge scenarios
  knowledge_category_ids?: string[];
  knowledge_document_ids?: string[];
  // Avatar mode support
  avatar_mode?: boolean;
  language?: string;
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
  template_type: ScenarioTemplate;
  client_behavior: string;
  expected_response: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  estimated_duration_minutes?: number;
  milestones?: string[];
  // Knowledge base associations for product knowledge scenarios
  knowledge_category_ids?: string[];
  knowledge_document_ids?: string[];
}

export interface UpdateScenarioData {
  title?: string;
  description?: string;
  client_behavior?: string;
  expected_response?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  estimated_duration_minutes?: number;
  milestones?: string[];
  is_active?: boolean;
  // Knowledge base associations for product knowledge scenarios
  knowledge_category_ids?: string[];
  knowledge_document_ids?: string[];
}

// Force recompilation - updated with demo mode support
class ScenarioService {
  /**
   * Create a new track
   */
  async createTrack(data: CreateTrackData): Promise<Track> {
    try {
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
    } catch (error: any) {
      console.error('Error creating track in database:', error);
      console.log('🚧 Falling back to demo mode for track creation');

      // Create demo track in memory
      const demoTrack: Track = {
        id: crypto.randomUUID(),
        company_id: data.company_id,
        name: data.name,
        description: data.description,
        target_audience: data.target_audience,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Store in demo storage if available
      if (typeof globalThis !== 'undefined') {
        if (!globalThis.__demoTracksStore) {
          globalThis.__demoTracksStore = [];
        }
        globalThis.__demoTracksStore.push(demoTrack);
      }

      console.log('✅ Created demo track:', demoTrack.name);
      return demoTrack;
    }
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

    try {
      console.log('🔧 Creating scenario with demo mode fallback...');
      const { data: scenario, error } = await supabaseAdmin
        .from('scenarios')
        .insert({
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
          milestones: scenarioData.milestones || [],
          is_active: true,
          knowledge_category_ids: scenarioData.knowledge_category_ids || null,
          knowledge_document_ids: scenarioData.knowledge_document_ids || null
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return scenario;
    } catch (error: any) {
      console.error('Error creating scenario in database:', error);
      console.log('🚧 Falling back to demo mode for scenario creation');

      // Create demo scenario in memory
      const demoScenario: Scenario = {
        id: crypto.randomUUID(),
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
        milestones: scenarioData.milestones || [],
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        knowledge_category_ids: scenarioData.knowledge_category_ids || [],
        knowledge_document_ids: scenarioData.knowledge_document_ids || []
      };

      // Store in demo storage if available
      if (typeof globalThis !== 'undefined') {
        if (!globalThis.__demoScenariosStore) {
          globalThis.__demoScenariosStore = [];
        }
        globalThis.__demoScenariosStore.push(demoScenario);
      }

      console.log('✅ Created demo scenario:', demoScenario.title);
      return demoScenario;
    }
  }

  /**
   * Get tracks for a company
   */
  async getTracks(companyId: string): Promise<Track[]> {
    try {
      const { data: tracks, error } = await supabaseAdmin
        .from('tracks')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Include demo tracks if available
      const demoTracks = (typeof globalThis !== 'undefined' && globalThis.__demoTracksStore) ?
        globalThis.__demoTracksStore.filter((track: Track) => track.company_id === companyId && track.is_active) :
        [];

      return [...(tracks || []), ...demoTracks];
    } catch (error: any) {
      console.error('Error fetching tracks from database:', error);
      console.log('🚧 Falling back to demo mode for track fetching');

      // Return only demo tracks
      const demoTracks = (typeof globalThis !== 'undefined' && globalThis.__demoTracksStore) ?
        globalThis.__demoTracksStore.filter((track: Track) => track.company_id === companyId && track.is_active) :
        [];

      return demoTracks;
    }
  }

  /**
   * Get scenarios for a track
   */
  async getScenariosByTrack(trackId: string): Promise<Scenario[]> {
    try {
      const { data: scenarios, error } = await supabaseAdmin
        .from('scenarios')
        .select('*')
        .eq('track_id', trackId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Include demo scenarios if available
      const demoScenarios = (typeof globalThis !== 'undefined' && globalThis.__demoScenariosStore) ?
        globalThis.__demoScenariosStore.filter((scenario: Scenario) =>
          scenario.track_id === trackId && scenario.is_active) :
        [];

      return [...(scenarios || []), ...demoScenarios];
    } catch (error: any) {
      console.error('Error fetching scenarios from database:', error);
      console.log('🚧 Falling back to demo mode for scenario fetching');

      // Return only demo scenarios
      const demoScenarios = (typeof globalThis !== 'undefined' && globalThis.__demoScenariosStore) ?
        globalThis.__demoScenariosStore.filter((scenario: Scenario) =>
          scenario.track_id === trackId && scenario.is_active) :
        [];

      return demoScenarios;
    }
  }

  /**
   * Get all scenarios for a company
   */
  async getScenarios(companyId: string): Promise<Scenario[]> {
    try {
      const { data: scenarios, error } = await supabaseAdmin
        .from('scenarios')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Include demo scenarios if available
      const demoScenarios = (typeof globalThis !== 'undefined' && globalThis.__demoScenariosStore) ?
        globalThis.__demoScenariosStore.filter((scenario: Scenario) =>
          scenario.company_id === companyId && scenario.is_active) :
        [];

      return [...(scenarios || []), ...demoScenarios];
    } catch (error: any) {
      console.error('Error fetching scenarios from database:', error);
      console.log('🚧 Falling back to demo mode for scenario fetching');

      // Return only demo scenarios
      const demoScenarios = (typeof globalThis !== 'undefined' && globalThis.__demoScenariosStore) ?
        globalThis.__demoScenariosStore.filter((scenario: Scenario) =>
          scenario.company_id === companyId && scenario.is_active) :
        [];

      return demoScenarios;
    }
  }

  /**
   * Get a single track by ID
   */
  async getTrack(trackId: string): Promise<Track | null> {
    const { data: track, error } = await supabaseAdmin
      .from('tracks')
      .select('*')
      .eq('id', trackId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching track:', error);
      throw new Error('Failed to fetch track');
    }

    return track;
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
      if (error.code === '22P02') {
        // Invalid UUID format - likely a demo scenario ID
        console.log('⚠️ Invalid UUID format for scenario ID, assuming demo scenario:', scenarioId);
        return null;
      }
      console.error('Error fetching scenario:', error);
      throw new Error('Failed to fetch scenario');
    }

    return scenario;
  }

  /**
   * Update a scenario
   */
  async updateScenario(scenarioId: string, updates: UpdateScenarioData): Promise<Scenario> {
    const { data: scenario, error } = await supabaseAdmin
      .from('scenarios')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', scenarioId)
      .select()
      .single();

    if (error) {
      console.error('Error updating scenario:', error);
      throw new Error('Failed to update scenario');
    }

    return scenario;
  }

  /**
   * Delete a scenario (soft delete)
   */
  async deleteScenario(scenarioId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('scenarios')
      .update({ is_active: false })
      .eq('id', scenarioId);

    if (error) {
      console.error('Error deleting scenario:', error);
      throw new Error('Failed to delete scenario');
    }
  }

  /**
   * Delete a track (soft delete)
   */
  async deleteTrack(trackId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('tracks')
      .update({ is_active: false })
      .eq('id', trackId);

    if (error) {
      console.error('Error deleting track:', error);
      throw new Error('Failed to delete track');
    }
  }

  /**
   * Get available scenario templates
   */
  getScenarioTemplates(scenarioType?: ScenarioType): ScenarioTemplateConfig[] {
    if (scenarioType) {
      return SCENARIO_TEMPLATES.filter(template => 
        template.applicableTypes.includes(scenarioType)
      );
    }
    return SCENARIO_TEMPLATES;
  }

  /**
   * Get scenario template by ID
   */
  getScenarioTemplate(templateId: ScenarioTemplate): ScenarioTemplateConfig | null {
    return SCENARIO_TEMPLATES.find(template => template.id === templateId) || null;
  }

  /**
   * Create scenario from template
   */
  createScenarioFromTemplate(
    templateId: ScenarioTemplate,
    trackId: string,
    companyId: string,
    customizations: {
      title?: string;
      description?: string;
      clientBehavior?: string;
      expectedResponse?: string;
      difficulty?: 'beginner' | 'intermediate' | 'advanced';
      estimatedDuration?: number;
    } = {}
  ): CreateScenarioData {
    const template = this.getScenarioTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    return {
      track_id: trackId,
      company_id: companyId,
      title: customizations.title || template.name,
      description: customizations.description || template.description,
      scenario_type: template.applicableTypes[0], // Default to first applicable type
      template_type: templateId,
      client_behavior: customizations.clientBehavior || template.defaultClientBehavior,
      expected_response: customizations.expectedResponse || template.defaultExpectedResponse,
      difficulty: customizations.difficulty,
      estimated_duration_minutes: customizations.estimatedDuration
    };
  }
}

// Export singleton instance
export const scenarioService = new ScenarioService();

// Export template utilities
export { SCENARIO_TEMPLATES };