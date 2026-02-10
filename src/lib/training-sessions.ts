/**
 * Training Sessions Service
 * Handles storage and retrieval of training session data and transcripts
 */

import { supabase } from './supabase'
import type { ConversationMessage } from './elevenlabs-conversation'
import type { ScenarioKnowledgeContext } from './elevenlabs-knowledge'

export type RecordingPreference = 'none' | 'audio' | 'audio_video'

export interface TrainingSession {
  id: string
  employee_id: string
  assignment_id: string
  company_id: string
  scenario_id?: string | null
  session_name: string
  training_mode: 'theory' | 'service_practice' | 'recommendation_tts'
  language: string
  agent_id: string
  knowledge_context: ScenarioKnowledgeContext | null
  conversation_transcript: ConversationMessage[]
  session_duration_seconds: number
  started_at: string
  ended_at: string
  created_at: string
  // Recording fields
  recording_preference: RecordingPreference
  recording_consent_timestamp?: string | null
  audio_recording_url?: string | null
  video_recording_url?: string | null
  audio_file_size?: number | null
  video_file_size?: number | null
  recording_duration_seconds?: number | null
  // ElevenLabs integration
  elevenlabs_conversation_id?: string | null
  // Assessment result caching
  theory_assessment_results?: any | null
  assessment_completed_at?: string | null
  assessment_status?: 'pending' | 'completed' | 'failed'
}

export interface CreateSessionData {
  id?: string // Optional session ID for updating existing sessions
  employee_id: string
  assignment_id: string
  company_id: string
  scenario_id?: string | null // Scenario being trained
  training_mode: 'theory' | 'service_practice' | 'recommendation_tts'
  language: string
  agent_id: string
  knowledge_context?: ScenarioKnowledgeContext | null
  conversation_transcript: ConversationMessage[]
  started_at: Date
  ended_at: Date
  session_duration_seconds?: number // Allow manual override
  // Recording data
  recording_preference: RecordingPreference
  recording_consent_timestamp?: Date | null
  audio_recording_url?: string | null
  video_recording_url?: string | null
  audio_file_size?: number | null
  video_file_size?: number | null
  recording_duration_seconds?: number | null
}

class TrainingSessionsService {
  /**
   * Save a completed training session to the database
   */
  async saveSession(sessionData: CreateSessionData): Promise<string> {
    const sessionName = this.generateSessionName(
      sessionData.training_mode,
      sessionData.started_at
    )

    const sessionDuration = sessionData.session_duration_seconds ?? Math.round(
      (sessionData.ended_at.getTime() - sessionData.started_at.getTime()) / 1000
    )

    const sessionRecord = {
      ...(sessionData.id && { id: sessionData.id }), // Include ID if provided (for upsert)
      employee_id: sessionData.employee_id,
      assignment_id: sessionData.assignment_id,
      company_id: sessionData.company_id,
      scenario_id: sessionData.scenario_id || null, // Track which scenario was trained
      session_name: sessionName,
      training_mode: sessionData.training_mode,
      language: sessionData.language,
      agent_id: sessionData.agent_id,
      knowledge_context: sessionData.knowledge_context || null,
      conversation_transcript: sessionData.conversation_transcript,
      session_duration_seconds: sessionDuration,
      started_at: sessionData.started_at.toISOString(),
      ended_at: sessionData.ended_at.toISOString(),
      // Recording fields
      recording_preference: sessionData.recording_preference,
      recording_consent_timestamp: sessionData.recording_consent_timestamp?.toISOString() || null,
      audio_recording_url: sessionData.audio_recording_url || null,
      video_recording_url: sessionData.video_recording_url || null,
      audio_file_size: sessionData.audio_file_size || null,
      video_file_size: sessionData.video_file_size || null,
      recording_duration_seconds: sessionData.recording_duration_seconds || null
    }

    console.log('💾 Saving training session:', sessionName)
    console.log('📝 Session record to save:', JSON.stringify(sessionRecord, null, 2))

    try {
      // Use API endpoint instead of direct Supabase client (better for mobile)
      // API uses service role which bypasses RLS and is faster
      console.log('🕐 Calling /api/training/save-training-session with 30s timeout...')

      // Log the JSON string we're about to send to debug any serialization issues
      let jsonString: string
      try {
        jsonString = JSON.stringify(sessionRecord)
        console.log('📤 JSON payload size:', jsonString.length, 'characters')
        console.log('📤 JSON payload preview:', jsonString.substring(0, 200) + '...')
      } catch (stringifyError) {
        console.error('❌ Failed to stringify session record:', stringifyError)
        throw new Error('Failed to serialize session data: ' + (stringifyError instanceof Error ? stringifyError.message : 'Unknown error'))
      }

      const apiPromise = fetch('/api/training/save-training-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonString
      }).catch(fetchError => {
        console.error('❌ Fetch call failed before reaching server:', fetchError)
        throw fetchError
      })

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('API call timeout after 30 seconds')), 30000)
      )

      console.log('⏳ Racing API call against timeout...')
      const response = await Promise.race([apiPromise, timeoutPromise]) as Response
      console.log('✅ Got response with status:', response.status)

      if (!response.ok) {
        console.error('❌ Response not OK, status:', response.status)
        let errorData
        try {
          errorData = await response.json()
          console.error('❌ Error response data:', errorData)
        } catch (jsonError) {
          const textData = await response.text()
          console.error('❌ Response was not JSON, raw text:', textData)
          throw new Error(`API call failed with status ${response.status}: ${textData}`)
        }
        throw new Error(errorData.error || 'API call failed')
      }

      console.log('📥 Parsing successful response...')
      const result = await response.json()

      if (!result.success) {
        console.error('❌ Result indicated failure:', result.error)
        throw new Error(result.error || 'Failed to save session')
      }

      console.log('✅ Training session saved successfully via API:', result.session.id)
      return result.session.id
    } catch (error) {
      console.error('❌ Error saving training session:', error)
      if (error instanceof Error) {
        console.error('❌ Error details:', error.message, error.stack)
      }
      throw new Error(`Failed to save training session: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get training session history for an employee
   */
  async getEmployeeSessionHistory(employeeId: string): Promise<TrainingSession[]> {
    console.log('📚 Loading session history for employee:', employeeId)

    try {
      // Get sessions
      const { data: sessions, error } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Failed to load session history:', error)
        throw error
      }

      if (!sessions || sessions.length === 0) {
        return []
      }

      // Get unique scenario IDs
      const scenarioIds = [...new Set(sessions.map(s => s.scenario_id).filter(Boolean))]

      if (scenarioIds.length === 0) {
        console.log(`✅ Loaded ${sessions.length} training sessions (no scenarios)`)
        return sessions
      }

      // Fetch scenario information
      const { data: scenarios, error: scenariosError } = await supabase
        .from('scenarios')
        .select('id, title, scenario_type')
        .in('id', scenarioIds)

      if (scenariosError) {
        console.error('❌ Error fetching scenarios:', scenariosError)
        // Continue without scenario names
        return sessions
      }

      // Create scenario lookup map
      const scenarioMap = new Map(
        (scenarios || []).map(s => [s.id, s])
      )

      // Enrich sessions with scenario info
      const enrichedSessions = sessions.map(session => ({
        ...session,
        scenario_name: session.scenario_id ? scenarioMap.get(session.scenario_id)?.title || null : null,
        scenario_type: session.scenario_id ? scenarioMap.get(session.scenario_id)?.scenario_type || null : null
      }))

      console.log(`✅ Loaded ${enrichedSessions.length} training sessions`)
      return enrichedSessions as TrainingSession[]
    } catch (error) {
      console.error('❌ Error loading session history:', error)
      throw new Error('Failed to load training session history')
    }
  }

  /**
   * Get a specific training session by ID
   */
  async getSessionById(sessionId: string): Promise<TrainingSession | null> {
    console.log('🔍 Loading training session:', sessionId)

    try {
      const { data, error } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          console.log('Session not found:', sessionId)
          return null
        }
        console.error('❌ Failed to load training session:', error)
        throw error
      }

      console.log('✅ Training session loaded successfully')
      return data
    } catch (error) {
      console.error('❌ Error loading training session:', error)
      throw new Error('Failed to load training session')
    }
  }

  /**
   * Get sessions for a company (for managers)
   */
  async getCompanySessionHistory(companyId: string): Promise<TrainingSession[]> {
    console.log('🏢 Loading company session history:', companyId)

    try {
      const { data, error } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Failed to load company session history:', error)
        throw error
      }

      console.log(`✅ Loaded ${data.length} company training sessions`)
      return data || []
    } catch (error) {
      console.error('❌ Error loading company session history:', error)
      throw new Error('Failed to load company training session history')
    }
  }

  /**
   * Generate a descriptive session name
   */
  private generateSessionName(trainingMode: string, startedAt: Date): string {
    const sessionCount = Math.floor(Math.random() * 100) + 1 // Simple counter, could be improved
    const date = startedAt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
    const time = startedAt.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })

    const modeLabel = trainingMode === 'theory' ? 'Theory Q&A' : 'Service Practice'
    return `${modeLabel} Session - ${date} at ${time}`
  }

  /**
   * Format session duration for display
   */
  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60

    if (minutes === 0) {
      return `${remainingSeconds}s`
    } else if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s`
    } else {
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60
      return `${hours}h ${remainingMinutes}m`
    }
  }

  /**
   * Upload recording file to Supabase Storage
   */
  async uploadRecording(
    sessionId: string,
    recordingBlob: Blob,
    recordingType: 'audio' | 'video'
  ): Promise<string> {
    console.log(`📤 Uploading ${recordingType} recording for session:`, sessionId)

    try {
      const fileExtension = recordingType === 'audio' ? 'webm' : 'webm'
      const fileName = `${sessionId}-${recordingType}-${Date.now()}.${fileExtension}`
      const filePath = `recordings/${recordingType}/${fileName}`

      const { data, error } = await supabase.storage
        .from('training-recordings')
        .upload(filePath, recordingBlob, {
          contentType: recordingBlob.type || `${recordingType}/webm`,
          upsert: false
        })

      if (error) {
        console.error(`❌ Failed to upload ${recordingType} recording:`, error)
        throw error
      }

      console.log(`✅ ${recordingType} recording uploaded successfully:`, data.path)

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('training-recordings')
        .getPublicUrl(data.path)

      return publicUrl
    } catch (error) {
      console.error(`❌ Error uploading ${recordingType} recording:`, error)
      throw new Error(`Failed to upload ${recordingType} recording`)
    }
  }

  /**
   * Fetch and store ElevenLabs conversation audio
   */
  async fetchConversationAudio(
    sessionId: string,
    conversationId: string
  ): Promise<void> {
    console.log('🎵 Fetching ElevenLabs conversation audio for session:', sessionId)

    try {
      const response = await fetch('/api/elevenlabs/elevenlabs-conversation-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          conversationId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch conversation audio')
      }

      const result = await response.json()
      console.log('✅ ElevenLabs conversation audio retrieved successfully:', result.audioUrl)

    } catch (error) {
      console.error('❌ Error fetching conversation audio:', error)
      throw new Error('Failed to fetch ElevenLabs conversation audio')
    }
  }

  /**
   * Update session with recording URLs
   */
  async updateSessionRecording(
    sessionId: string,
    recordingData: {
      audio_recording_url?: string | null
      video_recording_url?: string | null
      audio_file_size?: number | null
      video_file_size?: number | null
      recording_duration_seconds?: number | null
    }
  ): Promise<void> {
    console.log('🔄 Updating session with recording data:', sessionId)

    try {
      const response = await fetch('/api/media/update-recording', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          recordingData
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update recording metadata')
      }

      console.log('✅ Session recording data updated successfully')
    } catch (error) {
      console.error('❌ Error updating session recording:', error)
      throw new Error('Failed to update session recording data')
    }
  }

  /**
   * Get session statistics for an employee
   */
  async getEmployeeStats(employeeId: string): Promise<{
    totalSessions: number
    totalDuration: number
    completedThisWeek: number
  }> {
    console.log('📊 Loading employee session stats:', employeeId)

    try {
      const { data, error } = await supabase
        .from('training_sessions')
        .select('session_duration_seconds, created_at')
        .eq('employee_id', employeeId)

      if (error) {
        console.error('❌ Failed to load session stats:', error)
        throw error
      }

      const sessions = data || []
      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      const stats = {
        totalSessions: sessions.length,
        totalDuration: sessions.reduce((sum, s) => sum + s.session_duration_seconds, 0),
        completedThisWeek: sessions.filter(s => new Date(s.created_at) > weekAgo).length
      }

      console.log('✅ Employee stats loaded:', stats)
      return stats
    } catch (error) {
      console.error('❌ Error loading session stats:', error)
      throw new Error('Failed to load training session statistics')
    }
  }

  /**
   * Delete a training session and all associated resources
   * Removes session from database, Supabase Storage, and ElevenLabs
   */
  async deleteSession(sessionId: string, managerId: string): Promise<{
    success: boolean
    deleted: {
      session: boolean
      elevenlabsConversation: boolean
      videoRecording: boolean
      audioRecording: boolean
    }
    errors?: string[]
  }> {
    console.log('🗑️ Deleting training session:', sessionId, 'by manager:', managerId)

    try {
      const response = await fetch('/api/training/delete-training-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId, managerId })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete session')
      }

      const result = await response.json()
      console.log('✅ Session deleted successfully:', result)

      return result
    } catch (error) {
      console.error('❌ Error deleting session:', error)
      throw new Error(
        error instanceof Error
          ? error.message
          : 'Failed to delete training session'
      )
    }
  }
}

// Export singleton instance
export const trainingSessionsService = new TrainingSessionsService()