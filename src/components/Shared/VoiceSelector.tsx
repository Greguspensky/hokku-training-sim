/**
 * VoiceSelector Component
 * Reusable voice selection UI with multi-select support grouped by language
 * Eliminates 3x duplication from BaseScenarioForm
 */

'use client';

import { useTranslations } from 'next-intl';
import type { ElevenLabsVoiceConfig } from '@/lib/voice-resolver';

interface VoiceSelectorProps {
  voicesByLanguage: Record<string, ElevenLabsVoiceConfig[]>;
  selectedVoiceIds: string[];
  onVoiceToggle: (voiceId: string) => void;
  onRandomToggle?: (checked: boolean) => void;
  loading?: boolean;
  showRandomOption?: boolean;
  className?: string;
}

/**
 * Voice selector component with language grouping and multi-select support
 *
 * @example
 * ```tsx
 * <VoiceSelector
 *   voicesByLanguage={voicesByLanguage}
 *   selectedVoiceIds={formData.voice_ids}
 *   onVoiceToggle={toggleVoiceSelection}
 *   onRandomToggle={(checked) => {
 *     setFormData(prev => ({
 *       ...prev,
 *       voice_ids: checked ? ['random'] : []
 *     }))
 *   }}
 *   loading={loadingVoices}
 *   showRandomOption={true}
 * />
 * ```
 */
export function VoiceSelector({
  voicesByLanguage,
  selectedVoiceIds,
  onVoiceToggle,
  onRandomToggle,
  loading = false,
  showRandomOption = true,
  className = ''
}: VoiceSelectorProps) {
  const t = useTranslations();

  const hasRandomSelected = selectedVoiceIds.includes('random');
  const hasVoicesConfigured = Object.keys(voicesByLanguage).length > 0;
  const selectedCount = selectedVoiceIds.filter(id => id !== 'random').length;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          {t('scenario.voiceSelection')} *
        </label>
        {showRandomOption && (
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={hasRandomSelected}
              onChange={(e) => {
                if (onRandomToggle) {
                  onRandomToggle(e.target.checked);
                } else {
                  // Fallback behavior if onRandomToggle not provided
                  if (e.target.checked) {
                    onVoiceToggle('random');
                  }
                }
              }}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-600">
              {t('scenario.random')}
            </span>
          </label>
        )}
      </div>

      <p className="text-sm text-gray-500">
        {t('scenario.voiceSelectionNote')}
      </p>

      {loading ? (
        <div className="text-sm text-gray-500">
          {t('common.loading')}...
        </div>
      ) : !hasVoicesConfigured ? (
        <div className="text-sm text-yellow-600">
          {t('manager.tracks.noVoicesConfigured')}
        </div>
      ) : (
        <div className="border border-gray-300 rounded-lg p-4 space-y-4 max-h-64 overflow-y-auto">
          {Object.entries(voicesByLanguage).map(([langCode, voices]) => (
            <div key={langCode}>
              <h5 className="text-sm font-semibold text-gray-700 mb-2">
                {voices[0]?.language_code.toUpperCase()} - {voices.length}{' '}
                {t('manager.tracks.voicesCount', { count: voices.length })}
              </h5>
              <div className="grid grid-cols-2 gap-2">
                {voices.map(voice => (
                  <label
                    key={voice.voice_id}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedVoiceIds.includes(voice.voice_id)}
                      onChange={() => onVoiceToggle(voice.voice_id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      {voice.voice_name}
                      {voice.gender && (
                        <span className="text-gray-500"> ({voice.gender})</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedCount > 0 && !hasRandomSelected && (
        <p className="text-xs text-gray-500">
          {selectedCount} voice(s) selected
        </p>
      )}
    </div>
  );
}
