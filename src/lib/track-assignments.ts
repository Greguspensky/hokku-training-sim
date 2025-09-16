import { supabase } from './supabase'
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

// Demo storage for development
const demoAssignments: TrackAssignment[] = globalThis.__demoTrackAssignmentsStore || []
const demoScenarioProgress: ScenarioProgress[] = globalThis.__demoScenarioProgressStore || []

// Persist demo data across hot reloads
globalThis.__demoTrackAssignmentsStore = demoAssignments
globalThis.__demoScenarioProgressStore = demoScenarioProgress

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
      const { data: assignment, error } = await supabase
        .from('track_assignments')
        .insert([
          {
            employee_id,
            track_id,
            assigned_by,
            notes,
            status: 'assigned',
            progress_percentage: 0
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
      // Get all scenarios in the track
      const { data: scenarios, error } = await supabase
        .from('scenarios')
        .select('id')
        .eq('track_id', trackId)
        .eq('is_active', true)

      if (error) throw error

      if (scenarios && scenarios.length > 0) {
        const progressData = scenarios.map(scenario => ({
          assignment_id: assignmentId,
          scenario_id: scenario.id,
          status: 'not_started' as ScenarioProgressStatus,
          attempts: 0,
          time_spent_minutes: 0
        }))

        const { error: insertError } = await supabase
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
    try {
      const { data: assignments, error } = await supabase
        .from('track_assignments')
        .select(`
          *,
          tracks!inner(
            id, name, description, target_audience, company_id
          )
        `)
        .eq('employee_id', employeeId)
        .eq('is_active', true)
        .order('assigned_at', { ascending: false })

      if (error) throw error

      // Get scenario progress for each assignment
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
      console.log('🚧 Demo mode: Getting employee assignments for:', employeeId)

      const employeeAssignments = demoAssignments.filter(a =>
        a.employee_id === employeeId && a.is_active
      )

      // Mock track data for demo assignments
      return employeeAssignments.map(assignment => ({
        ...assignment,
        employee: { id: employeeId, name: 'Demo Employee' } as Employee,
        track: {
          id: assignment.track_id,
          name: 'Demo Track',
          description: 'Demo training track',
          target_audience: 'new_hire' as const,
          company_id: 'demo-company-1'
        } as Track,
        scenario_progress: []
      })) as AssignmentWithDetails[]
    }
  }

  /**
   * Get assignments for a company (manager view)
   */
  async getCompanyAssignments(companyId: string): Promise<AssignmentWithDetails[]> {
    try {
      const { data: assignments, error } = await supabase
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
      const { data: progress, error } = await supabase
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
        return demoAssignments[assignmentIndex]
      }
      throw new Error('Demo assignment not found')
    }

    const { data: assignment, error } = await supabase
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
      const { data: existing, error: selectError } = await supabase
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
        const { data: progress, error } = await supabase
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
        const { data: progress, error } = await supabase
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
        return demoScenarioProgress[existingIndex]
      } else {
        demoScenarioProgress.push(demoProgress)
        return demoProgress
      }
    }
  }

  /**
   * Remove a track assignment
   */
  async removeTrackAssignment(assignmentId: string): Promise<void> {
    if (assignmentId.startsWith('demo-assignment-')) {
      const assignmentIndex = demoAssignments.findIndex(a => a.id === assignmentId)
      if (assignmentIndex >= 0) {
        demoAssignments[assignmentIndex].is_active = false
      }
      return
    }

    const { error } = await supabase
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
      const { data, error } = await supabase
        .from('track_assignments')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('track_id', trackId)
        .eq('is_active', true)
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