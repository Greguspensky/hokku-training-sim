'use client'

/**
 * Voice Settings Page
 *
 * Allows managers to configure ElevenLabs voices for different languages.
 * Voices configured here will be available for selection in scenario forms.
 *
 * Created: 2025-10-28
 */

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import UserHeader from '@/components/UserHeader'
import { Plus, Edit2, Trash2, X, Check, Upload, User } from 'lucide-react'
import { uploadVoiceAvatar, deleteVoiceAvatar, validateImageFile, createPreviewUrl, revokePreviewUrl } from '@/lib/avatar-upload'

interface Voice {
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

const LANGUAGE_OPTIONS = [
  { code: 'en', name: 'English 🇺🇸' },
  { code: 'es', name: 'Spanish 🇪🇸' },
  { code: 'ru', name: 'Russian 🇷🇺' },
  { code: 'pt', name: 'Portuguese 🇵🇹' },
  { code: 'ka', name: 'Georgian 🇬🇪' },
  { code: 'cs', name: 'Czech 🇨🇿' },
  { code: 'fr', name: 'French 🇫🇷' },
  { code: 'de', name: 'German 🇩🇪' },
  { code: 'it', name: 'Italian 🇮🇹' },
  { code: 'nl', name: 'Dutch 🇳🇱' },
  { code: 'pl', name: 'Polish 🇵🇱' },
  { code: 'ja', name: 'Japanese 🇯🇵' },
  { code: 'ko', name: 'Korean 🇰🇷' },
  { code: 'zh', name: 'Chinese 🇨🇳' }
]

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'neutral', label: 'Neutral' }
]

export default function VoiceSettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const [voices, setVoices] = useState<Voice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingVoice, setEditingVoice] = useState<Voice | null>(null)
  const [formData, setFormData] = useState({
    voice_id: '',
    voice_name: '',
    language_code: 'en',
    gender: 'neutral' as 'male' | 'female' | 'neutral',
    description: ''
  })
  const [saving, setSaving] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Load voices from API
  const loadVoices = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/voice-settings')
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load voices')
      }

      setVoices(data.voices)
      console.log(`✅ Loaded ${data.voices.length} voices`)

    } catch (err: any) {
      console.error('❌ Failed to load voices:', err)
      setError(err.message || 'Failed to load voices')
    } finally {
      setLoading(false)
    }
  }

  // Load voices on mount
  useEffect(() => {
    if (!authLoading) {
      loadVoices()
    }
  }, [authLoading])

  // Handle avatar file selection
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file
    const validation = validateImageFile(file)
    if (!validation.valid) {
      setError(validation.error || 'Invalid file')
      return
    }

    // Set file and create preview
    setAvatarFile(file)
    const previewUrl = createPreviewUrl(file)
    setAvatarPreview(previewUrl)
    setError(null)
  }

  // Handle remove avatar
  const handleRemoveAvatar = () => {
    if (avatarPreview) {
      revokePreviewUrl(avatarPreview)
    }
    setAvatarFile(null)
    setAvatarPreview(null)
  }

  // Handle add voice
  const handleAddVoice = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setSaving(true)
      setError(null)

      let avatarUrl: string | null = null

      // Upload avatar if file is selected
      if (avatarFile) {
        setUploadingAvatar(true)
        try {
          avatarUrl = await uploadVoiceAvatar(formData.voice_id, avatarFile)
          console.log('✅ Avatar uploaded:', avatarUrl)
        } catch (uploadError: any) {
          console.error('❌ Avatar upload failed:', uploadError)
          setError(`Failed to upload avatar: ${uploadError.message}`)
          return
        } finally {
          setUploadingAvatar(false)
        }
      }

      const response = await fetch('/api/voice-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          avatar_url: avatarUrl
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to add voice')
      }

      console.log('✅ Voice added:', data.voice)

      // Reload voices
      await loadVoices()

      // Reset form and close modal
      setFormData({
        voice_id: '',
        voice_name: '',
        language_code: 'en',
        gender: 'neutral',
        description: ''
      })
      handleRemoveAvatar()
      setShowAddModal(false)

    } catch (err: any) {
      console.error('❌ Failed to add voice:', err)
      setError(err.message || 'Failed to add voice')
    } finally {
      setSaving(false)
    }
  }

  // Handle edit voice
  const handleEditVoice = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingVoice) return

    try {
      setSaving(true)
      setError(null)

      let avatarUrl: string | null = editingVoice.avatar_url

      // Upload new avatar if file is selected
      if (avatarFile) {
        setUploadingAvatar(true)
        try {
          // Delete old avatar if exists
          if (editingVoice.avatar_url) {
            await deleteVoiceAvatar(editingVoice.avatar_url)
          }
          avatarUrl = await uploadVoiceAvatar(editingVoice.voice_id, avatarFile)
          console.log('✅ Avatar updated:', avatarUrl)
        } catch (uploadError: any) {
          console.error('❌ Avatar upload failed:', uploadError)
          setError(`Failed to upload avatar: ${uploadError.message}`)
          return
        } finally {
          setUploadingAvatar(false)
        }
      }

      const response = await fetch('/api/voice-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingVoice.id,
          ...formData,
          avatar_url: avatarUrl
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update voice')
      }

      console.log('✅ Voice updated:', data.voice)

      // Reload voices
      await loadVoices()

      // Close modal
      setShowEditModal(false)
      setEditingVoice(null)
      handleRemoveAvatar()

    } catch (err: any) {
      console.error('❌ Failed to update voice:', err)
      setError(err.message || 'Failed to update voice')
    } finally {
      setSaving(false)
    }
  }

  // Handle delete voice
  const handleDeleteVoice = async (voiceId: string, voiceName: string) => {
    if (!confirm(`Are you sure you want to delete "${voiceName}"? This action cannot be undone.`)) {
      return
    }

    try {
      setError(null)

      const response = await fetch(`/api/voice-settings?id=${voiceId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete voice')
      }

      console.log('✅ Voice deleted')

      // Reload voices
      await loadVoices()

    } catch (err: any) {
      console.error('❌ Failed to delete voice:', err)
      setError(err.message || 'Failed to delete voice')
    }
  }

  // Open edit modal with voice data
  const openEditModal = (voice: Voice) => {
    setEditingVoice(voice)
    setFormData({
      voice_id: voice.voice_id,
      voice_name: voice.voice_name,
      language_code: voice.language_code,
      gender: voice.gender || 'neutral',
      description: voice.description || ''
    })
    // Set existing avatar preview if available
    setAvatarPreview(voice.avatar_url)
    setAvatarFile(null)
    setShowEditModal(true)
  }

  // Group voices by language
  const voicesByLanguage = voices.reduce((acc, voice) => {
    if (!acc[voice.language_code]) {
      acc[voice.language_code] = []
    }
    acc[voice.language_code].push(voice)
    return acc
  }, {} as Record<string, Voice[]>)

  // Show loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <UserHeader />

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Voice Settings</h1>
              <p className="mt-2 text-gray-600">
                Configure ElevenLabs voices for different languages. These voices will be available when creating scenarios.
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Voice
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading voices...</p>
            </div>
          ) : voices.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600 mb-4">No voices configured yet.</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-700 transition-colors"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Your First Voice
              </button>
            </div>
          ) : (
            /* Voice List - Grouped by Language */
            <div className="space-y-6">
              {LANGUAGE_OPTIONS.map(lang => {
                const langVoices = voicesByLanguage[lang.code] || []
                if (langVoices.length === 0) return null

                return (
                  <div key={lang.code} className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-xl font-semibold text-gray-900">
                        {lang.name}
                      </h2>
                      <p className="text-sm text-gray-500">{langVoices.length} voice(s)</p>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {langVoices.map(voice => (
                          <div
                            key={voice.id}
                            className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-4">
                              {/* Left side - Text content */}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 mb-1">{voice.voice_name}</h3>
                                <p className="text-sm text-gray-500 mb-1">
                                  {voice.gender ? `${voice.gender.charAt(0).toUpperCase()}${voice.gender.slice(1)}` : 'Unspecified'}
                                </p>
                                {voice.description && (
                                  <p className="text-sm text-gray-600 mb-2">{voice.description}</p>
                                )}
                                <p className="text-xs text-gray-400 font-mono break-all">{voice.voice_id}</p>
                              </div>

                              {/* Right side - Avatar with Edit button */}
                              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                                {voice.avatar_url ? (
                                  <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200">
                                    <img
                                      src={voice.avatar_url}
                                      alt={`${voice.voice_name} avatar`}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-16 h-16 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
                                    <User className="w-8 h-8 text-gray-400" />
                                  </div>
                                )}
                                <button
                                  onClick={() => openEditModal(voice)}
                                  className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Edit voice"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add Voice Modal */}
          {showAddModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Add New Voice</h2>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleAddVoice} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Voice ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.voice_id}
                      onChange={(e) => setFormData({ ...formData, voice_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., kdmDKE6EkgrWrrykO9Qt"
                    />
                    <p className="text-xs text-gray-500 mt-1">ElevenLabs API voice ID</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Voice Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.voice_name}
                      onChange={(e) => setFormData({ ...formData, voice_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Klava"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Language <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.language_code}
                      onChange={(e) => setFormData({ ...formData, language_code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {LANGUAGE_OPTIONS.map(lang => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Gender
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {GENDER_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      placeholder="Optional description..."
                    />
                  </div>

                  {/* Avatar Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Avatar Image
                    </label>
                    {avatarPreview ? (
                      <div className="flex items-center space-x-4">
                        <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-300">
                          <img
                            src={avatarPreview}
                            alt="Avatar preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          className="px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-3">
                        <label className="flex items-center px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                          <Upload className="w-4 h-4 mr-2" />
                          <span className="text-sm">Choose Image</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            onChange={handleAvatarChange}
                            className="hidden"
                          />
                        </label>
                        <p className="text-xs text-gray-500">PNG, JPEG, or WebP (max 2MB)</p>
                      </div>
                    )}
                    {uploadingAvatar && (
                      <p className="text-sm text-blue-600 mt-2">Uploading avatar...</p>
                    )}
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? 'Adding...' : 'Add Voice'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Voice Modal */}
          {showEditModal && editingVoice && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Edit Voice</h2>
                  <button
                    onClick={() => {
                      setShowEditModal(false)
                      setEditingVoice(null)
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleEditVoice} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Voice ID
                    </label>
                    <input
                      type="text"
                      value={formData.voice_id}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">Voice ID cannot be changed</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Voice Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.voice_name}
                      onChange={(e) => setFormData({ ...formData, voice_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Language <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.language_code}
                      onChange={(e) => setFormData({ ...formData, language_code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {LANGUAGE_OPTIONS.map(lang => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Gender
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {GENDER_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                    />
                  </div>

                  {/* Avatar Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Avatar Image
                    </label>
                    {avatarPreview ? (
                      <div className="flex items-center space-x-4">
                        <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-300">
                          <img
                            src={avatarPreview}
                            alt="Avatar preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          className="px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          {avatarFile ? 'Remove New' : 'Remove Avatar'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-3">
                        <label className="flex items-center px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                          <Upload className="w-4 h-4 mr-2" />
                          <span className="text-sm">Choose Image</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            onChange={handleAvatarChange}
                            className="hidden"
                          />
                        </label>
                        <p className="text-xs text-gray-500">PNG, JPEG, or WebP (max 2MB)</p>
                      </div>
                    )}
                    {uploadingAvatar && (
                      <p className="text-sm text-blue-600 mt-2">Uploading avatar...</p>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    {/* Delete button on the left */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditModal(false)
                        setEditingVoice(null)
                        handleRemoveAvatar()
                        if (editingVoice) {
                          handleDeleteVoice(editingVoice.id, editingVoice.voice_name)
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Voice</span>
                    </button>

                    {/* Cancel and Save buttons on the right */}
                    <div className="flex space-x-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowEditModal(false)
                          setEditingVoice(null)
                          handleRemoveAvatar()
                        }}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
