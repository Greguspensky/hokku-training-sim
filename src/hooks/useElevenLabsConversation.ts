/**
 * useElevenLabsConversation Hook
 * Consolidates ElevenLabs conversation management logic
 * Reduces ElevenLabsAvatarSession complexity by extracting 365-line initializeConversation
 * and all related state/event handling
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ElevenLabsConversationService, ConversationMessage } from '@/lib/elevenlabs-conversation';
import type { ScenarioKnowledgeContext } from '@/lib/elevenlabs-knowledge';
import { trainingSessionsService, type RecordingPreference } from '@/lib/training-sessions';
import { VideoRecordingService } from '@/services/VideoRecordingService';
import { resolveVoiceForSession } from '@/lib/voice-resolver';
import { supabase } from '@/lib/supabase';
import type { UseTrainingSessionResult } from '@/hooks/useTrainingSession';

export interface UseElevenLabsConversationOptions {
  companyId: string;
  scenarioId?: string;
  scenarioContext?: any;
  scenarioQuestions?: any[];
  language?: string;
  agentId: string;
  voiceIds?: string[];
  voiceId?: string;
  recordingPreference?: RecordingPreference;
  videoAspectRatio?: '16:9' | '9:16' | '4:3' | '1:1';
  preAuthorizedTabAudio?: MediaStream | null;
  user?: any;
  session: UseTrainingSessionResult;
  onSessionEnd?: (sessionData: any) => void;
}

export interface UseElevenLabsConversationResult {
  // State
  conversationService: ElevenLabsConversationService | null;
  isInitialized: boolean;
  isSessionActive: boolean;
  isConnected: boolean;
  isAgentSpeaking: boolean;
  isListening: boolean;
  connectionStatus: string;
  conversationHistory: ConversationMessage[];
  currentMessage: string;
  volume: number;
  knowledgeContext: ScenarioKnowledgeContext | null;
  isLoadingKnowledge: boolean;
  isRecording: boolean;
  error: string | null;
  structuredQuestions: any[];
  isLoadingQuestions: boolean;
  sessionQuestions: any[];
  isLoadingSessionQuestions: boolean;

  // Refs
  videoService: React.RefObject<VideoRecordingService>;
  videoRef: React.RefObject<HTMLVideoElement | null>;

  // Actions
  startSession: () => Promise<void>;
  stopSession: () => Promise<void>;
  handleVolumeChange: (newVolume: number) => void;
  loadKnowledgeContext: () => Promise<ScenarioKnowledgeContext | null>;
  loadSessionQuestions: () => Promise<void>;
}

// Helper function for training mode display
function getTrainingModeDisplay(trainingMode: string): string {
  const modeMap: Record<string, string> = {
    'theory': 'Theory Q&A',
    'service_practice': 'Service Practice',
    'flipboard': 'Flipboard',
    'recommendation_tts': 'Recommendation',
    'recommendation': 'Recommendation'
  };
  return modeMap[trainingMode] || trainingMode;
}

/**
 * Hook for managing ElevenLabs conversation sessions
 * Handles initialization, recording, audio mixing, and session lifecycle
 *
 * @example
 * ```typescript
 * const conversation = useElevenLabsConversation({
 *   companyId: 'company-123',
 *   scenarioId: 'scenario-456',
 *   agentId: 'agent_abc',
 *   language: 'en',
 *   user,
 *   session
 * });
 *
 * // Start conversation
 * await conversation.startSession();
 *
 * // Stop and save
 * await conversation.stopSession();
 * ```
 */
export function useElevenLabsConversation({
  companyId,
  scenarioId,
  scenarioContext = {},
  scenarioQuestions = [],
  language = 'en',
  agentId,
  voiceIds,
  voiceId,
  recordingPreference = 'none',
  videoAspectRatio = '16:9',
  preAuthorizedTabAudio = null,
  user,
  session,
  onSessionEnd
}: UseElevenLabsConversationOptions): UseElevenLabsConversationResult {
  const router = useRouter();

  // Conversation state
  const [conversationService, setConversationService] = useState<ElevenLabsConversationService | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [volume, setVolume] = useState(0.8);

  // Knowledge and questions state
  const [knowledgeContext, setKnowledgeContext] = useState<ScenarioKnowledgeContext | null>(null);
  const [isLoadingKnowledge, setIsLoadingKnowledge] = useState(false);
  const [structuredQuestions, setStructuredQuestions] = useState<any[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [sessionQuestions, setSessionQuestions] = useState<any[]>([]);
  const [isLoadingSessionQuestions, setIsLoadingSessionQuestions] = useState(false);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const videoService = useRef<VideoRecordingService>(new VideoRecordingService());
  const sessionStartTimeRef = useRef<number>(0);
  const tabAudioStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  /**
   * Load structured questions from database for theory practice
   */
  const loadStructuredQuestions = useCallback(async () => {
    if (!user?.id) {
      console.log('⚠️ No user ID provided, cannot load questions');
      return [];
    }

    try {
      setIsLoadingQuestions(true);
      console.log(`📋 Loading structured questions for user: ${user.id}`);

      const response = await fetch(`/api/assessment/theory-practice?user_id=${user.id}`);
      if (!response.ok) {
        throw new Error('Failed to load questions');
      }

      const data = await response.json();
      const questions = data.questions || [];

      setStructuredQuestions(questions);
      console.log(`✅ Loaded ${questions.length} structured questions`);

      return questions;
    } catch (error) {
      console.error('❌ Error loading structured questions:', error);
      return [];
    } finally {
      setIsLoadingQuestions(false);
    }
  }, [user?.id]);

  /**
   * Load session questions preview for UI display
   */
  const loadSessionQuestions = useCallback(async () => {
    try {
      setIsLoadingSessionQuestions(true);
      console.log('📋 Loading session questions preview for company:', companyId, 'employee:', user?.id);

      const url = user?.id
        ? `/api/questions/session-questions?companyId=${companyId}&employeeId=${user.id}&limit=10`
        : `/api/questions/session-questions?companyId=${companyId}&limit=10`;

      const response = await fetch(url);
      const data = await response.json();

      if (response.ok && data.success) {
        setSessionQuestions(data.questions);
        console.log('✅ Loaded session questions preview:', data.questions.length);
        if (data.strategy) {
          console.log('📊 Question selection strategy used:', data.strategy);
        }
      } else {
        console.error('❌ Failed to load session questions:', data.error);
        setSessionQuestions([]);
      }
    } catch (error) {
      console.error('❌ Error loading session questions:', error);
      setSessionQuestions([]);
    } finally {
      setIsLoadingSessionQuestions(false);
    }
  }, [companyId, user?.id]);

  /**
   * Load scenario-specific knowledge context
   */
  const loadKnowledgeContext = useCallback(async () => {
    if (!scenarioId) {
      console.log('⚠️ No scenario ID provided, using general knowledge context');
      return null;
    }

    if (!companyId) {
      console.log('⚠️ No company ID provided, skipping knowledge context loading');
      return null;
    }

    try {
      setIsLoadingKnowledge(true);
      setError(null);

      console.log(`🧠 Loading knowledge context for scenario: ${scenarioId}, company: ${companyId}`);

      const response = await fetch('/api/scenarios/scenario-knowledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scenarioId,
          companyId,
          maxChunks: 5
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load knowledge context');
      }

      const result = await response.json();
      const context = result.data;

      setKnowledgeContext(context);
      console.log(`✅ Knowledge context loaded: ${context.documents.length} documents, scope: ${context.knowledgeScope}`);

      return context;

    } catch (error) {
      console.error('❌ Failed to load knowledge context:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load knowledge context';
      setError(`Knowledge loading error: ${errorMessage}`);
      return null;
    } finally {
      setIsLoadingKnowledge(false);
    }
  }, [scenarioId, companyId]);

  /**
   * Initialize the ElevenLabs conversation service
   */
  const initializeConversation = useCallback(async (
    sessionIdParam: string,
    loadedKnowledgeContext?: any,
    loadedQuestions?: any[]
  ) => {
    if (conversationService || isInitialized) return;

    try {
      setError(null);
      console.log('🚀 Initializing ElevenLabs Avatar Session...');

      const currentSessionId = sessionIdParam;
      if (!currentSessionId) {
        console.error('❌ No sessionId provided - should have been generated in startSession');
        throw new Error('Session ID not initialized');
      }
      console.log('🆔 Using session ID:', currentSessionId);

      const contextToUse = loadedKnowledgeContext || knowledgeContext;
      console.log('🔍 Using knowledge context:', contextToUse ? `${contextToUse.documents?.length || 0} documents loaded` : 'No context available');

      const questionsToUse = scenarioQuestions.length > 0 ? scenarioQuestions : loadedQuestions || sessionQuestions || structuredQuestions;
      console.log('📋 Using structured questions:', questionsToUse.length, 'questions available');

      const trainingMode = scenarioContext?.type === 'theory' ? 'theory'
        : scenarioContext?.type === 'flipboard' ? 'flipboard'
        : 'service_practice';

      if (!contextToUse || !contextToUse.formattedContext) {
        console.warn('⚠️ NO KNOWLEDGE CONTEXT LOADED! Training quality will be poor.');
      }

      // Format structured questions for the ElevenLabs agent
      const formatStructuredQuestions = (questions: any[]) => {
        if (!questions || questions.length === 0) {
          return '';
        }

        let questionsToFormat = questions;

        if (questions.length > 0 && questions[0].status) {
          const unanswered = questions.filter(q => q.status === 'unanswered');
          const incorrect = questions.filter(q => q.status === 'incorrect');
          const correct = questions.filter(q => q.status === 'correct');
          questionsToFormat = [...unanswered, ...incorrect, ...correct];
        }

        if (questionsToFormat.length === 0) {
          return '';
        }

        const questionList = questionsToFormat.map((q, index) => {
          const questionText = q.question_template || q.question;
          const topicName = q.topic_name || q.topic?.name || 'Unknown Topic';
          const difficultyLevel = q.difficultyLevel ? ` (Level ${q.difficultyLevel}/3)` : '';

          return `${index + 1}. "${questionText}" (Topic: ${topicName}${difficultyLevel})`;
        }).join('\n');

        console.log(`📋 Formatted ${questionsToFormat.length} questions for ElevenLabs agent`);

        return `
STRUCTURED QUESTIONS TO ASK (in order of priority):

${questionList}

INSTRUCTIONS:
- Ask these questions one by one in the exact order listed
- After student gives ANY answer, move immediately to the next question
- Do not provide correct answers or explanations during the session
- Ask ALL ${questionsToFormat.length} questions in the list before ending the session
- Track which questions have been asked to avoid repetition
`;
      };

      const structuredQuestionsText = formatStructuredQuestions(questionsToUse);
      const establishmentType = user?.business_type || 'coffee_shop';

      // Create dynamic variables for ElevenLabs agent
      const dynamicVariables = {
        training_mode: trainingMode,
        company_name: companyId,
        difficulty_level: scenarioContext?.difficulty || 'intermediate',
        session_type: 'assessment',
        language: language,
        establishment_type: establishmentType,
        knowledge_context: contextToUse?.formattedContext || 'No specific company knowledge available for this scenario.',
        knowledge_scope: contextToUse?.knowledgeScope || 'restricted',
        documents_available: contextToUse?.documents?.length || 0,
        questions_available: questionsToUse.length,
        question_templates: trainingMode === 'theory' ? structuredQuestionsText : undefined,
        scenario_title: scenarioContext?.title || 'General customer interaction',
        client_behavior: scenarioContext?.client_behavior || 'Act as a typical customer seeking help',
        expected_response: scenarioContext?.expected_response || 'Employee should be helpful and knowledgeable',
        customer_emotion_level: scenarioContext?.customer_emotion_level || 'normal',
        first_message: scenarioContext?.first_message || undefined,
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
          undefined
      };

      console.log('🎯 Starting session with dynamic variables:', dynamicVariables);
      console.log('😤 Customer emotion level:', scenarioContext?.customer_emotion_level || 'normal (default)');

      // Voice resolution
      let resolvedVoiceId: string | null | undefined = voiceId;

      if (voiceIds && voiceIds.length > 0) {
        console.log('🎤 Resolving voice from scenario voice_ids:', voiceIds);
        console.log('🌍 Session language:', language);

        try {
          resolvedVoiceId = await resolveVoiceForSession(voiceIds, language);

          if (resolvedVoiceId) {
            console.log(`✅ Resolved voice: ${resolvedVoiceId}`);
          } else {
            console.warn(`⚠️ No voice matched language "${language}" - using first available or agent default`);
            resolvedVoiceId = voiceIds[0];
          }
        } catch (error) {
          console.error('❌ Voice resolution failed:', error);
          resolvedVoiceId = voiceIds[0] || 'random';
        }
      } else {
        console.log('🎤 Using legacy single voiceId:', resolvedVoiceId || 'agent default');
      }

      const service = new ElevenLabsConversationService({
        agentId,
        language,
        voiceId: resolvedVoiceId,
        connectionType: 'webrtc',
        volume,
        dynamicVariables
      });

      // Set up event listeners
      service.on('connected', () => {
        console.log('✅ Avatar session connected');
        setIsConnected(true);
        setConnectionStatus('connected');
        setIsSessionActive(true);
        console.log('ℹ️ Recording was pre-initialized - agent can speak immediately');
      });

      service.on('disconnected', () => {
        console.log('🔌 Avatar session disconnected');
        setIsConnected(false);
        setConnectionStatus('disconnected');
        setIsSessionActive(false);
      });

      service.on('agentMessage', (message: ConversationMessage) => {
        setCurrentMessage(message.content);
        setConversationHistory(prev => [...prev, message]);
      });

      service.on('userMessage', (message: ConversationMessage) => {
        setConversationHistory(prev => [...prev, message]);
      });

      service.on('remoteAudioTrackAvailable', (track: any) => {
        console.log('🎵 Remote audio track available event received!');

        if (recordingPreference === 'audio_video' && videoService.current.isRecording()) {
          const stream = new MediaStream([track.mediaStreamTrack || track]);
          console.log('✅ Created MediaStream from remote audio track');

          videoService.current.addLiveAudioStream(stream);
          tabAudioStreamRef.current = stream;
          console.log('✅ Remote audio added to recording via trackSubscribed event');
        }
      });

      service.on('agentStartSpeaking', () => {
        setIsAgentSpeaking(true);
        setIsListening(false);

        if (recordingPreference === 'audio_video' && videoService.current.isRecording() && !tabAudioStreamRef.current) {
          console.log('🔍 Agent started speaking - attempting to capture audio stream...');

          let elevenLabsAudio = service.getRemoteAudioStream();

          if (elevenLabsAudio && elevenLabsAudio.getAudioTracks().length > 0) {
            console.log('✅ Agent audio captured (immediate) - adding to recording');
            videoService.current.addLiveAudioStream(elevenLabsAudio);
            tabAudioStreamRef.current = elevenLabsAudio;
          } else {
            console.warn('⚠️ Audio not available immediately - trying with delay...');

            setTimeout(() => {
              elevenLabsAudio = service.getRemoteAudioStream();

              if (elevenLabsAudio && elevenLabsAudio.getAudioTracks().length > 0) {
                console.log('✅ Agent audio captured (retry) - adding to recording');
                videoService.current.addLiveAudioStream(elevenLabsAudio);
                tabAudioStreamRef.current = elevenLabsAudio;
              } else {
                console.error('❌ Failed to capture ElevenLabs audio even after retry');
              }
            }, 500);
          }
        }
      });

      service.on('agentStartListening', () => {
        setIsAgentSpeaking(false);
        setIsListening(true);
      });

      service.on('agentProcessing', () => {
        setIsAgentSpeaking(false);
        setIsListening(false);
      });

      service.on('agentIdle', () => {
        setIsAgentSpeaking(false);
        setIsListening(false);
      });

      service.on('statusChange', (status: any) => {
        const statusString = typeof status === 'string' ? status :
                           status?.status ||
                           JSON.stringify(status) ||
                           'unknown';
        setConnectionStatus(statusString);
      });

      service.on('error', (error: any) => {
        console.error('❌ Conversation error:', error);
        const errorMessage = typeof error === 'string' ? error :
                            error?.message ||
                            JSON.stringify(error) ||
                            'Conversation error occurred';
        setError(errorMessage);
      });

      service.on('stopped', () => {
        setIsSessionActive(false);
        setIsConnected(false);
        setIsAgentSpeaking(false);
        setIsListening(false);
      });

      await service.initialize();

      setConversationService(service);
      setIsInitialized(true);

      console.log('✅ ElevenLabs Avatar Session initialized successfully');

      session.setStartingSession(false);

    } catch (error) {
      console.error('❌ Failed to initialize avatar session:', error);
      const errorMessage = error instanceof Error ? error.message :
                          typeof error === 'string' ? error :
                          JSON.stringify(error) ||
                          'Failed to initialize session';
      setError(errorMessage);

      session.setStartingSession(false);
    }
  }, [agentId, language, volume, conversationService, isInitialized, knowledgeContext, scenarioQuestions, sessionQuestions, structuredQuestions, scenarioContext, user, voiceIds, voiceId, recordingPreference, companyId, session]);

  /**
   * Start session recording
   */
  const startSessionRecording = useCallback(async () => {
    if (recordingPreference === 'none') return;

    try {
      console.log(`🎥 Starting ${recordingPreference} recording...`);

      if (recordingPreference === 'audio') {
        console.log('🎵 Audio-only session - ElevenLabs audio will be captured in conversation');
        setIsRecording(true);
        sessionStartTimeRef.current = Date.now();
        return;
      }

      console.log('📹 Starting video recording with service...');

      await videoService.current.startRecording({
        aspectRatio: videoAspectRatio,
        enableAudioMixing: true,
        videoBitrate: undefined
      });

      setIsRecording(true);
      sessionStartTimeRef.current = Date.now();

      console.log('✅ Video recording started successfully');

      const previewStream = videoService.current.getPreviewStream();
      if (previewStream && videoRef.current) {
        console.log('📹 Attaching preview stream to video element...');
        videoRef.current.srcObject = previewStream;
        await videoRef.current.play().catch(err => {
          console.warn('⚠️ Preview play failed:', err);
        });
        console.log('✅ Video preview attached');
      }

    } catch (error) {
      console.error(`❌ Failed to start ${recordingPreference} recording:`, error);
      setIsRecording(false);
    }
  }, [recordingPreference, videoAspectRatio]);

  /**
   * Stop session recording
   */
  const stopSessionRecording = useCallback(async (): Promise<void> => {
    if (recordingPreference === 'none') return;

    console.log(`🛑 Stopping ${recordingPreference} recording...`);
    setIsRecording(false);

    if (recordingPreference === 'audio_video' && videoService.current.isRecording()) {
      await videoService.current.stopRecording();
      console.log('✅ Video recording stopped');
    }
  }, [recordingPreference]);

  /**
   * Save session recording to Supabase
   */
  const saveSessionRecording = useCallback(async () => {
    const currentSessionId = session.sessionId;
    const currentConversationId = conversationService?.getConversationId();

    console.log(`🔍 Recording debug - SessionId: ${currentSessionId}, ConversationId: ${currentConversationId}`);

    if (!currentSessionId) {
      console.log('❌ Session ID is missing');
      return;
    }

    try {
      if (recordingPreference === 'audio') {
        if (!currentConversationId) {
          console.log('⚠️ No ElevenLabs conversation ID available for audio retrieval');
          return;
        }

        console.log('🎵 Conversation ID stored for audio retrieval:', currentConversationId);
        console.log('💡 Audio will be available on transcript page via lazy loading');

      } else if (recordingPreference === 'audio_video') {
        const recordingData = await videoService.current.stopRecording();

        if (recordingData.chunks.length > 0) {
          console.log('📹 Uploading video directly to Supabase Storage...');

          const videoBlob = new Blob(recordingData.chunks, {
            type: recordingData.mimeType
          });

          console.log(`📹 Created video blob: ${videoBlob.size} bytes, type: ${videoBlob.type}`);

          let fileExtension = 'webm';
          if (recordingData.mimeType.includes('mp4')) {
            fileExtension = 'mp4';
          } else if (recordingData.mimeType.includes('webm')) {
            fileExtension = 'webm';
          }

          const fileName = `${currentSessionId}-video-${Date.now()}.${fileExtension}`;
          const filePath = `recordings/video/${fileName}`;

          const { data, error } = await supabase.storage
            .from('training-recordings')
            .upload(filePath, videoBlob, {
              contentType: recordingData.mimeType,
              upsert: false
            });

          if (error) {
            console.error('❌ Supabase Storage upload failed:', error);
            throw new Error(`Video upload failed: ${error.message}`);
          }

          if (!data || !data.path) {
            console.error('❌ Upload succeeded but no path returned');
            throw new Error('Upload succeeded but no path returned');
          }

          console.log('✅ Video uploaded to Supabase:', data.path);

          const { data: { publicUrl } } = supabase.storage
            .from('training-recordings')
            .getPublicUrl(data.path);

          console.log('✅ Public URL:', publicUrl);

          await trainingSessionsService.updateSessionRecording(currentSessionId, {
            video_recording_url: publicUrl,
            video_file_size: videoBlob.size,
            recording_duration_seconds: recordingData.duration
          });

          console.log('✅ Session updated with video recording URL');
        } else {
          console.log('⚠️ No video chunks to upload');
        }

        if (currentConversationId) {
          console.log('🎵 Conversation ID stored for transcript access:', currentConversationId);
        }
      }

    } catch (error) {
      console.error('❌ Failed to save recording:', error);
    }
  }, [recordingPreference, conversationService, session]);

  /**
   * Start the avatar session
   */
  const startSession = useCallback(async () => {
    if (session.isStartingSession() || isInitialized || conversationService) {
      console.warn('⚠️ Session already starting or active - ignoring duplicate click');
      return;
    }

    session.setStartingSession(true);

    console.log('🚀 Starting session - will initialize recording BEFORE ElevenLabs');

    const newSessionId = await session.initializeSession();
    console.log('✅ Session initialized with ID:', newSessionId);

    session.startTimer();

    if (recordingPreference !== 'none') {
      console.log('🎬 Pre-initializing recording to get permissions before agent starts speaking...');
      await startSessionRecording();
      console.log('✅ Recording ready - now safe to start ElevenLabs agent');
    }

    const loadedContext = await loadKnowledgeContext();
    console.log('🔄 Knowledge loaded in startSession:', loadedContext ? `${loadedContext.documents?.length || 0} documents` : 'No context');

    const loadedQuestions = await loadStructuredQuestions();
    console.log('🔄 Questions loaded in startSession:', loadedQuestions.length, 'questions');

    console.log('🎙️ Recording is ready - initializing ElevenLabs conversation...');
    await initializeConversation(newSessionId, loadedContext, loadedQuestions);
  }, [session, isInitialized, conversationService, recordingPreference, startSessionRecording, loadKnowledgeContext, loadStructuredQuestions, initializeConversation]);

  /**
   * Stop the avatar session
   */
  const stopSession = useCallback(async () => {
    if (session.isSavingRef.current) {
      console.log('⚠️ Session save already in progress, skipping duplicate call');
      return;
    }

    if (!conversationService || !user) {
      console.warn('⚠️ Cannot save session: missing conversation service or user');
      return;
    }

    try {
      session.markSessionSaving(true);
      session.stopTimer();

      console.log('🛑 Stopping training session...');

      const conversationId = conversationService.getConversationId();
      console.log('🆔 ElevenLabs conversation ID:', conversationId);

      await conversationService.stop();
      setConversationService(null);
      setIsInitialized(false);
      setIsSessionActive(false);

      session.setStartingSession(false);

      if (recordingPreference !== 'none') {
        console.log('⏳ Waiting for recording to stop completely...');
        await stopSessionRecording();
        console.log('✅ Recording stopped successfully');

        if (videoService.current) {
          const previewStream = videoService.current.getPreviewStream();
          if (previewStream) {
            previewStream.getTracks().forEach(track => {
              track.stop();
              console.log('🔇 Stopped track:', track.kind);
            });
          }
        }
      }

      console.log('ℹ️ Skipping automatic transcript fetching - user can trigger it manually from completion page');

      let finalConversationHistory = [
        {
          role: 'assistant',
          content: 'Training session completed - use "Get Transcript and Analysis" button to fetch results',
          timestamp: Date.now()
        }
      ];

      const trainingMode = scenarioContext?.type === 'theory' ? 'theory' : 'service_practice';
      const endTime = new Date();
      const startTime = new Date(sessionStartTimeRef.current || Date.now());
      const employeeId = user.id;

      if (!session.sessionId) {
        console.error('❌ No sessionId available for saving session');
        alert('Session ID not found. Cannot save session.');
        return;
      }

      console.log('💾 Saving training session with predefined ID:', session.sessionId);
      console.log('🆔 Storing ElevenLabs conversation ID:', conversationId);

      const sessionRecord = {
        id: session.sessionId,
        employee_id: employeeId,
        assignment_id: scenarioId || 'unknown',
        company_id: companyId,
        scenario_id: scenarioId || null,
        session_name: `${getTrainingModeDisplay(trainingMode)} Session - ${endTime.toLocaleDateString('en-US', {
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
        elevenlabs_conversation_id: conversationId || null,
        recording_preference: recordingPreference,
        recording_consent_timestamp: recordingPreference !== 'none' ? startTime.toISOString() : null,
        audio_recording_url: null,
        video_recording_url: null,
        audio_file_size: null,
        video_file_size: null,
        recording_duration_seconds: recordingPreference !== 'none' ? Math.round((endTime.getTime() - startTime.getTime()) / 1000) : null
      };

      console.log('📤 Saving session via API endpoint...');

      const saveResponse = await fetch('/api/training/save-training-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionRecord),
      });

      const saveResult = await saveResponse.json();

      if (!saveResult.success) {
        console.error('❌ API returned error:', saveResult.error);
        throw new Error(saveResult.error || 'Failed to save session');
      }

      console.log('✅ Session saved successfully via API');

      if (recordingPreference !== 'none') {
        console.log('🎬 Saving session recording using hybrid approach...');

        try {
          const uploadTimeout = 30000;
          await Promise.race([
            saveSessionRecording(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Upload timeout')), uploadTimeout)
            )
          ]);
          console.log('✅ Recording saved successfully');
        } catch (uploadError) {
          console.error('⚠️ Recording upload failed or timed out:', uploadError);
          console.log('📝 Continuing to transcript page despite upload issue...');
        }
      }

      console.log('🔄 Redirecting to transcript...');

      session.markSessionSaving(false);

      await new Promise(resolve => setTimeout(resolve, 100));

      router.push(`/employee/sessions/${session.sessionId}`);

    } catch (error: any) {
      console.error('❌ Failed to save training session:', error);
      const errorMessage = error?.message || 'Unknown error';
      console.error('Error details:', errorMessage);

      session.markSessionSaving(false);
      session.setStartingSession(false);

      alert(`Failed to save training session: ${errorMessage}\n\nPlease try again or contact support.`);
    }
  }, [session, conversationService, user, scenarioContext, scenarioId, companyId, language, agentId, knowledgeContext, router, recordingPreference, saveSessionRecording, stopSessionRecording]);

  /**
   * Handle volume change
   */
  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    if (conversationService) {
      conversationService.setVolume(newVolume);
    }
  }, [conversationService]);

  /**
   * Load knowledge context when component mounts or scenario changes
   */
  useEffect(() => {
    loadKnowledgeContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId, companyId]);

  /**
   * Load session questions for theory mode
   */
  useEffect(() => {
    if (scenarioContext?.type === 'theory') {
      loadSessionQuestions();
    }
  }, [scenarioContext?.type, loadSessionQuestions]);

  /**
   * Re-attach video preview stream when session becomes active
   */
  useEffect(() => {
    if (isSessionActive && videoRef.current && recordingPreference === 'audio_video' && videoService.current.isRecording()) {
      const previewStream = videoService.current.getPreviewStream();
      if (previewStream && videoRef.current.srcObject !== previewStream) {
        console.log('📹 Re-attaching preview stream after session activation...');
        videoRef.current.srcObject = previewStream;
        videoRef.current.play().catch(err => {
          console.warn('⚠️ Preview play failed:', err);
        });
        console.log('✅ Preview stream re-attached');
      }
    }
  }, [isSessionActive, recordingPreference]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (conversationService) {
        conversationService.stop();
      }
    };
  }, [conversationService]);

  return {
    // State
    conversationService,
    isInitialized,
    isSessionActive,
    isConnected,
    isAgentSpeaking,
    isListening,
    connectionStatus,
    conversationHistory,
    currentMessage,
    volume,
    knowledgeContext,
    isLoadingKnowledge,
    isRecording,
    error,
    structuredQuestions,
    isLoadingQuestions,
    sessionQuestions,
    isLoadingSessionQuestions,

    // Refs
    videoService,
    videoRef,

    // Actions
    startSession,
    stopSession,
    handleVolumeChange,
    loadKnowledgeContext,
    loadSessionQuestions
  };
}
