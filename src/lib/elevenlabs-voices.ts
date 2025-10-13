/**
 * ElevenLabs Voice Configuration
 * Voice IDs and metadata for TTS voice selection
 */

export interface ElevenLabsVoice {
  id: string;
  name: string;
  description?: string;
}

export const ELEVENLABS_VOICES: ElevenLabsVoice[] = [
  {
    id: 'kdmDKE6EkgrWrrykO9Qt',
    name: 'Klava',
    description: 'Professional female voice'
  },
  {
    id: 'mOTbMAOniC3yoEvgo4bi',
    name: 'Sanyok',
    description: 'Friendly male voice'
  },
  {
    id: 'RUB3PhT3UqHowKru61Ns',
    name: 'Vlad',
    description: 'Authoritative male voice'
  },
  {
    id: 'Jbte7ht1CqapnZvc4KpK',
    name: 'Karina',
    description: 'Warm female voice'
  }
];

export const RANDOM_VOICE_OPTION = 'random';

/**
 * Get a random voice ID from the available voices
 */
export function getRandomVoiceId(): string {
  const randomIndex = Math.floor(Math.random() * ELEVENLABS_VOICES.length);
  return ELEVENLABS_VOICES[randomIndex].id;
}

/**
 * Get voice name by ID
 */
export function getVoiceName(voiceId: string | undefined): string {
  if (!voiceId || voiceId === RANDOM_VOICE_OPTION) {
    return 'Random Voice';
  }

  const voice = ELEVENLABS_VOICES.find(v => v.id === voiceId);
  return voice ? voice.name : 'Unknown Voice';
}

/**
 * Resolve voice ID - if 'random', select a random voice; otherwise return the provided ID
 */
export function resolveVoiceId(voiceId: string | undefined): string {
  if (!voiceId || voiceId === RANDOM_VOICE_OPTION) {
    return getRandomVoiceId();
  }
  return voiceId;
}

/**
 * Get gender of voice by voice ID
 * Klava and Karina are female voices
 * Sanyok and Vlad are male voices
 */
export function getVoiceGender(voiceId: string | undefined): 'female' | 'male' | 'neutral' {
  if (!voiceId || voiceId === RANDOM_VOICE_OPTION) {
    return 'neutral';
  }

  const voice = ELEVENLABS_VOICES.find(v => v.id === voiceId);

  // Female voices: Klava, Karina
  if (voice?.name === 'Klava' || voice?.name === 'Karina') {
    return 'female';
  }

  // Male voices: Sanyok, Vlad
  if (voice?.name === 'Sanyok' || voice?.name === 'Vlad') {
    return 'male';
  }

  return 'neutral';
}

/**
 * Get language-specific gender hint for AI prompt
 * Helps AI use correct gendered language (Russian, Spanish, French, etc.)
 */
export function getGenderLanguageHint(gender: 'female' | 'male' | 'neutral', language: string): string {
  if (gender === 'neutral') return '';

  const isFemale = gender === 'female';

  switch (language) {
    case 'ru': // Russian
      return isFemale
        ? 'LANGUAGE NOTE: You are speaking as a female. In Russian, use feminine verb endings: "я согласна", "я пришла", "я хотела бы"'
        : 'LANGUAGE NOTE: You are speaking as a male. In Russian, use masculine verb endings: "я согласен", "я пришёл", "я хотел бы"';

    case 'es': // Spanish
      return isFemale
        ? 'LANGUAGE NOTE: You are speaking as a female. In Spanish, use feminine forms: "estoy cansada", "soy cliente"'
        : 'LANGUAGE NOTE: You are speaking as a male. In Spanish, use masculine forms: "estoy cansado", "soy cliente"';

    case 'fr': // French
      return isFemale
        ? 'LANGUAGE NOTE: You are speaking as a female. In French, use feminine forms: "je suis fatiguée", "je suis cliente"'
        : 'LANGUAGE NOTE: You are speaking as a male. In French, use masculine forms: "je suis fatigué", "je suis client"';

    case 'it': // Italian
      return isFemale
        ? 'LANGUAGE NOTE: You are speaking as a female. In Italian, use feminine forms: "sono stanca", "sono cliente"'
        : 'LANGUAGE NOTE: You are speaking as a male. In Italian, use masculine forms: "sono stanco", "sono cliente"';

    case 'pl': // Polish
      return isFemale
        ? 'LANGUAGE NOTE: You are speaking as a female. In Polish, use feminine forms: "jestem zmęczona"'
        : 'LANGUAGE NOTE: You are speaking as a male. In Polish, use masculine forms: "jestem zmęczony"';

    default:
      return ''; // English, Chinese, Japanese, Korean don't need gender hints
  }
}
