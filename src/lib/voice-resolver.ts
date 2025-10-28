/**
 * Voice Resolver Service
 *
 * Handles intelligent voice selection based on:
 * - Scenario's selected voice IDs
 * - Session language
 * - Voice metadata (language, gender, availability)
 *
 * Created: 2025-10-28
 */

import { supabase } from './supabase'

export interface ElevenLabsVoiceConfig {
  id: string
  voice_id: string
  voice_name: string
  language_code: string
  gender: 'male' | 'female' | 'neutral' | null
  description: string | null
  created_at: string
  updated_at: string
}

// In-memory cache for voice configurations (refreshed every 5 minutes)
let voiceCache: ElevenLabsVoiceConfig[] = []
let cacheTimestamp: number = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Load all voices from database with caching
 */
async function loadVoices(): Promise<ElevenLabsVoiceConfig[]> {
  const now = Date.now()

  // Return cached data if still valid
  if (voiceCache.length > 0 && (now - cacheTimestamp) < CACHE_TTL) {
    console.log(`🎤 Using cached voices (${voiceCache.length} voices)`)
    return voiceCache
  }

  console.log('🔄 Loading voices from database...')

  const { data, error } = await supabase
    .from('elevenlabs_voices')
    .select('*')
    .order('language_code', { ascending: true })
    .order('voice_name', { ascending: true })

  if (error) {
    console.error('❌ Failed to load voices:', error)
    throw new Error(`Failed to load voices: ${error.message}`)
  }

  voiceCache = data || []
  cacheTimestamp = now

  console.log(`✅ Loaded ${voiceCache.length} voices from database`)
  return voiceCache
}

/**
 * Get voices by their IDs
 */
export async function getVoicesByIds(voiceIds: string[]): Promise<ElevenLabsVoiceConfig[]> {
  if (!voiceIds || voiceIds.length === 0) {
    return []
  }

  const allVoices = await loadVoices()

  return allVoices.filter(v => voiceIds.includes(v.voice_id))
}

/**
 * Get all voices for a specific language
 */
export async function getVoicesForLanguage(languageCode: string): Promise<ElevenLabsVoiceConfig[]> {
  const allVoices = await loadVoices()

  return allVoices.filter(v => v.language_code === languageCode)
}

/**
 * Get the default voice for a language (first available)
 */
export async function getDefaultVoiceForLanguage(languageCode: string): Promise<string | null> {
  const voices = await getVoicesForLanguage(languageCode)

  if (voices.length === 0) {
    console.warn(`⚠️ No voices configured for language: ${languageCode}`)
    return null
  }

  // Return first voice as default
  return voices[0].voice_id
}

/**
 * Main voice resolution logic for session runtime
 *
 * @param scenarioVoiceIds - Array of voice IDs selected for the scenario
 * @param sessionLanguage - Language code selected for the session (e.g., 'ru', 'en', 'pt')
 * @returns Resolved voice ID to use for the session, or null if no match found
 */
export async function resolveVoiceForSession(
  scenarioVoiceIds: string[] | null | undefined,
  sessionLanguage: string
): Promise<string | null> {
  console.log(`🎤 Resolving voice for language: ${sessionLanguage}`)
  console.log(`📋 Scenario voice IDs:`, scenarioVoiceIds)

  // Case 1: No voices selected for scenario
  if (!scenarioVoiceIds || scenarioVoiceIds.length === 0) {
    console.log('⚠️ No voices selected for scenario, using language default')
    return await getDefaultVoiceForLanguage(sessionLanguage)
  }

  // Case 2: 'random' special keyword (legacy support)
  if (scenarioVoiceIds.includes('random')) {
    console.log('🎲 "random" keyword detected, selecting random voice for language')
    const languageVoices = await getVoicesForLanguage(sessionLanguage)

    if (languageVoices.length === 0) {
      console.warn(`⚠️ No voices available for language: ${sessionLanguage}`)
      return null
    }

    const randomVoice = languageVoices[Math.floor(Math.random() * languageVoices.length)]
    console.log(`✅ Selected random voice: ${randomVoice.voice_name} (${randomVoice.voice_id})`)
    return randomVoice.voice_id
  }

  // Case 3: Resolve from scenario's selected voices
  // Load voice metadata for scenario's selection
  const voices = await getVoicesByIds(scenarioVoiceIds)

  if (voices.length === 0) {
    console.warn('⚠️ None of scenario\'s voice IDs found in database')
    return await getDefaultVoiceForLanguage(sessionLanguage)
  }

  // Filter voices by session language
  const languageMatchingVoices = voices.filter(v => v.language_code === sessionLanguage)

  if (languageMatchingVoices.length === 0) {
    console.warn(`⚠️ No voices match session language: ${sessionLanguage}`)
    console.log(`💡 Available voices in scenario:`, voices.map(v => `${v.voice_name} (${v.language_code})`))
    console.log('💡 Falling back to default voice for language')
    return await getDefaultVoiceForLanguage(sessionLanguage)
  }

  // Random selection from matching voices
  const selectedVoice = languageMatchingVoices[Math.floor(Math.random() * languageMatchingVoices.length)]

  console.log(`✅ Resolved voice: ${selectedVoice.voice_name} (${selectedVoice.language_code})`)
  console.log(`   Voice ID: ${selectedVoice.voice_id}`)
  console.log(`   Gender: ${selectedVoice.gender || 'unspecified'}`)
  console.log(`   Selected from ${languageMatchingVoices.length} matching voice(s)`)

  return selectedVoice.voice_id
}

/**
 * Get all available voices grouped by language
 * Useful for UI rendering (Settings page, scenario forms)
 */
export async function getVoicesGroupedByLanguage(): Promise<Record<string, ElevenLabsVoiceConfig[]>> {
  const allVoices = await loadVoices()

  const grouped: Record<string, ElevenLabsVoiceConfig[]> = {}

  for (const voice of allVoices) {
    if (!grouped[voice.language_code]) {
      grouped[voice.language_code] = []
    }
    grouped[voice.language_code].push(voice)
  }

  return grouped
}

/**
 * Refresh voice cache manually (useful after adding/updating voices)
 */
export function refreshVoiceCache(): void {
  voiceCache = []
  cacheTimestamp = 0
  console.log('🔄 Voice cache cleared')
}

/**
 * Get voice name by voice ID
 * Returns human-readable name for display
 */
export async function getVoiceNameById(voiceId: string): Promise<string> {
  const allVoices = await loadVoices()
  const voice = allVoices.find(v => v.voice_id === voiceId)

  return voice ? voice.voice_name : 'Unknown Voice'
}

/**
 * Get voice gender by voice ID
 * Useful for language-specific gender hints in prompts
 */
export async function getVoiceGenderById(voiceId: string): Promise<'male' | 'female' | 'neutral'> {
  const allVoices = await loadVoices()
  const voice = allVoices.find(v => v.voice_id === voiceId)

  return voice?.gender || 'neutral'
}
