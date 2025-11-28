'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AudioTagsReference } from '@/components/Shared/AudioTagsReference'

interface RecommendationQuestionInputProps {
  companyId: string
  onQuestionsAdded: () => void
}

export default function RecommendationQuestionInput({ companyId, onQuestionsAdded }: RecommendationQuestionInputProps) {
  const t = useTranslations('knowledgeBase')
  const [questions, setQuestions] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [audioPreviewLoading, setAudioPreviewLoading] = useState(false)
  const [currentlyPlayingAudio, setCurrentlyPlayingAudio] = useState<HTMLAudioElement | null>(null)

  const handlePreviewAudio = async () => {
    if (!questions.trim()) {
      setMessage('⚠️ Please enter some questions to preview')
      return
    }

    // Stop any currently playing audio
    if (currentlyPlayingAudio) {
      currentlyPlayingAudio.pause()
      currentlyPlayingAudio.currentTime = 0
      setCurrentlyPlayingAudio(null)
    }

    setAudioPreviewLoading(true)
    setMessage('')

    try {
      // Take the first question (or first few lines) for preview
      const questionLines = questions.trim().split('\n').filter(line => line.trim())
      const previewText = questionLines.slice(0, 3).join(' ') // Preview first 3 questions

      console.log('🎵 Previewing audio for:', previewText)

      const response = await fetch('/api/elevenlabs/elevenlabs-tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: previewText,
          language: 'en'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate audio preview')
      }

      // Create audio blob and play
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)

      audio.onended = () => {
        setCurrentlyPlayingAudio(null)
        URL.revokeObjectURL(audioUrl)
      }

      audio.onerror = () => {
        setMessage('❌ Failed to play audio preview')
        setCurrentlyPlayingAudio(null)
        URL.revokeObjectURL(audioUrl)
      }

      setCurrentlyPlayingAudio(audio)
      await audio.play()
      setMessage('🔊 Playing audio preview...')

    } catch (error) {
      console.error('Error generating audio preview:', error)
      setMessage('❌ Failed to generate audio preview. Please try again.')
    } finally {
      setAudioPreviewLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!questions.trim()) {
      setMessage('Please enter some questions')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/questions/recommendation-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questions: questions.trim(),
          category: 'General',
          difficulty_level: 1,
          company_id: companyId
        })
      })

      const data = await response.json()

      if (data.success) {
        setMessage(`✅ Successfully added ${data.questionsSaved} recommendation questions!`)
        setQuestions('')
        onQuestionsAdded()
      } else {
        setMessage(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error adding recommendation questions:', error)
      setMessage('❌ Failed to add recommendation questions. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center space-x-2 mb-4">
        <span className="text-2xl">💡</span>
        <h2 className="text-xl font-semibold text-gray-900">{t('addQuestionsManually')}</h2>
      </div>

      <p className="text-gray-600 mb-6">
        {t('enterQuestionsDescription')}
      </p>

      {/* Audio Tags Reference for Emotional TTS Control */}
      <AudioTagsReference className="mb-6" defaultExpanded={true} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="questions" className="block text-sm font-medium text-gray-700 mb-2">
            {t('questionsOnePerLine')}
          </label>
          <textarea
            id="questions"
            value={questions}
            onChange={(e) => setQuestions(e.target.value)}
            rows={8}
            placeholder={t('recommendationPlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            required
          />
        </div>

        <p className="text-sm text-gray-500">
          💡 {t('audioTagsTip')}
        </p>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handlePreviewAudio}
            disabled={audioPreviewLoading || loading || !questions.trim()}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            <span className="text-xl">{currentlyPlayingAudio ? '🔊' : '▶️'}</span>
            <span>
              {audioPreviewLoading ? t('generating') : currentlyPlayingAudio ? t('playing') : t('previewAudio')}
            </span>
          </button>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            <span className="text-xl">🔍</span>
            <span>{loading ? t('addingQuestions') : t('submitAndFindAnswers')}</span>
          </button>

          <button
            type="button"
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            {t('cancel')}
          </button>

          {(loading || audioPreviewLoading) && (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          )}
        </div>

        {message && (
          <div className={`p-3 rounded-md ${message.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message}
          </div>
        )}
      </form>
    </div>
  )
}