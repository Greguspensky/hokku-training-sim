import { supabaseAdmin } from './supabase'
import { Track, Scenario, scenarioService } from './scenarios'
import { Employee } from './employees'

export type AssignmentStatus = 'assigned' | 'in_progress' | 'completed' | 'cancelled'
export type ScenarioProgressStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped'

export interface TrackAssignment {
  id: string
  employee_id: string
  track_id: string
  assigned_by: string
  assigned_at: string
  status: AssignmentStatus
  started_at?: string
  completed_at?: string
  progress_percentage: number
  notes?: string
  is_active: boolean
  created_at: string
  updated_at: string

  // Populated relations (when included)
  track?: Track
  employee?: Employee
  scenarios?: Scenario[]
  scenario_progress?: ScenarioProgress[]
}

export interface ScenarioProgress {
  id: string
  assignment_id: string
  scenario_id: string
  status: ScenarioProgressStatus
  started_at?: string
  completed_at?: string
  score?: number
  feedback?: string
  attempts: number
  time_spent_minutes: number
  created_at: string
  updated_at: string

  // Populated relations
  scenario?: Scenario
}

export interface CreateTrackAssignmentData {
  employee_id: string
  track_id: string
  assigned_by: string
  notes?: string
}

export interface UpdateAssignmentProgressData {
  status?: AssignmentStatus
  progress_percentage?: number
  notes?: string
}

export interface UpdateScenarioProgressData {
  status?: ScenarioProgressStatus
  score?: number
  feedback?: string
  time_spent_minutes?: number
}

export interface AssignmentWithDetails extends TrackAssignment {
  track: Track
  employee: Employee
  scenario_progress: (ScenarioProgress & { scenario: Scenario })[]
}

// Demo storage for development with persistence
import fs from 'fs'
import path from 'path'

const DEMO_DATA_DIR = path.join(process.cwd(), '.demo-data')
const ASSIGNMENTS_FILE = path.join(DEMO_DATA_DIR, 'track-assignments.json')
const PROGRESS_FILE = path.join(DEMO_DATA_DIR, 'scenario-progress.json')

// Ensure demo data directory exists
if (typeof window === 'undefined') { // Server-side only
  if (!fs.existsSync(DEMO_DATA_DIR)) {
    fs.mkdirSync(DEMO_DATA_DIR, { recursive: true })
  }
}

// Load demo assignments from file
function loadDemoAssignments(): TrackAssignment[] {
  if (typeof window !== 'undefined') return [] // Client-side fallback

  try {
    if (fs.existsSync(ASSIGNMENTS_FILE)) {
      const data = fs.readFileSync(ASSIGNMENTS_FILE, 'utf8')
      const parsed = JSON.parse(data)
      console.log('🔍 DEBUG: Loaded assignments from file:', parsed.length, 'assignments')
      console.log('🔍 DEBUG: Assignment IDs loaded:', parsed.map((a: any) => a.id))
      return parsed
    } else {
      console.log('🔍 DEBUG: No assignments file exists, starting with empty array')
    }
  } catch (error) {
    console.error('Error loading demo assignments:', error)
  }
  return []
}

// Save demo assignments to file
function saveDemoAssignments(assignments: TrackAssignment[]) {
  if (typeof window !== 'undefined') return // Client-side fallback

  try {
    console.log('🔍 DEBUG: Saving assignments to file:', assignments.length, 'assignments')
    console.log('🔍 DEBUG: Assignment IDs being saved:', assignments.map(a => a.id))
    fs.writeFileSync(ASSIGNMENTS_FILE, JSON.stringify(assignments, null, 2))
    console.log('🔍 DEBUG: Successfully saved assignments to file')
  } catch (error) {
    console.error('Error saving demo assignments:', error)
  }
}

// Load demo scenario progress from file
function loadDemoScenarioProgress(): ScenarioProgress[] {
  if (typeof window !== 'undefined') return [] // Client-side fallback

  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Error loading demo scenario progress:', error)
  }
  return []
}

// Save demo scenario progress to file
function saveDemoScenarioProgress(progress: ScenarioProgress[]) {
  if (typeof window !== 'undefined') return // Client-side fallback

  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
  } catch (error) {
    console.error('Error saving demo scenario progress:', error)
  }
}

const demoAssignments: TrackAssignment[] = loadDemoAssignments()
const demoScenarioProgress: ScenarioProgress[] = loadDemoScenarioProgress()

class TrackAssignmentService {
  private generateId(): string {
    return `demo-assignment-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Assign a track to an employee
   */
  async assignTrackToEmployee(data: CreateTrackAssignmentData): Promise<TrackAssignment> {
    const {
      employee_id,
      track_id,
      assigned_by,
      notes
    } = data

    try {
      const { data: assignment, error } = await supabaseAdmin
        .from('track_assignments')
        .insert([
          {
            user_id: employee_id,  // Changed from employee_id to user_id for production
            track_id,
            assigned_by,
            // Removed notes and progress_percentage as they don't exist in production
            status: 'assigned'
          }
        ])
        .select()
        .single()

      if (error) {
        throw error
      }

      return assignment
    } catch (error: any) {
      console.log('🚧 Demo mode: Creating track assignment (Error:', error.message, ')')

      const demoAssignment: TrackAssignment = {
        id: this.generateId(),
        employee_id,
        track_id,
        assigned_by,
        assigned_at: new Date().toISOString(),
        status: 'assigned',
        progress_percentage: 0,
        notes,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      demoAssignments.push(demoAssignment)
      saveDemoAssignments(demoAssignments)

      // Initialize scenario progress for all scenarios in the track
      await this.initializeScenarioProgress(demoAssignment.id, track_id)

      return demoAssignment
    }
  }

  /**
   * Initialize scenario progress for a new assignment
   */
  private async initializeScenarioProgress(assignmentId: string, trackId: string): Promise<void> {
    try {
      // Get all scenarios in the track using scenarioService which has demo fallback
      const scenarios = await scenarioService.getScenariosByTrack(trackId)

      if (scenarios && scenarios.length > 0) {
        const progressData = scenarios.map(scenario => ({
          assignment_id: assignmentId,
          scenario_id: scenario.id,
          status: 'not_started' as ScenarioProgressStatus,
          attempts: 0,
          time_spent_minutes: 0
        }))

        const { error: insertError } = await supabaseAdmin
          .from('scenario_progress')
          .insert(progressData)

        if (insertError) throw insertError
      }
    } catch (error: any) {
      console.log('🚧 Demo mode: Would initialize scenario progress for assignment:', assignmentId)
      // In demo mode, we'll skip scenario progress initialization for now
    }
  }

  /**
   * Get assignments for an employee
   */
  async getEmployeeAssignments(employeeId: string): Promise<AssignmentWithDetails[]> {
    console.log('🔍 getEmployeeAssignments called with employeeId:', employeeId)
    try {
      // First get assignments (using correct production schema)
      console.log('🔍 Querying track_assignments with user_id:', employeeId)
      const { data: assignments, error } = await supabaseAdmin
        .from('track_assignments')
        .select('*')
        .eq('user_id', employeeId)  // Changed from employee_id to user_id
        // Removed .eq('is_active', true) as this column doesn't exist in production
        .order('assigned_at', { ascending: false })

      console.log('🔍 Query result - assignments:', assignments?.length || 0, 'error:', error?.message || 'none')
      if (error) throw error

      if (!assignments || assignments.length === 0) {
        return []
      }

      // Manually get track details for each assignment (since joins don't work)
      const assignmentsWithProgress = await Promise.all(
        assignments.map(async (assignment) => {
          // Get track details manually
          const { data: track, error: trackError } = await supabaseAdmin
            .from('tracks')
            .select('id, name, description, target_audience, company_id')
            .eq('id', assignment.track_id)
            .single()

          if (trackError) {
            console.error('Error fetching track for assignment:', assignment.id, trackError)
            return null
          }

          const scenarioProgress = await this.getAssignmentScenarioProgress(assignment.id)
          return {
            ...assignment,
            track,
            employee: { id: employeeId, name: 'Employee' } as Employee,
            scenario_progress: scenarioProgress
          } as AssignmentWithDetails
        })
      )

      // Filter out any null results
      return assignmentsWithProgress.filter(assignment => assignment !== null) as AssignmentWithDetails[]
    } catch (error: any) {
      console.error('❌ Production getEmployeeAssignments error:', error)
      console.error('   Error message:', error.message)
      console.error('   Error code:', error.code)
      console.log('🚧 Demo mode fallback: Getting employee assignments for:', employeeId)

      // 🚨 FIX: Load from file first to get current state
      const currentAssignments = loadDemoAssignments()
      console.log('🔍 DEBUG: LOADED FROM FILE for employee - Array length:', currentAssignments.length)
      console.log('🔍 DEBUG: LOADED FROM FILE - All assignment IDs:', currentAssignments.map(a => a.id))

      // 🔍 COMPREHENSIVE DEBUG LOGGING
      console.log('🔍 DEBUG: In-memory demoAssignments array:', JSON.stringify(demoAssignments, null, 2))
      console.log('🔍 DEBUG: Assignment active status:', currentAssignments.map(a => ({ id: a.id, active: a.is_active, employee: a.employee_id })))

      const employeeAssignments = currentAssignments.filter(a =>
        a.employee_id === employeeId && a.is_active
      )

      console.log(`📋 Found ${employeeAssignments.length} active demo assignments for employee ${employeeId}`)
      console.log(`📊 Total demo assignments in storage: ${demoAssignments.length}`)
      console.log('🔍 DEBUG: Filtered assignments for this employee:', employeeAssignments.map(a => ({ id: a.id, trackId: a.track_id })))

      // Get demo tracks from scenarioService
      const assignmentsWithDetails = await Promise.all(
        employeeAssignments.map(async (assignment) => {
          // Try to get actual track details from demo storage first
          let track: Track | null = null

          // Check if this is one of the demo tracks we created
          if (globalThis.__demoTracksStore) {
            track = globalThis.__demoTracksStore.find((t: Track) => t.id === assignment.track_id) || null
          }

          // If not found in demo storage, try to get from scenarioService
          if (!track) {
            try {
              track = await scenarioService.getTrack(assignment.track_id)
            } catch (error) {
              console.log('Could not fetch track details for:', assignment.track_id)
            }
          }

          // Final fallback track details
          if (!track) {
            track = {
              id: assignment.track_id,
              name: 'Demo Track',
              description: 'Demo training track',
              target_audience: 'new_hire' as const,
              company_id: 'demo-company-123',
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          }

          return {
            ...assignment,
            employee: { id: employeeId, name: 'Demo Employee' } as Employee,
            track,
            scenario_progress: []
          } as AssignmentWithDetails
        })
      )

      return assignmentsWithDetails
    }
  }

  /**
   * Get assignments for a company (manager view)
   */
  async getCompanyAssignments(companyId: string): Promise<AssignmentWithDetails[]> {
    try {
      const { data: assignments, error } = await supabaseAdmin
        .from('track_assignments')
        .select(`
          *,
          tracks!inner(
            id, name, description, target_audience, company_id
          )
        `)
        .eq('tracks.company_id', companyId)
        .eq('is_active', true)
        .order('assigned_at', { ascending: false })

      if (error) throw error

      const assignmentsWithProgress = await Promise.all(
        (assignments || []).map(async (assignment) => {
          const scenarioProgress = await this.getAssignmentScenarioProgress(assignment.id)
          return {
            ...assignment,
            track: assignment.tracks,
            scenario_progress: scenarioProgress
          } as AssignmentWithDetails
        })
      )

      return assignmentsWithProgress
    } catch (error: any) {
      console.log('🚧 Demo mode: Getting company assignments for:', companyId)
      return []
    }
  }

  /**
   * Get scenario progress for an assignment
   */
  async getAssignmentScenarioProgress(assignmentId: string): Promise<(ScenarioProgress & { scenario: Scenario })[]> {
    try {
      const { data: progress, error } = await supabaseAdmin
        .from('scenario_progress')
        .select(`
          *,
          scenarios!inner(
            id, title, description, scenario_type, difficulty, estimated_duration_minutes
          )
        `)
        .eq('assignment_id', assignmentId)
        .order('created_at', { ascending: true })

      if (error) throw error

      return (progress || []).map(p => ({
        ...p,
        scenario: p.scenarios
      })) as (ScenarioProgress & { scenario: Scenario })[]
    } catch (error: any) {
      console.log('🚧 Demo mode: Getting scenario progress for assignment:', assignmentId)

      // For demo mode, create mock progress data using demo scenarios
      const assignment = demoAssignments.find(a => a.id === assignmentId)
      if (assignment) {
        const scenarios = await scenarioService.getScenariosByTrack(assignment.track_id)
        return scenarios.map((scenario, index) => ({
          id: `demo-progress-${assignmentId}-${scenario.id}`,
          assignment_id: assignmentId,
          scenario_id: scenario.id,
          status: 'not_started' as ScenarioProgressStatus,
          attempts: 0,
          time_spent_minutes: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          scenario
        }))
      }

      return []
    }
  }

  /**
   * Update assignment progress
   */
  async updateAssignmentProgress(
    assignmentId: string,
    updates: UpdateAssignmentProgressData
  ): Promise<TrackAssignment> {
    if (assignmentId.startsWith('demo-assignment-')) {
      const assignmentIndex = demoAssignments.findIndex(a => a.id === assignmentId)
      if (assignmentIndex >= 0) {
        demoAssignments[assignmentIndex] = {
          ...demoAssignments[assignmentIndex],
          ...updates,
          updated_at: new Date().toISOString()
        }
        saveDemoAssignments(demoAssignments)
        return demoAssignments[assignmentIndex]
      }
      throw new Error('Demo assignment not found')
    }

    const { data: assignment, error } = await supabaseAdmin
      .from('track_assignments')
      .update(updates)
      .eq('id', assignmentId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update assignment: ${error.message}`)
    }

    return assignment
  }

  /**
   * Update scenario progress
   */
  async updateScenarioProgress(
    assignmentId: string,
    scenarioId: string,
    updates: UpdateScenarioProgressData
  ): Promise<ScenarioProgress> {
    try {
      // First try to update existing progress
      const { data: existing, error: selectError } = await supabaseAdmin
        .from('scenario_progress')
        .select('id')
        .eq('assignment_id', assignmentId)
        .eq('scenario_id', scenarioId)
        .single()

      if (selectError && selectError.code !== 'PGRST116') {
        throw selectError
      }

      if (existing) {
        // Update existing record
        const { data: progress, error } = await supabaseAdmin
          .from('scenario_progress')
          .update({
            ...updates,
            started_at: updates.status && !existing ? new Date().toISOString() : undefined,
            completed_at: updates.status === 'completed' ? new Date().toISOString() : undefined
          })
          .eq('id', existing.id)
          .select()
          .single()

        if (error) throw error
        return progress
      } else {
        // Create new record
        const { data: progress, error } = await supabaseAdmin
          .from('scenario_progress')
          .insert([
            {
              assignment_id: assignmentId,
              scenario_id: scenarioId,
              ...updates,
              attempts: updates.status ? 1 : 0,
              started_at: updates.status ? new Date().toISOString() : undefined,
              completed_at: updates.status === 'completed' ? new Date().toISOString() : undefined
            }
          ])
          .select()
          .single()

        if (error) throw error
        return progress
      }
    } catch (error: any) {
      console.log('🚧 Demo mode: Updating scenario progress')

      // Demo mode implementation
      const progressId = `demo-progress-${Date.now()}`
      const demoProgress: ScenarioProgress = {
        id: progressId,
        assignment_id: assignmentId,
        scenario_id: scenarioId,
        status: updates.status || 'not_started',
        score: updates.score,
        feedback: updates.feedback,
        attempts: 1,
        time_spent_minutes: updates.time_spent_minutes || 0,
        started_at: new Date().toISOString(),
        completed_at: updates.status === 'completed' ? new Date().toISOString() : undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const existingIndex = demoScenarioProgress.findIndex(p =>
        p.assignment_id === assignmentId && p.scenario_id === scenarioId
      )

      if (existingIndex >= 0) {
        demoScenarioProgress[existingIndex] = { ...demoScenarioProgress[existingIndex], ...demoProgress }
        saveDemoScenarioProgress(demoScenarioProgress)
        return demoScenarioProgress[existingIndex]
      } else {
        demoScenarioProgress.push(demoProgress)
        saveDemoScenarioProgress(demoScenarioProgress)
        return demoProgress
      }
    }
  }

  /**
   * Remove a track assignment
   */
  async removeTrackAssignment(assignmentId: string): Promise<void> {
    if (assignmentId.startsWith('demo-assignment-')) {
      console.log('🔍 DEBUG: BEFORE REMOVAL - In-memory array length:', demoAssignments.length)
      console.log('🔍 DEBUG: BEFORE REMOVAL - In-memory IDs:', demoAssignments.map(a => a.id))
      console.log('🔍 DEBUG: Attempting to remove assignment:', assignmentId)

      // 🚨 FIX: Always load from file first to get the current state
      const currentAssignments = loadDemoAssignments()
      console.log('🔍 DEBUG: LOADED FROM FILE - Array length:', currentAssignments.length)
      console.log('🔍 DEBUG: LOADED FROM FILE - All IDs:', currentAssignments.map(a => a.id))

      const assignmentIndex = currentAssignments.findIndex(a => a.id === assignmentId)
      console.log('🔍 DEBUG: Found assignment at index:', assignmentIndex)

      if (assignmentIndex >= 0) {
        // Actually remove the assignment from the loaded array
        currentAssignments.splice(assignmentIndex, 1)

        console.log('🔍 DEBUG: AFTER REMOVAL - Array length:', currentAssignments.length)
        console.log('🔍 DEBUG: AFTER REMOVAL - All IDs:', currentAssignments.map(a => a.id))

        // Save the updated array back to file
        saveDemoAssignments(currentAssignments)

        // Also update the in-memory array to keep it in sync
        demoAssignments.length = 0
        demoAssignments.push(...currentAssignments)

        console.log(`✅ Removed demo assignment ${assignmentId} from file and updated in-memory array`)

        // 🔍 DEBUG: Verify file contents immediately after save
        try {
          const fileContents = fs.readFileSync(ASSIGNMENTS_FILE, 'utf8')
          console.log('🔍 DEBUG: File contents after save:', fileContents)
        } catch (error) {
          console.log('🔍 DEBUG: Could not read file after save:', error)
        }
      } else {
        console.log('⚠️ DEBUG: Assignment not found in file:', assignmentId)
      }
      return
    }

    const { error } = await supabaseAdmin
      .from('track_assignments')
      .update({ is_active: false })
      .eq('id', assignmentId)

    if (error) {
      throw new Error(`Failed to remove assignment: ${error.message}`)
    }
  }

  /**
   * Check if employee has assignment for track
   */
  async hasTrackAssignment(employeeId: string, trackId: string): Promise<boolean> {
    try {
      const { data, error } = await supabaseAdmin
        .from('track_assignments')
        .select('id')
        .eq('user_id', employeeId)  // Changed from employee_id to user_id
        .eq('track_id', trackId)
        // Removed .eq('is_active', true) as this column doesn't exist in production
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return !!data
    } catch (error: any) {
      // Demo mode check
      return demoAssignments.some(a =>
        a.employee_id === employeeId &&
        a.track_id === trackId &&
        a.is_active
      )
    }
  }

  /**
   * Get a single assignment with full details
   */
  async getAssignmentWithDetails(assignmentId: string): Promise<AssignmentWithDetails | null> {
    try {
      console.log('🔍 Getting assignment with details for ID:', assignmentId)

      // Get assignment without JOIN (to work with production schema)
      const { data: assignment, error } = await supabaseAdmin
        .from('track_assignments')
        .select('*')
        .eq('id', assignmentId)
        .single()

      if (error) {
        console.log('❌ Assignment query error:', error.message)
        throw error
      }
      if (!assignment) {
        console.log('❌ Assignment not found')
        return null
      }

      console.log('✅ Assignment found:', assignment.id, 'for user_id:', assignment.user_id)

      // Manually get track details (replacing failed JOIN)
      const { data: track, error: trackError } = await supabaseAdmin
        .from('tracks')
        .select('*')
        .eq('id', assignment.track_id)
        .single()

      if (trackError) {
        console.log('❌ Track query error:', trackError.message)
        throw trackError
      }
      if (!track) {
        console.log('❌ Track not found for track_id:', assignment.track_id)
        throw new Error(`Track not found for track_id: ${assignment.track_id}`)
      }

      console.log('✅ Track found:', track.name)

      // Get scenarios for the track
      const { data: scenarios, error: scenariosError } = await supabaseAdmin
        .from('scenarios')
        .select('*')
        .eq('track_id', assignment.track_id)
        .eq('is_active', true)
        .order('created_at')

      if (scenariosError) {
        console.log('❌ Scenarios query error:', scenariosError.message)
        throw scenariosError
      }

      console.log('✅ Found', scenarios?.length || 0, 'scenarios for track')

      // Get scenario progress
      const scenarioProgress = await this.getAssignmentScenarioProgress(assignmentId)

      const result = {
        ...assignment,
        track: {
          ...track,
          scenarios: scenarios || []
        },
        employee: { id: assignment.user_id, name: 'Employee' } as Employee, // Note: using user_id for production
        scenario_progress: scenarioProgress
      } as AssignmentWithDetails

      console.log('✅ Assignment with details built successfully')
      return result

    } catch (error: any) {
      console.log('🚧 Demo mode: Getting assignment with details:', assignmentId)
      console.log('🔍 DEBUG: In-memory demoAssignments array length:', demoAssignments.length)
      console.log('🔍 DEBUG: In-memory assignment IDs:', demoAssignments.map(a => a.id))
      console.log('🔍 DEBUG: Looking for assignment ID:', assignmentId)

      // 🚨 FIX: Load from file first to get current state (same fix as deletion)
      const currentAssignments = loadDemoAssignments()
      console.log('🔍 DEBUG: LOADED FROM FILE - Array length:', currentAssignments.length)
      console.log('🔍 DEBUG: LOADED FROM FILE - All IDs:', currentAssignments.map(a => a.id))

      // Demo mode fallback
      const demoAssignment = currentAssignments.find(a => a.id === assignmentId)
      console.log('🔍 DEBUG: Found demo assignment in file:', demoAssignment ? 'YES' : 'NO')

      if (!demoAssignment) {
        console.log('🔍 DEBUG: Assignment not found in file, returning null')
        return null
      }

      return {
        ...demoAssignment,
        employee: { id: demoAssignment.employee_id, name: 'Demo Employee' } as Employee,
        track: {
          id: demoAssignment.track_id,
          name: 'New hire',
          description: 'Essential training for new employees',
          target_audience: 'new_hire' as const,
          company_id: '01f773e2-1027-490e-8d36-279136700bbf',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          scenarios: [{
            id: 'demo-scenario-1',
            track_id: demoAssignment.track_id,
            company_id: '01f773e2-1027-490e-8d36-279136700bbf',
            title: 'Theory Q&A',
            description: 'Knowledge-based questions about our products and services',
            scenario_type: 'theory' as const,
            template_type: 'general_flow' as const,
            client_behavior: 'N/A - Theory based',
            expected_response: 'N/A - Theory based',
            difficulty: 'beginner' as const,
            estimated_duration_minutes: 15,
            milestones: [],
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]
        },
        scenario_progress: []
      } as AssignmentWithDetails
    }
  }

  /**
   * Update assignment
   */
  async updateAssignment(assignmentId: string, updates: Partial<TrackAssignment>): Promise<TrackAssignment> {
    try {
      const { data: assignment, error } = await supabaseAdmin
        .from('track_assignments')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', assignmentId)
        .select()
        .single()

      if (error) throw error
      return assignment

    } catch (error: any) {
      console.log('🚧 Demo mode: Updating assignment:', assignmentId)

      // Demo mode fallback
      const assignmentIndex = demoAssignments.findIndex(a => a.id === assignmentId)
      if (assignmentIndex >= 0) {
        demoAssignments[assignmentIndex] = {
          ...demoAssignments[assignmentIndex],
          ...updates,
          updated_at: new Date().toISOString()
        }
        saveDemoAssignments(demoAssignments)
        return demoAssignments[assignmentIndex]
      }
      throw new Error('Assignment not found')
    }
  }

  /**
   * Update scenario progress and recalculate assignment progress
   */
  async updateScenarioProgressAndAssignment(
    assignmentId: string,
    scenarioId: string,
    status: ScenarioProgressStatus,
    score?: number
  ): Promise<AssignmentWithDetails | null> {
    await this.updateScenarioProgress(assignmentId, scenarioId, {
      status,
      score,
      time_spent_minutes: 1
    })

    // Update overall assignment progress
    const assignment = await this.getAssignmentWithDetails(assignmentId)
    if (!assignment) return null

    // Calculate new progress percentage
    const totalScenarios = assignment.track.scenarios?.length || 1
    const completedScenarios = assignment.scenario_progress.filter(p => p.status === 'completed').length
    const progressPercentage = Math.round((completedScenarios / totalScenarios) * 100)

    const newStatus = progressPercentage === 100 ? 'completed' :
                     progressPercentage > 0 ? 'in_progress' : 'assigned'

    await this.updateAssignment(assignmentId, {
      status: newStatus,
      progress_percentage: progressPercentage,
      started_at: newStatus !== 'assigned' ? new Date().toISOString() : assignment.started_at,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : undefined
    })

    return this.getAssignmentWithDetails(assignmentId)
  }

  /**
   * Get assignment statistics for a company
   */
  async getCompanyAssignmentStats(companyId: string): Promise<{
    total: number
    assigned: number
    inProgress: number
    completed: number
    averageProgress: number
  }> {
    try {
      const assignments = await this.getCompanyAssignments(companyId)

      const total = assignments.length
      const assigned = assignments.filter(a => a.status === 'assigned').length
      const inProgress = assignments.filter(a => a.status === 'in_progress').length
      const completed = assignments.filter(a => a.status === 'completed').length

      const averageProgress = total > 0
        ? Math.round(assignments.reduce((sum, a) => sum + a.progress_percentage, 0) / total)
        : 0

      return {
        total,
        assigned,
        inProgress,
        completed,
        averageProgress
      }
    } catch (error) {
      return {
        total: 0,
        assigned: 0,
        inProgress: 0,
        completed: 0,
        averageProgress: 0
      }
    }
  }
}

// Export singleton instance
export const trackAssignmentService = new TrackAssignmentService()