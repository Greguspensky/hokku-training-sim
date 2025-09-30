import { supabaseAdmin } from './supabase'
import { Track, Scenario } from './scenarios'
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

class TrackAssignmentService {
  /**
   * Assign a track to an employee
   */
  async assignTrackToEmployee(data: CreateTrackAssignmentData): Promise<TrackAssignment> {
    const { data: assignment, error } = await supabaseAdmin
      .from('track_assignments')
      .insert({
        employee_id: data.employee_id,
        track_id: data.track_id,
        assigned_by: data.assigned_by,
        assigned_at: new Date().toISOString(),
        status: 'assigned',
        progress_percentage: 0,
        notes: data.notes || null,
        is_active: true
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // Initialize scenario progress for all scenarios in the track
    await this.initializeScenarioProgress(assignment.id, data.track_id)

    return assignment
  }

  /**
   * Initialize scenario progress for all scenarios in a track
   */
  private async initializeScenarioProgress(assignmentId: string, trackId: string): Promise<void> {
    // Get all scenarios for the track
    const { data: scenarios, error: scenariosError } = await supabaseAdmin
      .from('scenarios')
      .select('id')
      .eq('track_id', trackId)
      .eq('is_active', true)

    if (scenariosError) {
      console.error('Error fetching scenarios for progress initialization:', scenariosError)
      return
    }

    if (!scenarios || scenarios.length === 0) {
      console.log('No scenarios found for track', trackId)
      return
    }

    // Create progress entries for each scenario
    const progressEntries = scenarios.map(scenario => ({
      assignment_id: assignmentId,
      scenario_id: scenario.id,
      status: 'not_started' as ScenarioProgressStatus,
      attempts: 0,
      time_spent_minutes: 0
    }))

    const { error: progressError } = await supabaseAdmin
      .from('scenario_progress')
      .insert(progressEntries)

    if (progressError) {
      console.error('Error initializing scenario progress:', progressError)
    }
  }

  /**
   * Get assignments for an employee
   */
  async getEmployeeAssignments(employeeId: string): Promise<TrackAssignment[]> {
    const { data: assignments, error } = await supabaseAdmin
      .from('track_assignments')
      .select(`
        *,
        track:tracks(*)
      `)
      .eq('employee_id', employeeId)
      .eq('is_active', true)
      .order('assigned_at', { ascending: false })

    if (error) {
      throw error
    }

    return assignments || []
  }

  /**
   * Get scenario progress for an assignment
   */
  async getAssignmentScenarioProgress(assignmentId: string): Promise<ScenarioProgress[]> {
    const { data: progress, error } = await supabaseAdmin
      .from('scenario_progress')
      .select(`
        *,
        scenario:scenarios(*)
      `)
      .eq('assignment_id', assignmentId)
      .order('created_at')

    if (error) {
      throw error
    }

    return progress || []
  }

  /**
   * Update assignment progress
   */
  async updateAssignmentProgress(
    assignmentId: string,
    updates: UpdateAssignmentProgressData
  ): Promise<TrackAssignment> {
    const { data: assignment, error } = await supabaseAdmin
      .from('track_assignments')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', assignmentId)
      .select()
      .single()

    if (error) {
      throw error
    }

    return assignment
  }

  /**
   * Update scenario progress
   */
  async updateScenarioProgress(
    progressId: string,
    updates: UpdateScenarioProgressData
  ): Promise<ScenarioProgress> {
    const { data: progress, error } = await supabaseAdmin
      .from('scenario_progress')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', progressId)
      .select()
      .single()

    if (error) {
      throw error
    }

    return progress
  }

  /**
   * Remove a track assignment
   */
  async removeTrackAssignment(assignmentId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('track_assignments')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', assignmentId)

    if (error) {
      throw error
    }
  }

  /**
   * Get assignment with full details
   */
  async getAssignmentWithDetails(assignmentId: string): Promise<AssignmentWithDetails | null> {
    const { data: assignment, error } = await supabaseAdmin
      .from('track_assignments')
      .select(`
        *,
        track:tracks(*),
        employee:employees(*)
      `)
      .eq('id', assignmentId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw error
    }

    // Get scenario progress
    const scenarioProgress = await this.getAssignmentScenarioProgress(assignmentId)

    return {
      ...assignment,
      scenario_progress: scenarioProgress
    } as AssignmentWithDetails
  }

  /**
   * Get assignment details by ID
   */
  async getAssignmentDetails(assignmentId: string): Promise<TrackAssignment | null> {
    const { data: assignment, error } = await supabaseAdmin
      .from('track_assignments')
      .select('*')
      .eq('id', assignmentId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw error
    }

    return assignment
  }

  /**
   * Update assignment details
   */
  async updateAssignment(
    assignmentId: string,
    updates: Partial<TrackAssignment>
  ): Promise<TrackAssignment> {
    const { data: assignment, error } = await supabaseAdmin
      .from('track_assignments')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', assignmentId)
      .select()
      .single()

    if (error) {
      throw error
    }

    return assignment
  }
}

export const trackAssignmentService = new TrackAssignmentService()