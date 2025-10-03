'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff, Volume2, VolumeX, Play, Square } from 'lucide-react'
import { ElevenLabsConversationService, ConversationMessage } from '@/lib/elevenlabs-conversation'
import type { ScenarioKnowledgeContext } from '@/lib/elevenlabs-knowledge'
import { trainingSessionsService, type RecordingPreference } from '@/lib/training-sessions'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface ElevenLabsAvatarSessionProps {
  companyId: string
  scenarioId?: string
  scenarioContext?: any
  scenarioQuestions?: any[]
  language?: string
  agentId: string // ElevenLabs Agent ID
  recordingPreference?: RecordingPreference
  preAuthorizedTabAudio?: MediaStream | null  // Pre-authorized tab audio for Safari
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
  recordingPreference = 'none',
  preAuthorizedTabAudio = null,
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

  // Session recording with advanced audio mixing
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const sessionStartTimeRef = useRef<number>(0)
  const videoChunksRef = useRef<Blob[]>([])
  const recordingMimeTypeRef = useRef<string>('video/webm')

  // Audio mixing for TTS capture
  const audioContextRef = useRef<AudioContext | null>(null)
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const recordingDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null)
  const combinedStreamRef = useRef<MediaStream | null>(null)
  const tabAudioStreamRef = useRef<MediaStream | null>(null)

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

    try {
      setIsLoadingKnowledge(true)
      setError(null)

      console.log(`🧠 Loading knowledge context for scenario: ${scenarioId}`)

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

      // Generate sessionId for this training session
      const newSessionId = crypto.randomUUID()
      setSessionId(newSessionId)
      sessionIdRef.current = newSessionId
      console.log('🆔 Generated session ID:', newSessionId)

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

      // Hard-coded knowledge base content (will be replaced with dynamic loading later)
      const HARDCODED_KNOWLEDGE_BASE = `
COFFEE SHOP MENU AND PRICES:

НАПИТКИ (DRINKS):
- Эспрессо
- Черный кофе (американо/фильтр) 250/350/450 мл
- Капучино 250/350/450 мл
- Латте 350/450 мл
- Флэт Уайт 250/350 мл
- Раф ванильный/цитрусовый/прянный 350 мл
- Какао 350 мл
- Чай грушевый с чабрецом и медом 350 мл
- Маття латте 350 мл
- Латте Карамель 350 мл
- Латте халва 350 мл
- Молочный улун/сенча/ассам 350 мл

БАЗОВАЯ ВЫПЕЧКА (BASIC PASTRIES):
Available in all coffee shops from our production:
- Паштель де ната (Pastel de nata)
- Трубочка со сгущенкой (Tube with condensed milk)
- Орешек со сгущенкой (Nut with condensed milk)
- Чизкейк сан себастьян (San Sebastian cheesecake)
- Кекс банановый (Banana cake)
- Кекс морковный (Carrot cake)
- Кекс яблочный (Apple cake)
- Кекс апельсиновый (Orange cake)
- Кекс шоколадный (Chocolate cake)
- Кекс столичный (Stolichniy cake)
- Кекс лимонный (Lemon cake)
- Кекс чернослив (Prune cake)
- Кекс рождественский (Christmas cake)
`

      // Hard-coded examiner instructions (will be replaced with dynamic loading later)
      const HARDCODED_EXAMINER_INSTRUCTIONS = `
You are a STRICT THEORY EXAMINER for a Russian coffee shop chain. Your role:

CRITICAL BEHAVIOR RULES:
- Ask ONE factual question at a time about company knowledge
- After the student gives ANY answer (correct or incorrect), IMMEDIATELY move to the next question
- Do not repeat the same question - always ask a different question after each response
- Evaluate answers internally as CORRECT or INCORRECT but don't get stuck on wrong answers
- Do not engage in conversation or small talk between questions
- Focus only on testing factual knowledge from the knowledge base
- Be direct and formal in your questioning
- Start with: "Let's begin the theory assessment."

QUESTION PROGRESSION:
1. Ask a question
2. Student answers (any answer)
3. Immediately ask a completely DIFFERENT question
4. Repeat until assessment is complete

KNOWLEDGE SCOPE - Ask questions ONLY about:
DRINKS: Espresso, Black coffee (americano/filter), Cappuccino, Latte, Flat White, Raf (vanilla/citrus/spiced), Cocoa, Pear tea with thyme and honey, Matcha latte, Caramel Latte, Halva Latte, Milk oolong/sencha/assam

PASTRIES: Pastel de nata, Tube with condensed milk, Nut with condensed milk, San Sebastian cheesecake, Various cakes (banana, carrot, apple, orange, chocolate, stolichniy, lemon, prune, Christmas)

EXAMPLE QUESTIONS:
- "What sizes are available for cappuccino?"
- "Name three types of raf coffee we offer"
- "What ingredients are in our pear tea?"
- "List five types of cakes in our basic pastry selection"
- "What is the difference between our americano and filter coffee?"
- "Which pastries are available in all our coffee shops?"

IMPORTANT: Move to the next question immediately after ANY student response. Do not wait for correct answers.
`

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

        const questionList = questionsToFormat.slice(0, 15).map((q, index) => {
          // Handle both old format and new format
          const questionText = q.question_template || q.question
          const topicName = q.topic_name || q.topic?.name || 'Unknown Topic'
          const difficultyLevel = q.difficultyLevel ? ` (Level ${q.difficultyLevel}/3)` : ''

          return `${index + 1}. "${questionText}" (Topic: ${topicName}${difficultyLevel})`
        }).join('\n')

        return `
STRUCTURED QUESTIONS TO ASK (in order of priority):

${questionList}

INSTRUCTIONS:
- Ask these questions one by one in the exact order listed
- After student gives ANY answer, move immediately to the next question
- Do not provide correct answers or explanations during the session
- Ask ALL questions in the list before ending the session
- Track which questions have been asked to avoid repetition
`
      }

      const structuredQuestionsText = formatStructuredQuestions(questionsToUse)

      // Create dynamic variables for ElevenLabs agent
      const dynamicVariables = {
        training_mode: trainingMode,
        company_name: companyId,
        difficulty_level: scenarioContext?.difficulty || 'intermediate',
        session_type: 'assessment',
        language: language,
        // Use dynamic knowledge base content if available, otherwise fallback to hard-coded
        knowledge_context: contextToUse?.formattedContext || HARDCODED_KNOWLEDGE_BASE,
        knowledge_scope: contextToUse?.knowledgeScope || 'restricted',
        documents_available: contextToUse?.documents?.length || 1,
        questions_available: questionsToUse.length,
        // Service practice specific fields
        client_behavior: scenarioContext?.client_behavior || 'Act as a typical customer seeking help',
        expected_response: scenarioContext?.expected_response || 'Employee should be helpful and knowledgeable',
        // Use structured questions if available
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

If no structured questions are provided, ask general questions about the company's products and services.` :
            contextToUse?.formattedContext ?
              `You are a STRICT THEORY EXAMINER for a company training. Ask specific, factual questions based on this knowledge context and move immediately to the next question after any student response.` :
              HARDCODED_EXAMINER_INSTRUCTIONS
          ) :
          `You are a CUSTOMER in a service training roleplay scenario.

CUSTOMER BEHAVIOR INSTRUCTIONS:
${scenarioContext?.client_behavior || 'Act as a typical customer seeking help'}

SCENARIO CONTEXT:
You are roleplaying as a customer in the following situation: ${scenarioContext?.title || 'General customer service scenario'}

COMPANY KNOWLEDGE CONTEXT (for reference - you are the CUSTOMER, not the employee):
${contextToUse?.formattedContext || HARDCODED_KNOWLEDGE_BASE}

EXPECTED EMPLOYEE RESPONSE (for evaluation context):
${scenarioContext?.expected_response || 'Employee should be helpful and knowledgeable'}

ROLEPLAY INSTRUCTIONS:
- Act as the customer described in the behavior instructions above
- Be realistic and stay in character throughout the conversation
- Present the problem or situation naturally
- Respond to the employee's attempts to help as this type of customer would
- Do not break character or provide training guidance
- Let the employee practice their customer service skills by interacting with you as a real customer would

Start the conversation by presenting your customer problem or situation.`
      }

      console.log('🎯 Starting session with dynamic variables:', dynamicVariables)
      console.log('📋 Scenario context received:', scenarioContext)
      console.log('🧠 Knowledge context status:', {
        available: !!knowledgeContext,
        documentsCount: knowledgeContext?.documents?.length || 0,
        hasFormattedContext: !!knowledgeContext?.formattedContext,
        knowledgeScope: knowledgeContext?.knowledgeScope
      })

      const service = new ElevenLabsConversationService({
        agentId,
        language,
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
        // Start recording based on user preference
        if (recordingPreference !== 'none') {
          startSessionRecording()
        }
      })

      service.on('disconnected', () => {
        console.log('🔌 Avatar session disconnected')
        setIsConnected(false)
        setConnectionStatus('disconnected')
        setIsSessionActive(false)
        stopSessionRecording()
      })

      service.on('agentMessage', (message: ConversationMessage) => {
        setCurrentMessage(message.content)
        setConversationHistory(prev => [...prev, message])
      })

      service.on('userMessage', (message: ConversationMessage) => {
        setConversationHistory(prev => [...prev, message])
      })

      service.on('agentStartSpeaking', () => {
        setIsAgentSpeaking(true)
        setIsListening(false)
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
        stopSessionRecording()
      })

      // Initialize the service
      await service.initialize()

      setConversationService(service)
      setIsInitialized(true)

      console.log('✅ ElevenLabs Avatar Session initialized successfully')

    } catch (error) {
      console.error('❌ Failed to initialize avatar session:', error)
      const errorMessage = error instanceof Error ? error.message :
                          typeof error === 'string' ? error :
                          JSON.stringify(error) ||
                          'Failed to initialize session'
      setError(errorMessage)
    }
  }, [agentId, language, volume, conversationService, isInitialized])

  /**
   * Start session recording with advanced TTS audio mixing
   */
  const startSessionRecording = useCallback(async () => {
    if (recordingPreference === 'none') return

    try {
      console.log(`🎥 Starting ADVANCED ${recordingPreference} recording with TTS audio mixing...`)

      if (recordingPreference === 'audio') {
        // Audio-only: No video recording needed, just track audio
        console.log('🎵 Audio-only session - ElevenLabs audio will be captured in conversation')
        setIsRecording(true)
        sessionStartTimeRef.current = Date.now()
        return
      }

      // Video recording with TTS audio mixing
      console.log('📹 Requesting camera and microphone access for video + audio recording...')
      const micStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 1280,
          height: 720,
          facingMode: 'user'
        },
        audio: {
          echoCancellation: false,  // Disable echo cancellation to capture system audio
          noiseSuppression: false,  // Disable noise suppression
          autoGainControl: false    // Disable auto gain control
        }
      })
      console.log('✅ Camera and microphone access granted')

      // Create audio context for mixing ElevenLabs TTS with microphone
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioContextRef.current = audioContext

      // Ensure AudioContext is running (required for iOS and some browsers)
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
        console.log('🎵 AudioContext resumed from suspended state')
      }
      console.log(`🎵 AudioContext state: ${audioContext.state}`)

      // Create audio sources and destination for mixing
      const micSource = audioContext.createMediaStreamSource(micStream)
      const destination = audioContext.createMediaStreamDestination()

      micSourceRef.current = micSource
      recordingDestinationRef.current = destination

      // Connect microphone to recording destination
      micSource.connect(destination)
      console.log('🎧 Microphone connected to recording destination')

      // Try to use pre-authorized tab audio OR request it now
      if (preAuthorizedTabAudio && preAuthorizedTabAudio.getAudioTracks().length > 0) {
        // Use pre-authorized stream (Safari-compatible!)
        try {
          console.log('✅ Using pre-authorized tab audio (Safari-compatible approach)')
          tabAudioStreamRef.current = preAuthorizedTabAudio

          const tabAudioSource = audioContext.createMediaStreamSource(new MediaStream([preAuthorizedTabAudio.getAudioTracks()[0]]))
          const tabGain = audioContext.createGain()
          tabGain.gain.value = 1.0

          tabAudioSource.connect(tabGain)
          tabGain.connect(destination)

          console.log('🎵 Pre-authorized ElevenLabs audio is now being mixed into recording')
          console.log('✅ Recording will contain both your voice AND AI trainer voice')
        } catch (error) {
          console.error('❌ Error using pre-authorized tab audio:', error)
          console.log('💡 Will continue with microphone only')
        }
      } else {
        // Try to request tab audio now (works in Chrome/Edge)
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

        if (!isSafari) {
          // Chrome/Edge support: Try to capture tab audio
          try {
            console.log('🔊 Requesting tab audio capture for ElevenLabs voice...')
            console.log('💡 IMPORTANT: Check "Share tab audio" in the browser prompt!')

            const displayStream = await navigator.mediaDevices.getDisplayMedia({
              video: false,
              audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                suppressLocalAudioPlayback: false
              }
            } as any)

            const audioTracks = displayStream.getAudioTracks()
            if (audioTracks.length > 0) {
              console.log('✅ Tab audio captured successfully!')
              tabAudioStreamRef.current = displayStream

              const tabAudioSource = audioContext.createMediaStreamSource(new MediaStream([audioTracks[0]]))
              const tabGain = audioContext.createGain()
              tabGain.gain.value = 1.0

              tabAudioSource.connect(tabGain)
              tabGain.connect(destination)

              console.log('🎵 ElevenLabs audio is now being mixed into recording')
              console.log('✅ Recording will contain both your voice AND AI trainer voice')

              displayStream.getVideoTracks().forEach(track => track.stop())
            } else {
              console.warn('⚠️ No audio tracks - AI voice may not be recorded')
            }
          } catch (displayError: any) {
            console.error('❌ Could not capture tab audio:', displayError)
            console.log('⚠️ Recording will continue with microphone only')
            console.log('💡 AI voice will NOT be in the recording')
          }
        } else {
          // Safari: Tab audio capture not available in this context
          console.log('🍎 Safari detected: No pre-authorized tab audio available')
          console.log('💡 Safari limitation: Cannot capture ElevenLabs audio in recording')
          console.log('💡 Recording will include your microphone only')
          console.log('💡 Alternative: Use Chrome for full audio recording')
        }
      }

      // Create combined stream with video + mixed audio
      const videoTrack = micStream.getVideoTracks()[0]
      const mixedAudioTrack = destination.stream.getAudioTracks()[0]

      console.log('🎬 Stream debug info:')
      console.log(`  - Video track: ${videoTrack ? 'available' : 'missing'}`)
      console.log(`  - Mixed audio track: ${mixedAudioTrack ? 'available' : 'missing'}`)
      console.log(`  - Mixed audio track enabled: ${mixedAudioTrack?.enabled}`)
      console.log(`  - Mixed audio track muted: ${mixedAudioTrack?.muted}`)

      const combinedStream = new MediaStream([videoTrack, mixedAudioTrack])
      combinedStreamRef.current = combinedStream

      console.log(`🎬 Combined stream: ${combinedStream.getTracks().length} tracks (${combinedStream.getVideoTracks().length} video, ${combinedStream.getAudioTracks().length} audio)`)

      // Dynamic MIME type detection for cross-platform compatibility
      const getSupportedMimeType = () => {
        const types = [
          'video/mp4',                    // iOS Safari requirement
          'video/webm;codecs=vp8,opus',  // Modern browsers with audio
          'video/webm;codecs=vp8',       // Fallback without audio codec
          'video/webm'                   // Legacy fallback
        ]

        for (const type of types) {
          if (MediaRecorder.isTypeSupported(type)) {
            console.log(`📹 Using supported MIME type: ${type}`)
            return type
          }
        }
        console.warn('⚠️ No supported video MIME type found, falling back to video/webm')
        return 'video/webm'
      }

      const mimeType = getSupportedMimeType()
      recordingMimeTypeRef.current = mimeType

      const mediaRecorder = new MediaRecorder(combinedStream, { mimeType })
      mediaRecorderRef.current = mediaRecorder

      // Clear any existing chunks
      videoChunksRef.current = []
      recordedChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunksRef.current.push(event.data)
          console.log(`📹 Video chunk recorded: ${event.data.size} bytes, total chunks: ${videoChunksRef.current.length}`)
        } else {
          console.log('⚠️ Video chunk is empty')
        }
      }

      mediaRecorder.onstop = () => {
        console.log(`🔄 Recording stopped, transferring ${videoChunksRef.current.length} chunks`)
        recordedChunksRef.current = [...videoChunksRef.current]
        setIsRecording(false)

        // Clean up streams
        micStream.getTracks().forEach(track => track.stop())
        if (combinedStream) {
          combinedStream.getTracks().forEach(track => track.stop())
        }

        // Clean up tab audio stream if it was captured
        if (tabAudioStreamRef.current) {
          tabAudioStreamRef.current.getTracks().forEach(track => track.stop())
          tabAudioStreamRef.current = null
        }

        // Close audio context
        if (audioContext.state !== 'closed') {
          audioContext.close()
        }

        console.log('📹 Video recording stopped with mixed audio')
      }

      mediaRecorder.start(1000) // Record in 1-second chunks
      setIsRecording(true)
      sessionStartTimeRef.current = Date.now()

      console.log('📹 Started video recording with TTS audio mixing capability')

    } catch (error) {
      console.error(`❌ Failed to start ${recordingPreference} recording:`, error)
      setIsRecording(false)
      // Don't throw - continue session without recording
    }
  }, [recordingPreference])

  /**
   * Stop session recording with TTS audio
   */
  const stopSessionRecording = useCallback(() => {
    if (recordingPreference === 'none') return

    console.log(`🛑 Stopping ADVANCED ${recordingPreference} recording...`)
    setIsRecording(false)

    // Stop MediaRecorder for video sessions
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log('📹 Stopping video + audio recording...')
      mediaRecorderRef.current.stop()
      // Note: cleanup happens in mediaRecorder.onstop handler
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
        // Video recording with TTS audio mixed in

        if (recordedChunksRef.current.length > 0) {
          console.log('📹 Uploading video with mixed TTS audio...')

          // Create video blob with the MIME type used during recording
          const videoBlob = new Blob(recordedChunksRef.current, {
            type: recordingMimeTypeRef.current
          })

          console.log(`📹 Created video blob: ${videoBlob.size} bytes, type: ${videoBlob.type}`)

          const formData = new FormData()
          formData.append('recording', videoBlob)
          formData.append('sessionId', currentSessionId)
          formData.append('recordingType', 'video')

          const response = await fetch('/api/upload-recording', {
            method: 'POST',
            body: formData
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Video upload failed')
          }

          const uploadResult = await response.json()
          console.log('✅ Video with mixed TTS audio uploaded successfully:', uploadResult.path)

          // Update session with video data
          await trainingSessionsService.updateSessionRecording(currentSessionId, {
            video_recording_url: uploadResult.url,
            video_file_size: uploadResult.size,
            recording_duration_seconds: Math.round((Date.now() - sessionStartTimeRef.current) / 1000)
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
    } finally {
      // Clear all chunks after upload
      recordedChunksRef.current = []
      videoChunksRef.current = []
    }
  }, [recordingPreference, conversationService])

  /**
   * Start the avatar session
   */
  const startSession = useCallback(async () => {
    // Load knowledge context first if we have a scenario
    const loadedContext = await loadKnowledgeContext()
    console.log('🔄 Knowledge loaded in startSession:', loadedContext ? `${loadedContext.documents?.length || 0} documents` : 'No context')

    // Load structured questions for theory sessions
    const loadedQuestions = await loadStructuredQuestions()
    console.log('🔄 Questions loaded in startSession:', loadedQuestions.length, 'questions')

    // Then initialize the conversation with the loaded context and questions
    await initializeConversation(loadedContext, loadedQuestions)
  }, [loadKnowledgeContext, loadStructuredQuestions, initializeConversation])

  /**
   * Stop the avatar session
   */
  const stopSession = useCallback(async () => {
    if (!conversationService || !user) {
      console.warn('⚠️ Cannot save session: missing conversation service or user')
      return
    }

    try {
      console.log('🛑 Stopping training session...')

      // Get conversation ID from the service before stopping
      const conversationId = conversationService.getConversationId()
      console.log('🆔 ElevenLabs conversation ID:', conversationId)

      // Stop the conversation service
      await conversationService.stop()
      setConversationService(null)
      setIsInitialized(false)
      setIsSessionActive(false)

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

      // Get employee ID from authenticated user
      const employeeId = user.employee_record_id || user.id

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

      // Insert the session record directly
      const { error } = await supabase
        .from('training_sessions')
        .insert(sessionRecord)

      if (error) {
        console.error('❌ Failed to save training session:', error)
        throw error
      }

      console.log('✅ Session saved successfully')

      // Save recording using hybrid approach (ElevenLabs API + webcam if applicable)
      if (recordingPreference !== 'none') {
        console.log('🎬 Saving session recording using hybrid approach...')
        await saveSessionRecording()
      }

      console.log('🔄 Redirecting to transcript...')
      // Redirect to the transcript page
      router.push(`/employee/sessions/${sessionId}`)

    } catch (error) {
      console.error('❌ Failed to save training session:', error)
      // Still allow the user to continue, just show an error
      alert('Failed to save training session. Please try again or contact support.')
    }
  }, [conversationService, user, scenarioContext, scenarioId, companyId, language, agentId, knowledgeContext, router, sessionId, recordingPreference, saveSessionRecording])

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
    <div className={`w-full max-w-4xl mx-auto ${className}`}>
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

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-medium">Error:</p>
              <p className="text-red-600">{typeof error === 'string' ? error : JSON.stringify(error)}</p>
            </div>
          )}

          {/* Mode-specific Instructions */}
          {/* Session Questions Preview - Replacing useless instructions */}
          {scenarioContext?.type === 'theory' ? (
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
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-2">
                🎭 Service Practice Instructions
              </h3>
              <div className="text-sm space-y-1 text-green-800">
                <p>• <strong>Engage naturally</strong> with the customer</p>
                <p>• <strong>Ask clarifying questions</strong> when needed</p>
                <p>• <strong>Use company knowledge</strong> to help solve problems</p>
                <p>• <strong>Practice handling</strong> different customer situations</p>
                <p>• <strong>Build rapport</strong> and provide excellent service</p>
              </div>
            </div>
          )}

          {/* Session Status - Simplified */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              ⚙️ Session Configuration
            </h3>
            <div className="text-gray-700 text-sm space-y-1">
              <p><strong>Training Mode:</strong> {scenarioContext?.type === 'theory' ? '📖 Theory Assessment' : '🗣️ Service Practice'}</p>
              <p><strong>Language:</strong> {language === 'ru' ? '🇷🇺 Russian' : language === 'en' ? '🇺🇸 English' : language}</p>
              <p><strong>Database Questions:</strong> {sessionQuestions.length > 0 ? `✅ ${sessionQuestions.length} loaded` : '⏳ Click refresh to load'}</p>
            </div>
          </div>


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

          {/* Structured Questions Status */}
          {structuredQuestions.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-2">
                📋 Structured Questions Loaded
              </h3>
              <div className="text-green-800 text-sm space-y-1">
                <p><strong>Questions Available:</strong> {structuredQuestions.length} questions</p>
                <p><strong>Unanswered:</strong> {structuredQuestions.filter(q => q.status === 'unanswered').length}</p>
                <p><strong>Incorrect:</strong> {structuredQuestions.filter(q => q.status === 'incorrect').length}</p>
                <p><strong>Correct:</strong> {structuredQuestions.filter(q => q.status === 'correct').length}</p>
                <p className="text-xs text-green-600 mt-1">
                  ElevenLabs agent will ask these specific questions during the session
                </p>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-4">
            {!isSessionActive ? (
              <button
                onClick={startSession}
                disabled={isInitialized}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

          {/* Current Message Display */}
          {currentMessage && (
            <div className={`border rounded-lg p-4 ${
              isTheoryMode
                ? 'bg-orange-50 border-orange-200'
                : 'bg-blue-50 border-blue-200'
            }`}>
              <p className={`font-medium ${
                isTheoryMode ? 'text-orange-800' : 'text-blue-800'
              }`}>
                {isTheoryMode ? '❓ Question:' : '🗨️ Customer:'}
              </p>
              <p className={isTheoryMode ? 'text-orange-700' : 'text-blue-700'}>
                {currentMessage}
              </p>
            </div>
          )}

          {/* Conversation History */}
          {conversationHistory.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              <h3 className="font-medium text-gray-900">
                {isTheoryMode ? '📝 Q&A History:' : '💬 Conversation History:'}
              </h3>
              {conversationHistory.map((message, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg ${
                    message.role === 'assistant'
                      ? (isTheoryMode ? 'bg-orange-50 border border-orange-200' : 'bg-blue-50 border border-blue-200')
                      : 'bg-green-50 border border-green-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <p className={`font-medium ${
                      message.role === 'assistant'
                        ? (isTheoryMode ? 'text-orange-800' : 'text-blue-800')
                        : 'text-green-800'
                    }`}>
                      {message.role === 'assistant'
                        ? (isTheoryMode ? '❓ Examiner' : '🗨️ Customer')
                        : '👤 You'
                      }
                    </p>
                    <span className="text-xs text-gray-500">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className={
                    message.role === 'assistant'
                      ? (isTheoryMode ? 'text-orange-700' : 'text-blue-700')
                      : 'text-green-700'
                  }>
                    {message.content}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Session Info */}
          <div className="text-sm text-gray-600 bg-gray-50 rounded p-3">
            <p><strong>Agent ID:</strong> {agentId}</p>
            <p><strong>Language:</strong> {language}</p>
            <p><strong>Company:</strong> {companyId}</p>
            {sessionId && <p><strong>Session ID:</strong> {sessionId}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}