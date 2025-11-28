import { NextRequest, NextResponse } from 'next/server';
import { translationService, type LanguageCode } from '@/lib/translation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      text, 
      sourceLanguage = 'en', 
      targetLanguage, 
      targetLanguages,
      context 
    }: {
      text: string;
      sourceLanguage?: LanguageCode;
      targetLanguage?: LanguageCode;
      targetLanguages?: LanguageCode[];
      context?: string;
    } = body;

    if (!text || text.trim() === '') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Single language translation
    if (targetLanguage) {
      const translation = await translationService.translateText(
        text,
        sourceLanguage,
        targetLanguage,
        context
      );

      return NextResponse.json({
        success: true,
        translation,
        sourceLanguage,
        targetLanguage
      });
    }

    // Multiple language translation
    if (targetLanguages && targetLanguages.length > 0) {
      const translations: Record<string, string> = {};
      
      const results = await Promise.allSettled(
        targetLanguages.map(async (lang) => ({
          language: lang,
          translation: await translationService.translateText(text, sourceLanguage, lang, context)
        }))
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          translations[result.value.language] = result.value.translation;
        } else {
          console.error(`Translation failed for ${targetLanguages[index]}:`, result.reason);
        }
      });

      return NextResponse.json({
        success: true,
        translations,
        sourceLanguage,
        targetLanguages
      });
    }

    // Translate to all languages
    const translations = await translationService.translateToAllLanguages(
      text,
      sourceLanguage,
      context
    );

    return NextResponse.json({
      success: true,
      translations,
      sourceLanguage
    });

  } catch (error) {
    console.error('Translation API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Translation failed' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Translation API',
    endpoints: {
      POST: {
        description: 'Translate text',
        parameters: {
          text: 'Text to translate (required)',
          sourceLanguage: 'Source language code (default: en)',
          targetLanguage: 'Single target language code (optional)',
          targetLanguages: 'Array of target language codes (optional)',
          context: 'Translation context (optional)'
        }
      }
    },
    supportedLanguages: {
      en: 'English',
      ru: 'Russian',
      de: 'German',
      es: 'Spanish',
      ka: 'Georgian',
      fr: 'French',
      it: 'Italian'
    }
  });
}