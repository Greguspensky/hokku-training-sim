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
  avatar_url: string | null
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

  // If we have language-matching voices, use one of them
  if (languageMatchingVoices.length > 0) {
    const selectedVoice = languageMatchingVoices[Math.floor(Math.random() * languageMatchingVoices.length)]
    console.log(`✅ Resolved voice: ${selectedVoice.voice_name} (${selectedVoice.language_code})`)
    console.log(`   Voice ID: ${selectedVoice.voice_id}`)
    console.log(`   Gender: ${selectedVoice.gender || 'unspecified'}`)
    console.log(`   Selected from ${languageMatchingVoices.length} matching voice(s)`)
    return selectedVoice.voice_id
  }

  // No language match - use manager's selected voice anyway (with warning)
  console.warn(`⚠️ No voices match session language: ${sessionLanguage}`)
  console.log(`💡 Available voices in scenario:`, voices.map(v => `${v.voice_name} (${v.language_code})`))
  console.log(`🎯 Using manager's selected voice anyway (language mismatch is OK)`)

  // Use the first selected voice (manager's choice takes priority)
  const selectedVoice = voices[0]
  console.log(`✅ Using: ${selectedVoice.voice_name} (${selectedVoice.language_code})`)
  console.log(`   Voice ID: ${selectedVoice.voice_id}`)
  console.log(`   Note: Voice language doesn't match session language`)

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

/**
 * Get full voice details by voice ID
 * Returns complete voice configuration including avatar_url
 */
export async function getVoiceDetailsById(voiceId: string): Promise<ElevenLabsVoiceConfig | null> {
  const allVoices = await loadVoices()
  const voice = allVoices.find(v => v.voice_id === voiceId)

  return voice || null
}

/**
 * Resolve voice for a specific question in Recommendation Training
 * Supports per-question voice variability:
 * - 'random' keyword: Pick new random voice for each question
 * - Multiple voices: Cycle through them (Q1 = Voice A, Q2 = Voice B, etc.)
 * - Single voice: Use consistently (backward compatible)
 *
 * @param scenarioVoiceIds - Array of voice IDs selected for the scenario
 * @param sessionLanguage - Language code selected for the session (e.g., 'ru', 'en', 'pt')
 * @param questionIndex - Zero-based index of the current question (0, 1, 2, ...)
 * @returns Resolved voice ID for this specific question
 */
export async function resolveVoiceForQuestion(
  scenarioVoiceIds: string[] | null | undefined,
  sessionLanguage: string,
  questionIndex: number
): Promise<string | null> {
  console.log(`🎤 Resolving voice for question #${questionIndex + 1} (language: ${sessionLanguage})`)
  console.log(`📋 Scenario voice IDs:`, scenarioVoiceIds)

  // Case 1: No voices selected for scenario
  if (!scenarioVoiceIds || scenarioVoiceIds.length === 0) {
    console.log('⚠️ No voices selected for scenario, using language default')
    return await getDefaultVoiceForLanguage(sessionLanguage)
  }

  // Case 2: 'random' special keyword - pick NEW random voice for THIS question
  if (scenarioVoiceIds.includes('random')) {
    console.log(`🎲 "random" keyword detected, selecting random voice for question #${questionIndex + 1}`)
    const languageVoices = await getVoicesForLanguage(sessionLanguage)

    if (languageVoices.length === 0) {
      console.warn(`⚠️ No voices available for language: ${sessionLanguage}`)
      return null
    }

    const randomVoice = languageVoices[Math.floor(Math.random() * languageVoices.length)]
    console.log(`✅ Selected random voice: ${randomVoice.voice_name} (${randomVoice.voice_id})`)
    return randomVoice.voice_id
  }

  // Case 3: Multiple specific voices - cycle through them
  // Load voice metadata for scenario's selection
  const voices = await getVoicesByIds(scenarioVoiceIds)

  if (voices.length === 0) {
    console.warn('⚠️ None of scenario\'s voice IDs found in database')
    return await getDefaultVoiceForLanguage(sessionLanguage)
  }

  // Filter voices by session language
  const languageMatchingVoices = voices.filter(v => v.language_code === sessionLanguage)

  // Use language-matching voices if available
  const voicesToCycle = languageMatchingVoices.length > 0 ? languageMatchingVoices : voices

  // Cycle through available voices using modulo
  const voiceIndex = questionIndex % voicesToCycle.length
  const selectedVoice = voicesToCycle[voiceIndex]

  console.log(`🔄 Cycling through ${voicesToCycle.length} voice(s)`)
  console.log(`✅ Question #${questionIndex + 1} voice: ${selectedVoice.voice_name} (${selectedVoice.voice_id})`)
  console.log(`   Language: ${selectedVoice.language_code}`)
  console.log(`   Gender: ${selectedVoice.gender || 'unspecified'}`)

  if (languageMatchingVoices.length === 0) {
    console.warn(`⚠️ Note: Voice language (${selectedVoice.language_code}) doesn't match session language (${sessionLanguage})`)
  }

  return selectedVoice.voice_id
}
