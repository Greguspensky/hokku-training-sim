'use client'

import { useRouter } from 'next/navigation'
import { Calendar, Clock, MessageCircle, Brain, Video, Target } from 'lucide-react'
import { trainingSessionsService, type TrainingSession } from '@/lib/training-sessions'

interface SessionCardProps {
  session: TrainingSession & {
    scenario_name?: string | null
    scenario_type?: string | null
  }
  showClickable?: boolean
}

export default function SessionCard({ session, showClickable = true }: SessionCardProps) {
  const router = useRouter()

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

        {session.knowledge_context && session.knowledge_context.documents && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-500 mb-1">Knowledge Documents:</div>
            <div className="flex flex-wrap gap-1">
              {session.knowledge_context.documents.slice(0, 3).map((doc, index) => (
                <span
                  key={index}
                  className="inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs"
                >
                  {doc.title}
                </span>
              ))}
              {session.knowledge_context.documents.length > 3 && (
                <span className="inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                  +{session.knowledge_context.documents.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

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