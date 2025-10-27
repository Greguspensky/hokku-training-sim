'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff, Volume2, VolumeX, Play, Square } from 'lucide-react'
import { ElevenLabsConversationService, ConversationMessage } from '@/lib/elevenlabs-conversation'
import type { ScenarioKnowledgeContext } from '@/lib/elevenlabs-knowledge'
import { trainingSessionsService, type RecordingPreference } from '@/lib/training-sessions'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { VideoRecordingService } from '@/services/VideoRecordingService'

interface ElevenLabsAvatarSessionProps {
  companyId: string
  scenarioId?: string
  scenarioContext?: any
  scenarioQuestions?: any[]
  language?: string
  agentId: string // ElevenLabs Agent ID
  voiceId?: string // ElevenLabs Voice ID or 'random'
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
  voiceId,
  recordingPreference = 'none',
  videoAspectRatio = '16:9',
  preAuthorizedTabAudio = null,
  sessionTimeLimit,
  onSessionEnd,
  className = ''
}: ElevenLabsAvatarSessionProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [conversationService, setConversationService] = useState<ElevenLabsConversationService | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([])
  const [currentMessage, setCurrentMessage] = useState('')
  const [volume, setVolume] = useState(0.8)
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [knowledgeContext, setKnowledgeContext] = useState<ScenarioKnowledgeContext | null>(null)
  const [isLoadingKnowledge, setIsLoadingKnowledge] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [structuredQuestions, setStructuredQuestions] = useState<any[]>([])
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false)
  const [sessionQuestions, setSessionQuestions] = useState<any[]>([])
  const [isLoadingSessionQuestions, setIsLoadingSessionQuestions] = useState(false)
  const [isSavingSession, setIsSavingSession] = useState(false)

  // Countdown timer state
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null) // time in seconds
  const [isTimerActive, setIsTimerActive] = useState(false)

  // Session recording - simplified with VideoRecordingService
  const videoService = useRef<VideoRecordingService>(new VideoRecordingService())
  const sessionStartTimeRef = useRef<number>(0)
  const tabAudioStreamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const isSavingSessionRef = useRef<boolean>(false) // Guard to prevent duplicate saves
  const isStartingSessionRef = useRef<boolean>(false) // Guard to prevent multiple simultaneous starts

  /**
   * Countdown timer logic
   * Starts when isTimerActive is true and counts down every second
   */
  useEffect(() => {
    if (!isTimerActive || timeRemaining === null || timeRemaining <= 0) return

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          // Time's up! Stop the session
          console.log('⏰ Time limit reached - ending session')
          stopSession()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isTimerActive, timeRemaining])

  /**
   * Load structured questions from database for theory practice
   */
  const loadStructuredQuestions = useCallback(async () => {
    if (!user?.id) {
      console.log('⚠️ No user ID provided, cannot load questions')
      return []
    }

    try {
      setIsLoadingQuestions(true)
      console.log(`📋 Loading structured questions for user: ${user.id}`)

      const response = await fetch(`/api/theory-practice?user_id=${user.id}`)
      if (!response.ok) {
        throw new Error('Failed to load questions')
      }

      const data = await response.json()
      const questions = data.questions || []

      setStructuredQuestions(questions)
      console.log(`✅ Loaded ${questions.length} structured questions`)

      return questions
    } catch (error) {
      console.error('❌ Error loading structured questions:', error)
      return []
    } finally {
      setIsLoadingQuestions(false)
    }
  }, [user?.id])

  /**
   * Load session questions preview for UI display
   */
  const loadSessionQuestions = useCallback(async () => {
    try {
      setIsLoadingSessionQuestions(true)
      console.log('📋 Loading session questions preview for company:', companyId, 'employee:', user?.id)

      const url = user?.id
        ? `/api/session-questions?companyId=${companyId}&employeeId=${user.id}&limit=10`
        : `/api/session-questions?companyId=${companyId}&limit=10`

      const response = await fetch(url)
      const data = await response.json()

      if (response.ok && data.success) {
        setSessionQuestions(data.questions)
        console.log('✅ Loaded session questions preview:', data.questions.length)
        if (data.strategy) {
          console.log('📊 Question selection strategy used:', data.strategy)
        }
      } else {
        console.error('❌ Failed to load session questions:', data.error)
        setSessionQuestions([])
      }
    } catch (error) {
      console.error('❌ Error loading session questions:', error)
      setSessionQuestions([])
    } finally {
      setIsLoadingSessionQuestions(false)
    }
  }, [companyId, user?.id])

  // Load session questions preview when component mounts in theory mode
  React.useEffect(() => {
    if (scenarioContext?.type === 'theory') {
      loadSessionQuestions()
    }
  }, [scenarioContext?.type, loadSessionQuestions])

  /**
   * Load scenario-specific knowledge context
   */
  const loadKnowledgeContext = useCallback(async () => {
    if (!scenarioId) {
      console.log('⚠️ No scenario ID provided, using general knowledge context')
      return null
    }

    if (!companyId) {
      console.log('⚠️ No company ID provided, skipping knowledge context loading')
      return null
    }

    try {
      setIsLoadingKnowledge(true)
      setError(null)

      console.log(`🧠 Loading knowledge context for scenario: ${scenarioId}, company: ${companyId}`)

      // Use API endpoint instead of direct service call (client can't access SUPABASE_SERVICE_ROLE_KEY)
      const response = await fetch('/api/scenario-knowledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scenarioId,
          companyId,
          maxChunks: 5
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load knowledge context')
      }

      const result = await response.json()
      const context = result.data

      setKnowledgeContext(context)
      console.log(`✅ Knowledge context loaded: ${context.documents.length} documents, scope: ${context.knowledgeScope}`)
      console.log(`📝 Context preview:`, context.formattedContext.substring(0, 200) + '...')
      console.log(`🔄 React state updated, knowledgeContext now contains:`, context.documents.map(d => d.title))

      return context // Return the loaded context

    } catch (error) {
      console.error('❌ Failed to load knowledge context:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to load knowledge context'
      setError(`Knowledge loading error: ${errorMessage}`)
      return null
    } finally {
      setIsLoadingKnowledge(false)
    }
  }, [scenarioId, companyId])

  /**
   * Initialize the ElevenLabs conversation service
   */
  const initializeConversation = useCallback(async (loadedKnowledgeContext?: any, loadedQuestions?: any[]) => {
    if (conversationService || isInitialized) return

    try {
      setError(null)
      console.log('🚀 Initializing ElevenLabs Avatar Session...')

      // Use the sessionId that was already generated in startSession
      // (No longer generating it here since we need it earlier for attempt counting)
      const currentSessionId = sessionIdRef.current
      if (!currentSessionId) {
        console.error('❌ No sessionId found - should have been generated in startSession')
        throw new Error('Session ID not initialized')
      }
      console.log('🆔 Using session ID:', currentSessionId)

      // Use the passed context or fall back to state
      const contextToUse = loadedKnowledgeContext || knowledgeContext
      console.log('🔍 Using knowledge context:', contextToUse ? `${contextToUse.documents?.length || 0} documents loaded` : 'No context available')

      // Use scenario-specific questions first, then fall back to other sources
      const questionsToUse = scenarioQuestions.length > 0 ? scenarioQuestions : loadedQuestions || sessionQuestions || structuredQuestions
      console.log('📋 Using structured questions:', questionsToUse.length, 'questions available')
      console.log('📋 Questions source:',
        scenarioQuestions.length > 0 ? 'scenarioQuestions (scenario-specific)' :
        loadedQuestions ? 'loadedQuestions' :
        sessionQuestions.length > 0 ? 'sessionQuestions (new API)' :
        'structuredQuestions (legacy)'
      )

      // Determine training mode from scenario context
      const trainingMode = scenarioContext?.type === 'theory' ? 'theory' : 'service_practice'

      // Validate that we have knowledge context - this is critical for quality training
      if (!contextToUse || !contextToUse.formattedContext) {
        console.warn('⚠️ NO KNOWLEDGE CONTEXT LOADED! Training quality will be poor.')
        console.warn('⚠️ Check that:')
        console.warn('   1. Scenario has assigned knowledge documents')
        console.warn('   2. Knowledge documents exist in database')
        console.warn('   3. API endpoint /api/scenario-knowledge is accessible')
      }

      // Format structured questions for the ElevenLabs agent
      const formatStructuredQuestions = (questions: any[]) => {
        if (!questions || questions.length === 0) {
          return ''
        }

        // Handle both old format (with status) and new format (from session-questions API)
        let questionsToFormat = questions

        // If questions have status (old format), filter by priority
        if (questions.length > 0 && questions[0].status) {
          const unanswered = questions.filter(q => q.status === 'unanswered')
          const incorrect = questions.filter(q => q.status === 'incorrect')
          const correct = questions.filter(q => q.status === 'correct')
          // Correct priority order: unanswered → incorrect → correct
          questionsToFormat = [...unanswered, ...incorrect, ...correct]
        }

        if (questionsToFormat.length === 0) {
          return ''
        }

        // Use all questions without arbitrary limit
        // Note: If prompt becomes too large for ElevenLabs (>10KB), we may need to paginate
        const questionList = questionsToFormat.map((q, index) => {
          // Handle both old format and new format
          const questionText = q.question_template || q.question
          const topicName = q.topic_name || q.topic?.name || 'Unknown Topic'
          const difficultyLevel = q.difficultyLevel ? ` (Level ${q.difficultyLevel}/3)` : ''

          return `${index + 1}. "${questionText}" (Topic: ${topicName}${difficultyLevel})`
        }).join('\n')

        console.log(`📋 Formatted ${questionsToFormat.length} questions for ElevenLabs agent`)
        console.log(`📏 Question list size: ${questionList.length} characters`)

        return `
STRUCTURED QUESTIONS TO ASK (in order of priority):

${questionList}

INSTRUCTIONS:
- Ask these questions one by one in the exact order listed
- After student gives ANY answer, move immediately to the next question
- Do not provide correct answers or explanations during the session
- Ask ALL ${questionsToFormat.length} questions in the list before ending the session
- Track which questions have been asked to avoid repetition
`
      }

      const structuredQuestionsText = formatStructuredQuestions(questionsToUse)

      // Get establishment type from user's company
      const establishmentType = user?.business_type || 'coffee_shop'

      // FEATURE FLAG: RAG Knowledge Base API (DISABLED - using dynamic variables instead)
      //
      // REASON FOR DISABLING: Race conditions occur when multiple companies use the same agent.
      // PATCH /v1/convai/agents/{agentId} changes global agent config, affecting all active sessions.
      //
      // CURRENT APPROACH: Include menu data in dynamic variables (knowledge_context below)
      // - Works for small KB (<20KB)
      // - No race conditions
      // - Per-session isolation
      //
      // FUTURE: Set USE_RAG_KNOWLEDGE_BASE = true when:
      // - Using per-company agents (add elevenlabs_agent_id to companies table)
      // - Menu size exceeds 20KB
      // - Need advanced RAG features
      //
      // See RAG_KNOWLEDGE_BASE_IMPLEMENTATION.md for complete documentation
      const USE_RAG_KNOWLEDGE_BASE = false

      if (USE_RAG_KNOWLEDGE_BASE && trainingMode === 'service_practice' && scenarioId && contextToUse) {
        console.log('📤 Syncing knowledge base to ElevenLabs...')
        try {
          const kbSyncResponse = await fetch('/api/elevenlabs-knowledge-sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              companyId,
              scenarioId,
              agentId,
            }),
          })

          if (kbSyncResponse.ok) {
            const kbResult = await kbSyncResponse.json()
            console.log(`✅ KB synced successfully: document ${kbResult.documentId}`)
            console.log(`📊 KB contains ${kbResult.documentsCount} documents, ${kbResult.knowledgeLength} characters`)
          } else {
            console.warn('⚠️ KB sync failed, continuing with dynamic variables fallback')
          }
        } catch (kbError) {
          console.error('❌ KB sync error:', kbError)
          console.warn('⚠️ Continuing session without KB sync')
        }
      } else if (trainingMode === 'service_practice') {
        console.log('ℹ️ Using dynamic variables for knowledge context (RAG KB disabled)')
      }

      // Create dynamic variables for ElevenLabs agent
      const dynamicVariables = {
        training_mode: trainingMode,
        company_name: companyId,
        difficulty_level: scenarioContext?.difficulty || 'intermediate',
        session_type: 'assessment',
        language: language,
        establishment_type: establishmentType,
        // Knowledge context - included for BOTH Theory and Service Practice modes
        // - Theory mode: Contains training material for examiner to ask questions about
        // - Service Practice: Contains menu items for customer to order from
        // NOTE: This uses dynamic variables instead of RAG KB API to prevent race conditions
        //       when multiple companies use the same agent concurrently
        knowledge_context: contextToUse?.formattedContext ||
          'No specific company knowledge available for this scenario.',
        knowledge_scope: contextToUse?.knowledgeScope || 'restricted',
        documents_available: contextToUse?.documents?.length || 0,
        questions_available: questionsToUse.length,
        // Question templates for Theory mode - AI must ask these EXACTLY as written
        question_templates: trainingMode === 'theory' ? structuredQuestionsText : undefined,
        // Service practice specific fields
        scenario_title: scenarioContext?.title || 'General customer interaction',
        client_behavior: scenarioContext?.client_behavior || 'Act as a typical customer seeking help',
        expected_response: scenarioContext?.expected_response || 'Employee should be helpful and knowledgeable',
        customer_emotion_level: scenarioContext?.customer_emotion_level || 'normal',
        first_message: scenarioContext?.first_message || undefined,
        // examiner_instructions only used for Theory mode
        // For Service Practice, the system prompt in elevenlabs-conversation.ts handles everything
        examiner_instructions: trainingMode === 'theory' ?
          (questionsToUse.length > 0 ?
            `You are a STRICT THEORY EXAMINER for a company training.

IMPORTANT BEHAVIOR:
- Start with: "Let's begin the theory assessment."
- Ask questions from the STRUCTURED QUESTIONS list below
- After ANY student response, move IMMEDIATELY to the next question
- Do not provide correct answers or explanations
- Ask questions in the exact order provided

${structuredQuestionsText}

If you run out of structured questions, ask follow-up questions based on the company knowledge provided.` :
            `You are a STRICT THEORY EXAMINER for a company training.

CRITICAL BEHAVIOR RULES:
- Ask ONE factual question at a time about company knowledge
- After ANY student response, IMMEDIATELY move to the next question
- Do not repeat questions or get stuck on wrong answers
- Be direct and formal in your questioning
- Start with: "Let's begin the theory assessment."

Ask specific, factual questions based on the company knowledge context provided. Focus on testing the employee's knowledge of facts, procedures, and policies.`
          ) :
          undefined  // Service practice doesn't need examiner_instructions - system prompt handles everything
      }

      console.log('🎯 Starting session with dynamic variables:', dynamicVariables)
      console.log('📋 Scenario context received:', scenarioContext)
      console.log('😤 Customer emotion level:', scenarioContext?.customer_emotion_level || 'normal (default)')
      console.log('🧠 Knowledge context status:', {
        available: !!knowledgeContext,
        documentsCount: knowledgeContext?.documents?.length || 0,
        hasFormattedContext: !!knowledgeContext?.formattedContext,
        knowledgeScope: knowledgeContext?.knowledgeScope
      })

      const service = new ElevenLabsConversationService({
        agentId,
        language,
        voiceId,
        connectionType: 'webrtc', // Use WebRTC for better audio quality
        volume,
        dynamicVariables
      })

      // Set up event listeners
      service.on('connected', () => {
        console.log('✅ Avatar session connected')
        setIsConnected(true)
        setConnectionStatus('connected')
        setIsSessionActive(true)
        // Recording already started before conversation initialization
        console.log('ℹ️ Recording was pre-initialized - agent can speak immediately')
      })

      service.on('disconnected', () => {
        console.log('🔌 Avatar session disconnected')
        setIsConnected(false)
        setConnectionStatus('disconnected')
        setIsSessionActive(false)
        // Note: stopSessionRecording() is now handled explicitly in stopSession()
      })

      service.on('agentMessage', (message: ConversationMessage) => {
        setCurrentMessage(message.content)
        setConversationHistory(prev => [...prev, message])
      })

      service.on('userMessage', (message: ConversationMessage) => {
        setConversationHistory(prev => [...prev, message])
      })

      // NEW: Listen for remote audio track becoming available
      service.on('remoteAudioTrackAvailable', (track: any) => {
        console.log('🎵 Remote audio track available event received!')

        if (recordingPreference === 'audio_video' && videoService.current.isRecording()) {
          // Create MediaStream from the track
          const stream = new MediaStream([track.mediaStreamTrack || track])
          console.log('✅ Created MediaStream from remote audio track')
          console.log(`   Audio tracks: ${stream.getAudioTracks().length}`)

          // Add to video recording
          videoService.current.addLiveAudioStream(stream)
          tabAudioStreamRef.current = stream
          console.log('✅ Remote audio added to recording via trackSubscribed event')
        }
      })

      service.on('agentStartSpeaking', () => {
        setIsAgentSpeaking(true)
        setIsListening(false)

        // Try to capture audio if we haven't already
        if (recordingPreference === 'audio_video' && videoService.current.isRecording() && !tabAudioStreamRef.current) {
          console.log('🔍 Agent started speaking - attempting to capture audio stream...')

          // Try immediately first
          let elevenLabsAudio = service.getRemoteAudioStream()

          if (elevenLabsAudio && elevenLabsAudio.getAudioTracks().length > 0) {
            console.log('✅ Agent audio captured (immediate) - adding to recording')
            console.log('   Platform: Works on Desktop + Mobile')
            videoService.current.addLiveAudioStream(elevenLabsAudio)
            tabAudioStreamRef.current = elevenLabsAudio
          } else {
            console.warn('⚠️ Audio not available immediately - trying with delay...')

            // Retry after a short delay to allow WebRTC connection to establish
            setTimeout(() => {
              elevenLabsAudio = service.getRemoteAudioStream()

              if (elevenLabsAudio && elevenLabsAudio.getAudioTracks().length > 0) {
                console.log('✅ Agent audio captured (retry) - adding to recording')
                videoService.current.addLiveAudioStream(elevenLabsAudio)
                tabAudioStreamRef.current = elevenLabsAudio
              } else {
                console.error('❌ Failed to capture ElevenLabs audio even after retry')
                console.error('💡 This means agent speech will NOT be in the recording')
              }
            }, 500)
          }
        } else if (tabAudioStreamRef.current) {
          console.log('ℹ️ Agent speaking - audio already captured and connected')
        }
      })

      service.on('agentStartListening', () => {
        setIsAgentSpeaking(false)
        setIsListening(true)
      })

      service.on('agentProcessing', () => {
        setIsAgentSpeaking(false)
        setIsListening(false)
      })

      service.on('agentIdle', () => {
        setIsAgentSpeaking(false)
        setIsListening(false)
      })

      service.on('statusChange', (status: any) => {
        const statusString = typeof status === 'string' ? status :
                           status?.status ||
                           JSON.stringify(status) ||
                           'unknown'
        setConnectionStatus(statusString)
      })

      service.on('error', (error: any) => {
        console.error('❌ Conversation error:', error)
        const errorMessage = typeof error === 'string' ? error :
                            error?.message ||
                            JSON.stringify(error) ||
                            'Conversation error occurred'
        setError(errorMessage)
      })

      service.on('stopped', () => {
        setIsSessionActive(false)
        setIsConnected(false)
        setIsAgentSpeaking(false)
        setIsListening(false)
        // Note: stopSessionRecording() is now handled explicitly in stopSession()
      })

      // Initialize the service
      await service.initialize()

      setConversationService(service)
      setIsInitialized(true)

      console.log('✅ ElevenLabs Avatar Session initialized successfully')

      // Release guard flag after successful initialization
      isStartingSessionRef.current = false
      console.log('🔓 Session start guard released (success)')

    } catch (error) {
      console.error('❌ Failed to initialize avatar session:', error)
      const errorMessage = error instanceof Error ? error.message :
                          typeof error === 'string' ? error :
                          JSON.stringify(error) ||
                          'Failed to initialize session'
      setError(errorMessage)

      // Release guard flag on error so user can retry
      isStartingSessionRef.current = false
      console.log('🔓 Session start guard released (error)')
    }
  }, [agentId, language, volume, conversationService, isInitialized])

  /**
   * Start session recording with advanced TTS audio mixing
   */
  const startSessionRecording = useCallback(async () => {
    if (recordingPreference === 'none') return

    try {
      console.log(`🎥 Starting ${recordingPreference} recording...`)

      if (recordingPreference === 'audio') {
        // Audio-only: No video recording needed
        console.log('🎵 Audio-only session - ElevenLabs audio will be captured in conversation')
        setIsRecording(true)
        sessionStartTimeRef.current = Date.now()
        return
      }

      // Video recording with ElevenLabs audio mixing using service
      console.log('📹 Starting video recording with service...')
      console.log('💡 Will capture ElevenLabs audio when agent starts speaking')

      await videoService.current.startRecording({
        aspectRatio: videoAspectRatio,
        enableAudioMixing: true,
        videoBitrate: undefined // Let service auto-detect
        // Note: tabAudioStream will be added dynamically when agent starts speaking
      })

      setIsRecording(true)
      sessionStartTimeRef.current = Date.now()

      console.log('✅ Video recording started successfully')

      // Attach preview stream to video element
      const previewStream = videoService.current.getPreviewStream()
      if (previewStream && videoRef.current) {
        console.log('📹 Attaching preview stream to video element...')
        videoRef.current.srcObject = previewStream
        await videoRef.current.play().catch(err => {
          console.warn('⚠️ Preview play failed:', err)
        })
        console.log('✅ Video preview attached')
      }

    } catch (error) {
      console.error(`❌ Failed to start ${recordingPreference} recording:`, error)
      setIsRecording(false)
      // Don't throw - continue session without recording
    }
  }, [recordingPreference, videoAspectRatio, preAuthorizedTabAudio])

  /**
   * Stop session recording with TTS audio
   * Returns a promise that resolves when recording has fully stopped
   */
  const stopSessionRecording = useCallback(async (): Promise<void> => {
    if (recordingPreference === 'none') return

    console.log(`🛑 Stopping ${recordingPreference} recording...`)
    setIsRecording(false)

    // Stop video recording using service
    if (recordingPreference === 'audio_video' && videoService.current.isRecording()) {
      await videoService.current.stopRecording()
      console.log('✅ Video recording stopped')
    }
  }, [recordingPreference])

  /**
   * Save session recording to Supabase
   */
  const saveSessionRecording = useCallback(async () => {
    const currentSessionId = sessionIdRef.current
    const currentConversationId = conversationService?.getConversationId()

    console.log(`🔍 Recording debug - SessionId: ${currentSessionId}, ConversationId: ${currentConversationId}`)

    if (!currentSessionId) {
      console.log('❌ Session ID is missing')
      return
    }

    try {
      if (recordingPreference === 'audio') {
        // Audio-only: Conversation audio available via ElevenLabs
        if (!currentConversationId) {
          console.log('⚠️ No ElevenLabs conversation ID available for audio retrieval')
          return
        }

        console.log('🎵 Conversation ID stored for audio retrieval:', currentConversationId)
        console.log('💡 Audio will be available on transcript page via lazy loading')

      } else if (recordingPreference === 'audio_video') {
        // Get recording data from service
        const recordingData = await videoService.current.stopRecording()

        if (recordingData.chunks.length > 0) {
          console.log('📹 Uploading video directly to Supabase Storage...')

          // Create video blob with the MIME type from service
          const videoBlob = new Blob(recordingData.chunks, {
            type: recordingData.mimeType
          })

          console.log(`📹 Created video blob: ${videoBlob.size} bytes, type: ${videoBlob.type}`)

          // Detect file extension from MIME type
          let fileExtension = 'webm'
          if (recordingData.mimeType.includes('mp4')) {
            fileExtension = 'mp4'
          } else if (recordingData.mimeType.includes('webm')) {
            fileExtension = 'webm'
          }

          const fileName = `${currentSessionId}-video-${Date.now()}.${fileExtension}`
          const filePath = `recordings/video/${fileName}`

          console.log(`📁 Upload path: ${filePath}`)
          console.log(`📦 File details: ${fileExtension} format, ${videoBlob.size} bytes`)

          // Upload directly to Supabase Storage (bypasses Vercel function limits)
          const { data, error } = await supabase.storage
            .from('training-recordings')
            .upload(filePath, videoBlob, {
              contentType: recordingData.mimeType,
              upsert: false
            })

          if (error) {
            console.error('❌ Supabase Storage upload failed:', error)
            throw new Error(`Video upload failed: ${error.message}`)
          }

          if (!data || !data.path) {
            console.error('❌ Upload succeeded but no path returned')
            throw new Error('Upload succeeded but no path returned')
          }

          console.log('✅ Video uploaded to Supabase:', data.path)

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('training-recordings')
            .getPublicUrl(data.path)

          console.log('✅ Public URL:', publicUrl)

          // Update session with video data
          await trainingSessionsService.updateSessionRecording(currentSessionId, {
            video_recording_url: publicUrl,
            video_file_size: videoBlob.size,
            recording_duration_seconds: recordingData.duration
          })

          console.log('✅ Session updated with video recording URL')
        } else {
          console.log('⚠️ No video chunks to upload')
        }

        // Conversation ID also stored for transcript access
        if (currentConversationId) {
          console.log('🎵 Conversation ID stored for transcript access:', currentConversationId)
          console.log('💡 Transcript will be available on session details page')
        }
      }

    } catch (error) {
      console.error('❌ Failed to save recording:', error)
    }
  }, [recordingPreference, conversationService])

  /**
   * Start the avatar session
   */
  const startSession = useCallback(async () => {
    // GUARD: Prevent multiple simultaneous session starts using synchronous ref
    if (isStartingSessionRef.current || isInitialized || conversationService) {
      console.warn('⚠️ Session already starting or active - ignoring duplicate click')
      return
    }

    // Set guard flag IMMEDIATELY (synchronously) to block subsequent clicks
    isStartingSessionRef.current = true
    console.log('🔒 Session start guard activated')

    console.log('🚀 Starting session - will initialize recording BEFORE ElevenLabs')

    // STEP 0: Generate sessionId and record attempt immediately
    const newSessionId = crypto.randomUUID()
    setSessionId(newSessionId)
    sessionIdRef.current = newSessionId
    console.log('🆔 Generated session ID:', newSessionId)

    // Record the attempt immediately (counts even if user abandons session)
    if (user && scenarioId) {
      try {
        const trainingMode = scenarioContext?.type === 'theory' ? 'theory' : 'service_practice'
        console.log('📊 Recording session start for attempt counting...')

        const response = await fetch('/api/start-training-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: newSessionId,
            employeeId: user.id,
            assignmentId: 'standalone', // Will be updated if part of assignment
            companyId: companyId,
            scenarioId: scenarioId,
            trainingMode: trainingMode,
            language: language,
            agentId: agentId
          })
        })

        if (!response.ok) {
          console.warn('⚠️ Failed to record session start, but continuing anyway')
        } else {
          console.log('✅ Session start recorded - attempt counted')
        }
      } catch (error) {
        console.warn('⚠️ Error recording session start:', error)
        // Continue anyway - don't block the session
      }
    }

    // Start countdown timer if time limit is set (independent of recording)
    if (sessionTimeLimit) {
      const timeInSeconds = sessionTimeLimit * 60
      setTimeRemaining(timeInSeconds)
      setIsTimerActive(true)
      console.log(`⏱️ Started countdown timer: ${sessionTimeLimit} minutes (${timeInSeconds} seconds)`)
    }

    // STEP 1: Start recording FIRST (get camera/mic permissions before agent speaks)
    if (recordingPreference !== 'none') {
      console.log('🎬 Pre-initializing recording to get permissions before agent starts speaking...')
      await startSessionRecording()
      console.log('✅ Recording ready - now safe to start ElevenLabs agent')
    }

    // STEP 2: Load knowledge and questions
    const loadedContext = await loadKnowledgeContext()
    console.log('🔄 Knowledge loaded in startSession:', loadedContext ? `${loadedContext.documents?.length || 0} documents` : 'No context')

    const loadedQuestions = await loadStructuredQuestions()
    console.log('🔄 Questions loaded in startSession:', loadedQuestions.length, 'questions')

    // STEP 3: Initialize ElevenLabs conversation (agent can start speaking now)
    console.log('🎙️ Recording is ready - initializing ElevenLabs conversation...')
    await initializeConversation(loadedContext, loadedQuestions)
  }, [isInitialized, conversationService, recordingPreference, startSessionRecording, loadKnowledgeContext, loadStructuredQuestions, initializeConversation, user, scenarioId, companyId, scenarioContext, language, agentId, sessionTimeLimit])

  /**
   * Stop the avatar session
   */
  const stopSession = useCallback(async () => {
    // Guard: Prevent duplicate saves
    if (isSavingSessionRef.current) {
      console.log('⚠️ Session save already in progress, skipping duplicate call')
      return
    }

    if (!conversationService || !user) {
      console.warn('⚠️ Cannot save session: missing conversation service or user')
      return
    }

    try {
      // Set the guard flag immediately
      isSavingSessionRef.current = true

      // Stop the timer immediately to prevent further calls
      setIsTimerActive(false)

      // Show saving indicator immediately
      setIsSavingSession(true)
      console.log('🛑 Stopping training session...')

      // Get conversation ID from the service before stopping
      const conversationId = conversationService.getConversationId()
      console.log('🆔 ElevenLabs conversation ID:', conversationId)

      // Stop the conversation service
      await conversationService.stop()
      setConversationService(null)
      setIsInitialized(false)
      setIsSessionActive(false)

      // Reset start session guard to allow new session
      isStartingSessionRef.current = false
      console.log('🔓 Session start guard reset (session stopped)')

      // IMPORTANT: Wait for recording to fully stop before saving
      if (recordingPreference !== 'none') {
        console.log('⏳ Waiting for recording to stop completely...')
        await stopSessionRecording()
        console.log('✅ Recording stopped successfully')

        // Release camera/mic resources
        if (videoService.current) {
          const previewStream = videoService.current.getPreviewStream()
          if (previewStream) {
            previewStream.getTracks().forEach(track => {
              track.stop()
              console.log('🔇 Stopped track:', track.kind)
            })
          }
        }
      }

      // Skip automatic transcript fetching - user will trigger it manually
      console.log('ℹ️ Skipping automatic transcript fetching - user can trigger it manually from completion page')

      // Use minimal session record for now
      let finalConversationHistory = [
        {
          role: 'assistant',
          content: 'Training session completed - use "Get Transcript and Analysis" button to fetch results',
          timestamp: Date.now()
        }
      ]

      // Determine training mode
      const trainingMode = scenarioContext?.type === 'theory' ? 'theory' : 'service_practice'

      // Calculate session times
      const endTime = new Date()
      const startTime = new Date(sessionStartTimeRef.current || Date.now())

      // Get employee ID from authenticated user (always use auth user ID for consistency)
      const employeeId = user.id

      // Save the session to database using the existing sessionId
      if (!sessionId) {
        console.error('❌ No sessionId available for saving session')
        alert('Session ID not found. Cannot save session.')
        return
      }

      console.log('💾 Saving training session with predefined ID:', sessionId)

      // Use the conversationId we captured earlier
      console.log('🆔 Storing ElevenLabs conversation ID:', conversationId)

      // Create session record with the existing sessionId
      const sessionRecord = {
        id: sessionId,
        employee_id: employeeId,
        assignment_id: scenarioId || 'unknown',
        company_id: companyId,
        scenario_id: scenarioId || null, // Track scenario for attempt counting
        session_name: `${trainingMode === 'theory' ? 'Theory Q&A' : 'Service Practice'} Session - ${endTime.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })} at ${endTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })}`,
        training_mode: trainingMode,
        language: language,
        agent_id: agentId,
        knowledge_context: knowledgeContext || null,
        conversation_transcript: finalConversationHistory,
        session_duration_seconds: Math.round((endTime.getTime() - startTime.getTime()) / 1000),
        started_at: startTime.toISOString(),
        ended_at: endTime.toISOString(),
        // ElevenLabs integration
        elevenlabs_conversation_id: conversationId || null,
        // Recording data
        recording_preference: recordingPreference,
        recording_consent_timestamp: recordingPreference !== 'none' ? startTime.toISOString() : null,
        // Recording URLs will be set by saveSessionRecording if applicable
        audio_recording_url: null,
        video_recording_url: null,
        audio_file_size: null,
        video_file_size: null,
        recording_duration_seconds: recordingPreference !== 'none' ? Math.round((endTime.getTime() - startTime.getTime()) / 1000) : null
      }

      // Save session via API endpoint (bypasses RLS issues)
      console.log('📤 Saving session via API endpoint...')
      console.log('📝 Session record:', {
        id: sessionRecord.id,
        employee_id: sessionRecord.employee_id,
        training_mode: sessionRecord.training_mode,
        recording_preference: sessionRecord.recording_preference
      })

      const saveResponse = await fetch('/api/save-training-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionRecord),
      })

      const saveResult = await saveResponse.json()

      if (!saveResult.success) {
        console.error('❌ API returned error:', saveResult.error)
        throw new Error(saveResult.error || 'Failed to save session')
      }

      console.log('✅ Session saved successfully via API')

      // Save recording using hybrid approach (ElevenLabs API + webcam if applicable)
      if (recordingPreference !== 'none') {
        console.log('🎬 Saving session recording using hybrid approach...')

        try {
          // Add timeout to prevent indefinite waiting
          const uploadTimeout = 30000 // 30 seconds
          await Promise.race([
            saveSessionRecording(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Upload timeout')), uploadTimeout)
            )
          ])
          console.log('✅ Recording saved successfully')
        } catch (uploadError) {
          console.error('⚠️ Recording upload failed or timed out:', uploadError)
          // Continue anyway - user can still access transcript
          console.log('📝 Continuing to transcript page despite upload issue...')
        }
      }

      console.log('🔄 Redirecting to transcript...')

      // Reset saving state before navigation
      setIsSavingSession(false)

      // Small delay to ensure UI updates
      await new Promise(resolve => setTimeout(resolve, 100))

      // Redirect to the transcript page
      router.push(`/employee/sessions/${sessionId}`)

    } catch (error: any) {
      console.error('❌ Failed to save training session:', error)
      const errorMessage = error?.message || 'Unknown error'
      console.error('Error details:', errorMessage)

      // Reset the guard flags to allow retry
      isSavingSessionRef.current = false
      isStartingSessionRef.current = false

      // Still allow the user to continue, just show an error
      alert(`Failed to save training session: ${errorMessage}\n\nPlease try again or contact support.`)
      setIsSavingSession(false)
    }
  }, [conversationService, user, scenarioContext, scenarioId, companyId, language, agentId, knowledgeContext, router, sessionId, recordingPreference, saveSessionRecording, stopSessionRecording])

  /**
   * Handle volume change
   */
  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume)
    if (conversationService) {
      conversationService.setVolume(newVolume)
    }
  }, [conversationService])

  /**
   * Load knowledge context when component mounts or scenario changes
   */
  useEffect(() => {
    loadKnowledgeContext()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId, companyId])

  /**
   * Re-attach video preview stream when session becomes active (after re-render)
   */
  useEffect(() => {
    if (isSessionActive && videoRef.current && recordingPreference === 'audio_video' && videoService.current.isRecording()) {
      const previewStream = videoService.current.getPreviewStream()
      if (previewStream && videoRef.current.srcObject !== previewStream) {
        console.log('📹 Re-attaching preview stream after session activation...')
        videoRef.current.srcObject = previewStream
        videoRef.current.play().catch(err => {
          console.warn('⚠️ Preview play failed:', err)
        })
        console.log('✅ Preview stream re-attached')
      }
    }
  }, [isSessionActive, recordingPreference])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (conversationService) {
        conversationService.disconnect()
      }
    }
  }, [])

  // Determine training mode from scenario context
  const trainingMode = scenarioContext?.type === 'theory' ? 'theory' : 'service_practice'
  const isTheoryMode = trainingMode === 'theory'

  return (
    <div className={`w-full max-w-4xl mx-auto ${className} relative`}>
      {/* Saving Session Overlay */}
      {isSavingSession && (
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
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {isTheoryMode ? '📖 Theory Q&A Session' : '🗣️ Service Practice Session'}
              </h2>
              <p className="text-gray-600">
                {isTheoryMode
                  ? 'Structured knowledge assessment - Answer questions accurately and concisely'
                  : 'Interactive roleplay scenario - Practice real customer service situations'
                }
              </p>
            </div>

            {/* Countdown Timer - Big Display */}
            {isTimerActive && timeRemaining !== null && (
              <div className="flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl px-8 py-4 shadow-lg">
                <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Time Remaining</div>
                <div className={`text-6xl font-bold tabular-nums ${
                  timeRemaining <= 60 ? 'text-red-600 animate-pulse' :
                  timeRemaining <= 180 ? 'text-orange-600' :
                  'text-blue-600'
                }`}>
                  {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                </div>
                <div className="text-xs text-gray-500 mt-1">minutes</div>
              </div>
            )}

            <div className="text-right space-y-1">
              <div className="flex items-center justify-end space-x-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  connectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
                  connectionStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {typeof connectionStatus === 'string' ? connectionStatus : JSON.stringify(connectionStatus)}
                </span>
                {recordingPreference !== 'none' && (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    isRecording ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {isRecording ? (
                      <>
                        <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-1 animate-pulse"></span>
                        {recordingPreference === 'audio' ? '🎤 Recording' : '🎥 Recording'}
                      </>
                    ) : (
                      <>{recordingPreference === 'audio' ? '🎤 Ready' : '🎥 Ready'}</>
                    )}
                  </span>
                )}
              </div>
              {isTheoryMode && (
                <div className="mt-1 text-xs text-gray-500">
                  Flashcard Mode
                </div>
              )}
              {recordingPreference !== 'none' && (
                <div className="mt-1 text-xs text-gray-500">
                  {recordingPreference === 'audio' ? 'Audio Recording Enabled' : 'Screen + Audio Recording Enabled'}
                </div>
              )}
            </div>
          </div>

          {/* Scenario Context Section - Service Practice Only */}
          {!isTheoryMode && scenarioContext && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
              {/* Scenario Title/Description */}
              <div>
                {scenarioContext.title && (
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    🎭 {scenarioContext.title}
                  </h3>
                )}
                {scenarioContext.description && (
                  <p className="text-gray-700">{scenarioContext.description}</p>
                )}
              </div>

              {/* Your Goals */}
              {scenarioContext.expected_response && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    🎯 Your Goals
                  </h4>
                  <p className="text-gray-700 whitespace-pre-line">{scenarioContext.expected_response}</p>
                </div>
              )}

              {/* Key Milestones */}
              {scenarioContext.milestones && scenarioContext.milestones.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    ✅ Key Milestones
                  </h4>
                  <ol className="space-y-1">
                    {scenarioContext.milestones.map((milestone: string, i: number) => (
                      <li key={i} className="text-gray-700 flex items-start gap-2">
                        <span className="text-blue-600 font-medium min-w-[20px]">{i + 1}</span>
                        <span>{milestone}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-medium">Error:</p>
              <p className="text-red-600">{typeof error === 'string' ? error : JSON.stringify(error)}</p>
            </div>
          )}

          {/* Mode-specific Instructions */}
          {/* Session Questions Preview - Only show for Theory mode */}
          {scenarioContext?.type === 'theory' && (
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
          )}

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
          {isLoadingQuestions && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800">📋 Loading structured questions...</p>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-4">
            {!isSessionActive ? (
              <button
                onClick={startSession}
                disabled={isInitialized || conversationService !== null}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                <Play className="w-4 h-4 mr-2" />
                {isInitialized ? 'Connecting...' : 'Start Session'}
              </button>
            ) : (
              <button
                onClick={stopSession}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Square className="w-4 h-4 mr-2" />
                End Session
              </button>
            )}

            {/* Volume Control */}
            <div className="flex items-center gap-2">
              {volume > 0 ? (
                <Volume2 className="w-4 h-4 text-gray-600" />
              ) : (
                <VolumeX className="w-4 h-4 text-gray-600" />
              )}
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-20"
              />
            </div>
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

          {/* Session Info - moved above conversation history */}
          <div className="text-sm text-gray-600 bg-gray-50 rounded p-3">
            <p><strong>Agent ID:</strong> {agentId}</p>
            <p><strong>Language:</strong> {language}</p>
            <p><strong>Company:</strong> {companyId}</p>
            {sessionId && <p><strong>Session ID:</strong> {sessionId}</p>}
          </div>

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
    </div>
  )
}