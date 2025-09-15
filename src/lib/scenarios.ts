import { supabase } from './supabase';
import { translationService, type LanguageCode, type MultilingualText } from './translation';

export interface Scenario {
  id: string;
  company_id: string;
  title: MultilingualText;
  description: MultilingualText;
  industry: string | null;
  difficulty: string;
  estimated_duration_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateScenarioData {
  company_id: string;
  title: string;
  description: string;
  industry?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  estimated_duration_minutes?: number;
  source_language?: LanguageCode;
  auto_translate?: boolean;
}

export interface UpdateScenarioData {
  title?: MultilingualText;
  description?: MultilingualText;
  industry?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  estimated_duration_minutes?: number;
  is_active?: boolean;
}

class ScenarioService {
  /**
   * Create a new scenario with optional auto-translation
   */
  async createScenario(data: CreateScenarioData): Promise<Scenario> {
    const {
      company_id,
      title,
      description,
      industry = null,
      difficulty = 'beginner',
      estimated_duration_minutes = 30,
      source_language = 'en',
      auto_translate = true
    } = data;

    let titleMultilingual: MultilingualText = { [source_language]: title };
    let descriptionMultilingual: MultilingualText = { [source_language]: description };

    // Auto-translate if enabled
    if (auto_translate) {
      try {
        console.log('🌍 Auto-translating scenario...');
        
        const [translatedTitle, translatedDescription] = await Promise.all([
          translationService.translateToAllLanguages(title, source_language, 'training scenario title'),
          translationService.translateToAllLanguages(description, source_language, 'training scenario description')
        ]);

        titleMultilingual = translatedTitle;
        descriptionMultilingual = translatedDescription;
        
        console.log('✅ Auto-translation completed successfully');
      } catch (error) {
        console.error('⚠️ Auto-translation failed:', error);
        // Continue with original language only if translation fails
      }
    }

    const { data: scenario, error } = await supabase
      .from('scenarios')
      .insert([
        {
          company_id,
          title: titleMultilingual,
          description: descriptionMultilingual,
          industry,
          difficulty,
          estimated_duration_minutes,
          is_active: true
        }
      ])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create scenario: ${error.message}`);
    }

    return scenario;
  }

  /**
   * Get scenarios for a company
   */
  async getScenarios(companyId: string): Promise<Scenario[]> {
    const { data: scenarios, error } = await supabase
      .from('scenarios')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch scenarios: ${error.message}`);
    }

    return scenarios || [];
  }

  /**
   * Get a single scenario by ID
   */
  async getScenario(scenarioId: string): Promise<Scenario | null> {
    const { data: scenario, error } = await supabase
      .from('scenarios')
      .select('*')
      .eq('id', scenarioId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Scenario not found
      }
      throw new Error(`Failed to fetch scenario: ${error.message}`);
    }

    return scenario;
  }

  /**
   * Update a scenario
   */
  async updateScenario(scenarioId: string, updates: UpdateScenarioData): Promise<Scenario> {
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
    const { error } = await supabase
      .from('scenarios')
      .update({ is_active: false })
      .eq('id', scenarioId);

    if (error) {
      throw new Error(`Failed to delete scenario: ${error.message}`);
    }
  }

  /**
   * Get localized scenario for user's preferred language
   */
  getLocalizedScenario(scenario: Scenario, preferredLanguage: LanguageCode = 'en') {
    return {
      ...scenario,
      title: translationService.getLocalizedText(scenario.title, preferredLanguage),
      description: translationService.getLocalizedText(scenario.description, preferredLanguage),
      // Keep original multilingual data for admin/editing
      titleMultilingual: scenario.title,
      descriptionMultilingual: scenario.description
    };
  }

  /**
   * Add translation for existing scenario
   */
  async addTranslation(
    scenarioId: string,
    field: 'title' | 'description',
    language: LanguageCode,
    translation: string
  ): Promise<Scenario> {
    const scenario = await this.getScenario(scenarioId);
    if (!scenario) {
      throw new Error('Scenario not found');
    }

    const updatedField = {
      ...scenario[field],
      [language]: translation
    };

    return this.updateScenario(scenarioId, {
      [field]: updatedField
    });
  }

  /**
   * Auto-translate missing languages for a scenario
   */
  async autoTranslateScenario(
    scenarioId: string, 
    sourceLanguage: LanguageCode = 'en'
  ): Promise<Scenario> {
    const scenario = await this.getScenario(scenarioId);
    if (!scenario) {
      throw new Error('Scenario not found');
    }

    const titleSource = scenario.title[sourceLanguage];
    const descriptionSource = scenario.description[sourceLanguage];

    if (!titleSource || !descriptionSource) {
      throw new Error(`Source language ${sourceLanguage} not available for this scenario`);
    }

    try {
      console.log('🌍 Auto-translating existing scenario...');
      
      const [translatedTitle, translatedDescription] = await Promise.all([
        translationService.translateToAllLanguages(titleSource, sourceLanguage, 'training scenario title'),
        translationService.translateToAllLanguages(descriptionSource, sourceLanguage, 'training scenario description')
      ]);

      console.log('✅ Auto-translation completed successfully');

      return this.updateScenario(scenarioId, {
        title: translatedTitle,
        description: translatedDescription
      });
    } catch (error) {
      console.error('⚠️ Auto-translation failed:', error);
      throw error;
    }
  }

  /**
   * Get translation status for a scenario
   */
  getTranslationStatus(scenario: Scenario) {
    const titleStatus = translationService.getTranslationStatus(scenario.title);
    const descriptionStatus = translationService.getTranslationStatus(scenario.description);

    return {
      title: titleStatus,
      description: descriptionStatus,
      overall: {
        percentage: Math.round((titleStatus.percentage + descriptionStatus.percentage) / 2),
        isComplete: titleStatus.percentage === 100 && descriptionStatus.percentage === 100
      }
    };
  }

  /**
   * Batch translate multiple scenarios
   */
  async batchTranslateScenarios(
    scenarioIds: string[],
    sourceLanguage: LanguageCode = 'en'
  ): Promise<{ success: string[]; failed: { id: string; error: string }[] }> {
    const results = await Promise.allSettled(
      scenarioIds.map(async (id) => ({
        id,
        result: await this.autoTranslateScenario(id, sourceLanguage)
      }))
    );

    const success: string[] = [];
    const failed: { id: string; error: string }[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        success.push(result.value.id);
      } else {
        failed.push({
          id: scenarioIds[index],
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error'
        });
      }
    });

    return { success, failed };
  }
}

// Export singleton instance
export const scenarioService = new ScenarioService();