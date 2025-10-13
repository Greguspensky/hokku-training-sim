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
