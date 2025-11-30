'use client'

import React, { useEffect } from 'react'
import { Mic, MicOff, Volume2, Play, Square } from 'lucide-react'
import type { RecordingPreference } from '@/lib/training-sessions'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslations } from 'next-intl'
import { useTrainingSession } from '@/hooks/useTrainingSession'
import { useElevenLabsConversation } from '@/hooks/useElevenLabsConversation'

interface ElevenLabsAvatarSessionProps {
  companyId: string
  scenarioId?: string
  scenarioContext?: any
  scenarioQuestions?: any[]
  language?: string
  agentId: string // ElevenLabs Agent ID
  voiceIds?: string[] // Array of voice IDs (multi-select) - NEW
  voiceId?: string // DEPRECATED: Single voice ID for backward compatibility
  avatarUrl?: string | null // Avatar image URL for the voice
  recordingPreference?: RecordingPreference
  videoAspectRatio?: '16:9' | '9:16' | '4:3' | '1:1'
  preAuthorizedTabAudio?: MediaStream | null  // Pre-authorized tab audio for Safari
  sessionTimeLimit?: number  // Time limit in minutes
  onSessionEnd?: (sessionData: any) => void
  className?: string
}

export function ElevenLabsAvatarSession({
  companyId,
  scenarioId,
  scenarioContext = {},
  scenarioQuestions = [],
  language = 'en',
  agentId,
  voiceIds, // NEW: Multi-select voice support
  voiceId, // DEPRECATED: Backward compatibility
  avatarUrl = null,
  recordingPreference = 'none',
  videoAspectRatio = '16:9',
  preAuthorizedTabAudio = null,
  sessionTimeLimit,
  onSessionEnd,
  className = ''
}: ElevenLabsAvatarSessionProps) {
  const { user } = useAuth()
  const t = useTranslations('training')

  // Training session management hook
  const session = useTrainingSession({
    companyId,
    scenarioId,
    userId: user?.id,
    trainingMode: scenarioContext?.type === 'theory' ? 'theory' : 'service_practice',
    language,
    agentId,
    sessionTimeLimit,
    onSessionEnd: onSessionEnd || undefined
  })

  // ElevenLabs conversation management hook
  const conversation = useElevenLabsConversation({
    companyId,
    scenarioId,
    scenarioContext,
    scenarioQuestions,
    language,
    agentId,
    voiceIds,
    voiceId,
    recordingPreference,
    videoAspectRatio,
    preAuthorizedTabAudio,
    user,
    session,
    onSessionEnd
  })

  // Destructure conversation state for easier access
  const {
    conversationService,
    isInitialized,
    isSessionActive,
    isConnected,
    isAgentSpeaking,
    isListening,
    connectionStatus,
    conversationHistory,
    currentMessage,
    isLoadingKnowledge,
    isRecording,
    error,
    sessionQuestions,
    isLoadingSessionQuestions,
    videoRef,
    startSession,
    stopSession,
    loadSessionQuestions
  } = conversation


  // Determine training mode from scenario context
  const trainingMode = scenarioContext?.type === 'theory' ? 'theory' : 'service_practice'
  const isTheoryMode = trainingMode === 'theory'

  return (
    <div className={`w-full max-w-4xl mx-auto ${className} relative`}>
      {/* Saving Session Overlay */}
      {session.isSavingSession && (
        <div className="absolute inset-0 bg-white bg-opacity-95 z-50 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Saving Session...</h3>
            <p className="text-gray-600 mb-2">
              {recordingPreference === 'audio_video' ? 'Uploading video recording and saving session data' :
               recordingPreference === 'audio' ? 'Saving audio recording and session data' :
               'Saving session data'}
            </p>
            <p className="text-sm text-gray-500">Please wait, this may take a moment</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="space-y-6 md:space-y-6">
          {/* Header - Centered Title */}
          <div className="text-center mb-8 md:mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {isTheoryMode ? t('session.theoryTitle') : t('session.servicePracticeTitle')}
            </h2>
          </div>

          {/* Avatar - Centered - 2x larger on desktop, normal on mobile */}
          {avatarUrl && (
            <div className="flex justify-center mb-8 md:mb-6">
              <div className="relative w-32 h-32 md:w-64 md:h-64 rounded-full overflow-hidden border-4 border-gray-200 shadow-lg">
                <img
                  src={avatarUrl}
                  alt="AI Agent Avatar"
                  className={`w-full h-full object-cover transition-all duration-500 ${
                    isSessionActive && isListening ? 'brightness-50' : 'brightness-100'
                  }`}
                />
                {/* Listening Text Overlay */}
                {isSessionActive && isListening && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-white font-semibold text-sm md:text-2xl uppercase tracking-wider drop-shadow-lg">
                      Listening
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Hidden for Surprise Mode: Scenario Context (Title, Description, Goals, Milestones) */}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-medium">Error:</p>
              <p className="text-red-600">{typeof error === 'string' ? error : JSON.stringify(error)}</p>
            </div>
          )}

          {/* Mode-specific Instructions */}
          {/* Session Questions Preview - HIDDEN - Not needed in UI */}
          {/* {scenarioContext?.type === 'theory' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                  📋 Questions Preview (First 10)
                </h3>
                <button
                  onClick={() => loadSessionQuestions()}
                  disabled={isLoadingSessionQuestions}
                  className="text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1 rounded disabled:opacity-50"
                >
                  {isLoadingSessionQuestions ? '🔄 Loading...' : '🔄 Refresh'}
                </button>
              </div>

              {isLoadingSessionQuestions ? (
                <div className="animate-pulse space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-4 bg-blue-200 rounded"></div>
                  ))}
                </div>
              ) : sessionQuestions.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {sessionQuestions.map((q, index) => (
                    <div key={q.id} className="flex items-start gap-2 text-sm">
                      <span className="text-blue-600 font-medium min-w-[24px]">
                        {index + 1}.
                      </span>
                      <div className="flex-1">
                        <div className="text-blue-900 font-medium">{q.question}</div>
                        <div className="text-blue-700 text-xs mt-1 flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            q.topic.category === 'prices' ? 'bg-green-100 text-green-800' :
                            q.topic.category === 'drinks_info' ? 'bg-blue-100 text-blue-800' :
                            q.topic.category === 'menu' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {q.topic.name}
                          </span>
                          <span className="text-gray-500">
                            Level {q.difficultyLevel}/3
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-blue-700 text-sm">
                  No questions available. Click refresh to load from database.
                </p>
              )}
            </div>
          )} */}

          {/* Session Configuration - Only show for Theory mode */}
          {scenarioContext?.type === 'theory' && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">
                ⚙️ Session Configuration
              </h3>
              <div className="text-gray-700 text-sm space-y-1">
                <p><strong>Training Mode:</strong> 📖 Theory Assessment</p>
                <p><strong>Language:</strong> {language === 'ru' ? '🇷🇺 Russian' : language === 'en' ? '🇺🇸 English' : language}</p>
                <p><strong>Database Questions:</strong> {sessionQuestions.length > 0 ? `✅ ${sessionQuestions.length} loaded` : '⏳ Click refresh to load'}</p>
              </div>
            </div>
          )}


          {/* Loading Knowledge Display */}
          {isLoadingKnowledge && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">🔄 Loading scenario knowledge...</p>
            </div>
          )}

          {/* Loading Questions Display */}
          {isLoadingSessionQuestions && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800">📋 Loading structured questions...</p>
            </div>
          )}

          {/* Timer and Controls - Centered */}
          <div className="flex flex-col items-center gap-4 mt-8 md:mt-6">
            {/* Countdown Timer - Above Button - Much smaller on mobile */}
            {isSessionActive && session.isTimerActive && session.timeRemaining !== null && (
              <div className="flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 md:border-2 rounded-lg md:rounded-xl px-3 py-1.5 md:px-8 md:py-4 shadow-md md:shadow-lg">
                <div className="text-[7px] md:text-xs font-semibold text-blue-600 uppercase tracking-wide mb-0 md:mb-1">Time Remaining</div>
                <div className={`text-xl md:text-6xl font-bold tabular-nums leading-tight ${
                  session.timeRemaining <= 60 ? 'text-red-600 animate-pulse' :
                  session.timeRemaining <= 180 ? 'text-orange-600' :
                  'text-blue-600'
                }`}>
                  {Math.floor(session.timeRemaining / 60)}:{(session.timeRemaining % 60).toString().padStart(2, '0')}
                </div>
                <div className="text-[7px] md:text-xs text-gray-500 mt-0 md:mt-1">minutes</div>
              </div>
            )}

            {/* Session Button */}
            {!isSessionActive ? (
              <button
                onClick={startSession}
                disabled={isInitialized || conversationService !== null}
                className="inline-flex items-center px-6 py-3 bg-green-600 text-white text-lg rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shadow-lg"
              >
                <Play className="w-5 h-5 mr-2" />
                {isInitialized ? t('session.connecting') : t('session.startSession')}
              </button>
            ) : (
              <button
                onClick={stopSession}
                className="inline-flex items-center px-6 py-3 bg-red-600 text-white text-lg rounded-lg hover:bg-red-700 shadow-lg"
              >
                <Square className="w-5 h-5 mr-2" />
                End Session
              </button>
            )}
          </div>

          {/* Video Preview - Show when recording video */}
          {isSessionActive && recordingPreference === 'audio_video' && isRecording && (
            <div className="bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center"
              style={{
                aspectRatio: videoAspectRatio,
                maxWidth: videoAspectRatio === '9:16' ? '360px' : '100%',
                width: '100%'
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-contain"
                style={{ transform: 'scaleX(-1)' }}
              />
            </div>
          )}

          {/* Hidden video element for preview - always present so ref is available */}
          {!isSessionActive && (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="hidden"
            />
          )}

          {/* Session Status */}
          {isSessionActive && (
            <div className={`rounded-lg p-4 ${
              isTheoryMode
                ? 'bg-orange-50 border border-orange-200'
                : 'bg-green-50 border border-green-200'
            }`}>
              <h4 className={`font-medium text-sm mb-3 ${
                isTheoryMode ? 'text-orange-900' : 'text-green-900'
              }`}>
                {isTheoryMode ? '📊 Assessment Status' : '🎭 Roleplay Status'}
              </h4>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  ) : (
                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                  )}
                  <span className="text-sm">
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isAgentSpeaking ? (
                    <Volume2 className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="text-sm">
                    {isTheoryMode
                      ? (isAgentSpeaking ? 'Asking Question' : 'Waiting')
                      : (isAgentSpeaking ? 'Customer Speaking' : 'Customer Silent')
                    }
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isListening ? (
                    <Mic className="w-4 h-4 text-red-600 animate-pulse" />
                  ) : (
                    <MicOff className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="text-sm">
                    {isListening
                      ? (isTheoryMode ? 'Answer Time' : 'Your Turn')
                      : 'Not Listening'
                    }
                  </span>
                </div>

                <div className="text-sm text-gray-600">
                  {isTheoryMode ? 'Questions: ' : 'Messages: '}{conversationHistory.length}
                </div>
              </div>
            </div>
          )}

          {/* Current Message Display - centered */}
          {currentMessage && (
            <div className={`border rounded-lg p-4 ${
              isTheoryMode
                ? 'bg-orange-50 border-orange-200'
                : 'bg-blue-50 border-blue-200'
            }`}>
              <p className={`font-medium ${
                isTheoryMode ? 'text-orange-800' : 'text-blue-800'
              }`}>
                {isTheoryMode ? '❓ Question:' : '💬 Last phrase said'}
              </p>
              <p className={isTheoryMode ? 'text-orange-700' : 'text-blue-700'}>
                {currentMessage}
              </p>
            </div>
          )}

          {/* Session Info - Hidden for cleaner UI */}
          {/* <div className="text-sm text-gray-600 bg-gray-50 rounded p-3">
            <p><strong>Agent ID:</strong> {agentId}</p>
            <p><strong>Language:</strong> {language}</p>
            <p><strong>Company:</strong> {companyId}</p>
            {sessionId && <p><strong>Session ID:</strong> {sessionId}</p>}
          </div> */}

          {/* Conversation History - messages alternate left/right */}
          {conversationHistory.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900">
                {isTheoryMode ? '📝 Q&A History:' : '💬 Conversation History:'}
              </h3>
              {/* Reverse the order: newest messages first, oldest last */}
              {[...conversationHistory].reverse().map((message, index) => {
                // Alternate left/right based on index (even = left, odd = right)
                const alignLeft = index % 2 === 0
                // Latest message (index 0) is black, others are gray
                const isLatest = index === 0

                return (
                  <div
                    key={conversationHistory.length - 1 - index}
                    className={`flex ${alignLeft ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-[75%] ${alignLeft ? 'text-left' : 'text-right'}`}>
                      <p className={`text-sm leading-relaxed ${isLatest ? 'text-gray-900' : 'text-gray-500'}`}>
                        {message.content}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Status Indicators - Below white card */}
      <div className="mt-4 flex items-center justify-center space-x-3">
        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
          connectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
          connectionStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800' :
          'bg-red-100 text-red-800'
        }`}>
          {typeof connectionStatus === 'string' ? connectionStatus : JSON.stringify(connectionStatus)}
        </span>
        {recordingPreference !== 'none' && (
          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
            isRecording ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {isRecording ? (
              <>
                <span className="w-2 h-2 bg-red-600 rounded-full mr-1.5 animate-pulse"></span>
                {recordingPreference === 'audio' ? '🎤 Recording' : '🎥 Recording'}
              </>
            ) : (
              <>{recordingPreference === 'audio' ? t('session.audioReady') : t('session.videoReady')}</>
            )}
          </span>
        )}
      </div>
      {recordingPreference !== 'none' && (
        <div className="mt-2 text-center text-sm text-gray-600">
          {recordingPreference === 'audio' ? t('session.audioRecordingEnabled') : t('session.screenAudioRecordingEnabled')}
        </div>
      )}
    </div>
  )
}