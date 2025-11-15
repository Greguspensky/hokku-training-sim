'use client'

import { useRouter } from 'next/navigation'
import { Calendar, Clock, MessageCircle, Brain, Video, Target, Trash2, Trophy, BarChart3 } from 'lucide-react'
import { trainingSessionsService, type TrainingSession } from '@/lib/training-sessions'

interface SessionCardProps {
  session: TrainingSession & {
    scenario_name?: string | null
    scenario_type?: string | null
    service_practice_assessment_results?: {
      overallScore: number
      metrics: Record<string, number>
      strengths: Array<{ area: string; evidence: string }>
      improvements: Array<{ area: string; issue: string; suggestion: string }>
    } | null
    service_assessment_status?: string | null
    service_assessment_completed_at?: string | null
    theory_assessment_results?: {
      summary: {
        score: number
        accuracy: number
        totalQuestions: number
        correctAnswers: number
        incorrectAnswers: number
      }
    } | null
  }
  showClickable?: boolean
  showDeleteButton?: boolean
  showAnalyzeButton?: boolean
  onDelete?: (sessionId: string) => Promise<void>
  onAnalyze?: (sessionId: string) => Promise<void>
  isDeleting?: boolean
  isAnalyzing?: boolean
}

export default function SessionCard({
  session,
  showClickable = true,
  showDeleteButton = false,
  showAnalyzeButton = false,
  onDelete,
  onAnalyze,
  isDeleting = false,
  isAnalyzing = false
}: SessionCardProps) {
  const router = useRouter()

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    if (onDelete && !isDeleting) {
      await onDelete(session.id)
    }
  }

  const handleAnalyzeClick = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    if (onAnalyze && !isAnalyzing) {
      await onAnalyze(session.id)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      })
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-green-50 border-green-200 text-green-700'
    if (score >= 60) return 'bg-yellow-50 border-yellow-200 text-yellow-700'
    return 'bg-red-50 border-red-200 text-red-700'
  }

  const handleClick = () => {
    if (showClickable) {
      window.open(`/employee/sessions/${session.id}`, '_blank')
    }
  }

  return (
    <div
      className={`bg-white rounded-lg shadow border border-gray-200 ${
        showClickable ? 'hover:shadow-md transition-shadow cursor-pointer' : ''
      }`}
      onClick={handleClick}
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {session.scenario_name || session.session_name}
            </h3>
            <div className="flex items-center text-sm text-gray-500">
              <Calendar className="w-4 h-4 mr-1" />
              {formatDate(session.started_at)} at {formatTime(session.started_at)}
            </div>
            <div className="text-xs text-gray-400 font-mono mt-1 space-y-0.5">
              <div>Attempt ID: {session.id}</div>
              {session.scenario_id && (
                <div>Scenario ID: {session.scenario_id}</div>
              )}
              {session.elevenlabs_conversation_id && (
                <div>ElevenLabs Conv ID: {session.elevenlabs_conversation_id}</div>
              )}
              {session.video_recording_url && (
                <div>Video ID: {session.video_recording_url.split('/').pop()}</div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                session.training_mode === 'theory'
                  ? 'bg-blue-100 text-blue-800'
                  : session.training_mode === 'recommendation_tts'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {session.training_mode === 'theory'
                ? 'Theory Q&A'
                : session.training_mode === 'recommendation_tts'
                ? 'Product Recommendations'
                : 'Service Practice'}
            </span>
            {/* Performance Score Badge OR Analyze Button - For Theory Q&A */}
            {session.training_mode === 'theory' && (() => {
              // Show score badge if analyzed
              if (session.theory_assessment_results?.summary) {
                const score = session.theory_assessment_results.summary.score;

                if (typeof score === 'number' && !isNaN(score)) {
                  return (
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${getScoreBadgeColor(score)}`}>
                      <Trophy className="w-3.5 h-3.5" />
                      <span className="text-sm font-semibold">
                        {Math.round(score)}/100
                      </span>
                    </div>
                  );
                }
              }

              // Show Analyze button if requested and not analyzed yet
              if (showAnalyzeButton && !session.theory_assessment_results?.summary && onAnalyze) {
                return (
                  <button
                    onClick={handleAnalyzeClick}
                    disabled={isAnalyzing}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isAnalyzing
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                    }`}
                    title="Analyze this session with GPT-4"
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>Analyze</span>
                      </>
                    )}
                  </button>
                );
              }

              return null;
            })()}
            {/* Performance Score Badge OR Analyze Button - For Service Practice */}
            {session.training_mode === 'service_practice' && (() => {
              // Show score badge if analyzed
              if (session.service_assessment_status === 'completed' && session.service_practice_assessment_results) {
                const score = (session.service_practice_assessment_results as any).overallScore ||
                              (session.service_practice_assessment_results as any).overall_score;

                if (typeof score === 'number' && !isNaN(score)) {
                  return (
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${getScoreBadgeColor(score)}`}>
                      <Trophy className="w-3.5 h-3.5" />
                      <span className="text-sm font-semibold">
                        {Math.round(score)}/100
                      </span>
                    </div>
                  );
                }
              }

              // Show Analyze button if requested and not analyzed yet
              if (showAnalyzeButton && session.service_assessment_status !== 'completed' && onAnalyze) {
                return (
                  <button
                    onClick={handleAnalyzeClick}
                    disabled={isAnalyzing}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isAnalyzing
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                    }`}
                    title="Analyze this session with GPT-4"
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>Analyze</span>
                      </>
                    )}
                  </button>
                );
              }

              return null;
            })()}
            {showDeleteButton && (
              <button
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className={`p-2 rounded-md transition-colors ${
                  isDeleting
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'hover:bg-red-100 text-gray-500 hover:text-red-600'
                }`}
                title="Delete session"
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center text-gray-600">
            <Clock className="w-4 h-4 mr-2" />
            <span>{trainingSessionsService.formatDuration(session.session_duration_seconds)}</span>
          </div>
          <div className="flex items-center text-gray-600">
            {session.training_mode === 'recommendation_tts' ? (
              <>
                <Target className="w-4 h-4 mr-2" />
                <span>{session.conversation_transcript.length} questions</span>
              </>
            ) : (
              <>
                <MessageCircle className="w-4 h-4 mr-2" />
                <span>{session.conversation_transcript.length} messages</span>
              </>
            )}
          </div>
          <div className="flex items-center text-gray-600">
            <Brain className="w-4 h-4 mr-2" />
            <span>{session.language.toUpperCase()}</span>
          </div>
        </div>

        {session.video_recording_url && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-500 mb-2 flex items-center">
              <Video className="w-3 h-3 mr-1" />
              Video Recording:
            </div>
            <div className="bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
              <video
                src={session.video_recording_url}
                controls
                className="w-full h-full object-cover"
                preload="none"
              >
                Your browser does not support video playback.
              </video>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}