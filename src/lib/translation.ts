import OpenAI from 'openai';

// Supported languages with their codes and native names
export const SUPPORTED_LANGUAGES = {
  en: { name: 'English', native: 'English' },
  ru: { name: 'Russian', native: 'Русский' },
  de: { name: 'German', native: 'Deutsch' },
  es: { name: 'Spanish', native: 'Español' },
  ka: { name: 'Georgian', native: 'ქართული' },
  fr: { name: 'French', native: 'Français' },
  it: { name: 'Italian', native: 'Italiano' }
} as const;

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;
export type MultilingualText = Partial<Record<LanguageCode, string>>;

class TranslationService {
  private openai: OpenAI | null = null;
  private cache = new Map<string, MultilingualText>();

  constructor() {
    // Initialize OpenAI only if API key is available
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  /**
   * Generate cache key for translation requests
   */
  private getCacheKey(text: string, sourceLanguage: LanguageCode): string {
    return `${sourceLanguage}:${text.substring(0, 100)}`;
  }

  /**
   * Translate text using OpenAI (context-aware, high quality)
   */
  private async translateWithOpenAI(
    text: string,
    sourceLanguage: LanguageCode,
    targetLanguage: LanguageCode,
    context?: string
  ): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const contextPrompt = context 
      ? `Context: This is ${context}. ` 
      : 'Context: This is training content for a professional role-play simulator. ';

    const prompt = `${contextPrompt}Please translate the following ${SUPPORTED_LANGUAGES[sourceLanguage].name} text to ${SUPPORTED_LANGUAGES[targetLanguage].name}. 
    
Keep the tone professional and appropriate for business training scenarios. Preserve any industry-specific terminology when possible.

Text to translate: "${text}"

Translated text:`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a professional translator specializing in business and training content. Provide only the translation without any additional explanation.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.3, // Low temperature for consistent translations
    });

    const translation = response.choices[0]?.message?.content?.trim();
    if (!translation) {
      throw new Error('No translation received from OpenAI');
    }

    return translation;
  }

  /**
   * Translate text to a single target language
   */
  async translateText(
    text: string,
    sourceLanguage: LanguageCode,
    targetLanguage: LanguageCode,
    context?: string
  ): Promise<string> {
    // Skip translation if source and target are the same
    if (sourceLanguage === targetLanguage) {
      return text;
    }

    // Check cache first
    const cacheKey = this.getCacheKey(text, sourceLanguage);
    const cached = this.cache.get(cacheKey);
    if (cached?.[targetLanguage]) {
      return cached[targetLanguage]!;
    }

    try {
      // Try OpenAI first (higher quality)
      if (this.openai) {
        const translation = await this.translateWithOpenAI(text, sourceLanguage, targetLanguage, context);
        
        // Update cache
        const existing = this.cache.get(cacheKey) || {};
        this.cache.set(cacheKey, { ...existing, [targetLanguage]: translation });
        
        return translation;
      } else {
        throw new Error('No translation service available - OpenAI API key required');
      }
    } catch (error) {
      console.error(`Translation failed for ${sourceLanguage} -> ${targetLanguage}:`, error);
      throw new Error(`Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Translate text to all supported languages
   */
  async translateToAllLanguages(
    text: string,
    sourceLanguage: LanguageCode = 'en',
    context?: string
  ): Promise<MultilingualText> {
    const result: MultilingualText = { [sourceLanguage]: text };
    const targetLanguages = Object.keys(SUPPORTED_LANGUAGES).filter(
      lang => lang !== sourceLanguage
    ) as LanguageCode[];

    // Translate to all target languages in parallel
    const translations = await Promise.allSettled(
      targetLanguages.map(async (targetLang) => ({
        language: targetLang,
        translation: await this.translateText(text, sourceLanguage, targetLang, context)
      }))
    );

    // Process results
    translations.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const { language, translation } = result.value;
        result[language] = translation;
      } else {
        console.error(`Translation failed for ${targetLanguages[index]}:`, result.reason);
        // Don't include failed translations
      }
    });

    return result;
  }

  /**
   * Get the best available translation for a given language
   */
  getLocalizedText(
    multilingualText: MultilingualText,
    preferredLanguage: LanguageCode = 'en'
  ): string {
    // Try preferred language first
    if (multilingualText[preferredLanguage]) {
      return multilingualText[preferredLanguage]!;
    }

    // Fallback to English
    if (multilingualText.en) {
      return multilingualText.en;
    }

    // Fallback to any available language
    const availableText = Object.values(multilingualText).find(text => text && text.trim());
    if (availableText) {
      return availableText;
    }

    return 'No translation available';
  }

  /**
   * Check if text needs translation for a specific language
   */
  needsTranslation(multilingualText: MultilingualText, language: LanguageCode): boolean {
    return !multilingualText[language] || multilingualText[language]!.trim() === '';
  }

  /**
   * Get translation completion status
   */
  getTranslationStatus(multilingualText: MultilingualText): {
    total: number;
    completed: number;
    missing: LanguageCode[];
    percentage: number;
  } {
    const allLanguages = Object.keys(SUPPORTED_LANGUAGES) as LanguageCode[];
    const completed = allLanguages.filter(lang => 
      multilingualText[lang] && multilingualText[lang]!.trim() !== ''
    );
    const missing = allLanguages.filter(lang => !completed.includes(lang));

    return {
      total: allLanguages.length,
      completed: completed.length,
      missing,
      percentage: Math.round((completed.length / allLanguages.length) * 100)
    };
  }

  /**
   * Clear translation cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
export const translationService = new TranslationService();

// Utility functions
export function createMultilingualText(text: string, language: LanguageCode = 'en'): MultilingualText {
  return { [language]: text };
}

export function isMultilingualTextEmpty(text: MultilingualText): boolean {
  return Object.values(text).every(value => !value || value.trim() === '');
}

export function getAvailableLanguages(text: MultilingualText): LanguageCode[] {
  return Object.entries(text)
    .filter(([_, value]) => value && value.trim() !== '')
    .map(([lang]) => lang as LanguageCode);
}