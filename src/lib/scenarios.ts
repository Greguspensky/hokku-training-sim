import { supabase } from './supabase';

// Global demo storage that persists across hot reloads
declare global {
  var __demoScenariosStore: Scenario[] | undefined;
  var __demoTracksStore: Track[] | undefined;
}

// Demo scenario store for testing - use global to persist across hot reloads
const demoScenarios: Scenario[] = globalThis.__demoScenariosStore || [];
const demoTracks: Track[] = globalThis.__demoTracksStore || [];

// Store references globally
globalThis.__demoScenariosStore = demoScenarios;
globalThis.__demoTracksStore = demoTracks;

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
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
}

export interface UpdateScenarioData {
  title?: string;
  description?: string;
  client_behavior?: string;
  expected_response?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  estimated_duration_minutes?: number;
  is_active?: boolean;
}

class ScenarioService {
  /**
   * Create a new track
   */
  async createTrack(data: CreateTrackData): Promise<Track> {
    const {
      company_id,
      name,
      description,
      target_audience
    } = data;

    try {
      const { data: track, error } = await supabase
        .from('tracks')
        .insert([
          {
            company_id,
            name,
            description,
            target_audience,
            is_active: true
          }
        ])
        .select()
        .single();

      if (error) {
        throw error;
      }

      return track;
    } catch (error: any) {
      console.log('🚧 Demo mode: Creating mock track for testing (Error:', error.message, ')');
      const demoTrack = {
        id: `demo-track-${Date.now()}`,
        company_id,
        name,
        description,
        target_audience,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as Track;
      
      demoTracks.push(demoTrack);
      return demoTrack;
    }
  }

  /**
   * Create a new scenario
   */
  async createScenario(data: CreateScenarioData): Promise<Scenario> {
    const {
      track_id,
      company_id,
      title,
      description,
      scenario_type,
      template_type,
      client_behavior,
      expected_response,
      difficulty = 'beginner',
      estimated_duration_minutes = 30
    } = data;

    // Provide defaults for theory scenarios
    let scenarioData = data;
    if (scenario_type === 'theory') {
      scenarioData = {
        ...data,
        title: title || 'Theory Q&A',
        description: description || 'Knowledge-based Q&A session',
        template_type: 'general_flow', // Default template for theory
        client_behavior: client_behavior || 'N/A - Theory based',
        expected_response: expected_response || 'N/A - Theory based'
      };
    }

    try {
      const { data: scenario, error } = await supabase
        .from('scenarios')
        .insert([
          {
            track_id: scenarioData.track_id,
            company_id: scenarioData.company_id,
            title: scenarioData.title,
            description: scenarioData.description,
            scenario_type: scenarioData.scenario_type,
            template_type: scenarioData.template_type,
            client_behavior: scenarioData.client_behavior,
            expected_response: scenarioData.expected_response,
            difficulty: scenarioData.difficulty,
            estimated_duration_minutes: scenarioData.estimated_duration_minutes,
            is_active: true
          }
        ])
        .select()
        .single();

      if (error) {
        throw error;
      }

      return scenario;
    } catch (error: any) {
      console.log('🚧 Demo mode: Creating mock scenario for testing (Error:', error.message, ')');
      const demoScenario = {
        id: `demo-${Date.now()}`,
        track_id: scenarioData.track_id,
        company_id: scenarioData.company_id,
        title: scenarioData.title,
        description: scenarioData.description,
        scenario_type: scenarioData.scenario_type,
        template_type: scenarioData.template_type,
        client_behavior: scenarioData.client_behavior,
        expected_response: scenarioData.expected_response,
        difficulty: scenarioData.difficulty,
        estimated_duration_minutes: scenarioData.estimated_duration_minutes,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as Scenario;
      
      demoScenarios.push(demoScenario);
      return demoScenario;
    }
  }

  /**
   * Get tracks for a company
   */
  async getTracks(companyId: string): Promise<Track[]> {
    try {
      const { data: tracks, error } = await supabase
        .from('tracks')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch tracks: ${error.message}`);
      }

      const dbTracks = tracks || [];
      const companyDemoTracks = demoTracks.filter(t => t.company_id === companyId);
      
      const allTracks = [...dbTracks, ...companyDemoTracks]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      return allTracks;
    } catch (error) {
      return demoTracks.filter(t => t.company_id === companyId);
    }
  }

  /**
   * Get scenarios for a track
   */
  async getScenariosByTrack(trackId: string): Promise<Scenario[]> {
    try {
      const { data: scenarios, error } = await supabase
        .from('scenarios')
        .select('*')
        .eq('track_id', trackId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch scenarios: ${error.message}`);
      }

      const dbScenarios = scenarios || [];
      const trackDemoScenarios = demoScenarios.filter(s => s.track_id === trackId);
      
      const allScenarios = [...dbScenarios, ...trackDemoScenarios]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      return allScenarios;
    } catch (error) {
      return demoScenarios.filter(s => s.track_id === trackId);
    }
  }

  /**
   * Get all scenarios for a company
   */
  async getScenarios(companyId: string): Promise<Scenario[]> {
    try {
      const { data: scenarios, error } = await supabase
        .from('scenarios')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch scenarios: ${error.message}`);
      }

      const dbScenarios = scenarios || [];
      const companyDemoScenarios = demoScenarios.filter(s => s.company_id === companyId);
      
      const allScenarios = [...dbScenarios, ...companyDemoScenarios]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      return allScenarios;
    } catch (error) {
      return demoScenarios.filter(s => s.company_id === companyId);
    }
  }

  /**
   * Get a single track by ID
   */
  async getTrack(trackId: string): Promise<Track | null> {
    if (trackId.startsWith('demo-track-')) {
      const demoTrack = demoTracks.find(t => t.id === trackId);
      if (demoTrack) {
        return demoTrack;
      }
    }

    try {
      const { data: track, error } = await supabase
        .from('tracks')
        .select('*')
        .eq('id', trackId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new Error(`Failed to fetch track: ${error.message}`);
      }

      return track;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get a single scenario by ID
   */
  async getScenario(scenarioId: string): Promise<Scenario | null> {
    if (scenarioId.startsWith('demo-')) {
      const demoScenario = demoScenarios.find(s => s.id === scenarioId);
      if (demoScenario) {
        return demoScenario;
      }
    }

    try {
      const { data: scenario, error } = await supabase
        .from('scenarios')
        .select('*')
        .eq('id', scenarioId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new Error(`Failed to fetch scenario: ${error.message}`);
      }

      return scenario;
    } catch (error) {
      return null;
    }
  }

  /**
   * Update a scenario
   */
  async updateScenario(scenarioId: string, updates: UpdateScenarioData): Promise<Scenario> {
    if (scenarioId.startsWith('demo-')) {
      console.log('🔍 Looking for demo scenario ID:', scenarioId);
      console.log('🔍 Available demo scenarios:', demoScenarios.map(s => ({ id: s.id, title: s.title })));
      
      const demoIndex = demoScenarios.findIndex(s => s.id === scenarioId);
      if (demoIndex >= 0) {
        console.log('✅ Found demo scenario at index:', demoIndex);
        demoScenarios[demoIndex] = {
          ...demoScenarios[demoIndex],
          ...updates,
          updated_at: new Date().toISOString()
        };
        return demoScenarios[demoIndex];
      }
      console.log('❌ Demo scenario not found in array');
      throw new Error('Demo scenario not found');
    }

    const { data: scenario, error } = await supabase
      .from('scenarios')
      .update(updates)
      .eq('id', scenarioId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update scenario: ${error.message}`);
    }

    return scenario;
  }

  /**
   * Delete a scenario (soft delete)
   */
  async deleteScenario(scenarioId: string): Promise<void> {
    if (scenarioId.startsWith('demo-')) {
      const demoIndex = demoScenarios.findIndex(s => s.id === scenarioId);
      if (demoIndex >= 0) {
        demoScenarios[demoIndex].is_active = false;
      }
      return;
    }

    const { error } = await supabase
      .from('scenarios')
      .update({ is_active: false })
      .eq('id', scenarioId);

    if (error) {
      throw new Error(`Failed to delete scenario: ${error.message}`);
    }
  }

  /**
   * Delete a track (soft delete)
   */
  async deleteTrack(trackId: string): Promise<void> {
    if (trackId.startsWith('demo-track-')) {
      const demoIndex = demoTracks.findIndex(t => t.id === trackId);
      if (demoIndex >= 0) {
        demoTracks[demoIndex].is_active = false;
      }
      return;
    }

    const { error } = await supabase
      .from('tracks')
      .update({ is_active: false })
      .eq('id', trackId);

    if (error) {
      throw new Error(`Failed to delete track: ${error.message}`);
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