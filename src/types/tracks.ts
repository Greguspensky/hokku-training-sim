/**
 * Track Type Definitions
 * Training tracks and track assignments
 */

export type TargetAudience = 'new_hire' | 'existing_employee';

export interface Track {
  id: string;
  company_id: string;
  name: string;
  description: string;
  target_audience: TargetAudience;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  scenario_count?: number;
}

export interface CreateTrackData {
  company_id: string;
  name: string;
  description: string;
  target_audience: TargetAudience;
}

export interface UpdateTrackData {
  name?: string;
  description?: string;
  target_audience?: TargetAudience;
  is_active?: boolean;
}

export interface TrackAssignment {
  id: string;
  track_id: string;
  employee_id: string;
  company_id: string;
  assigned_at: string;
  completed_at?: string;
  is_active: boolean;
}

export interface TrackProgress {
  track_id: string;
  track_name: string;
  total_scenarios: number;
  completed_scenarios: number;
  in_progress_scenarios: number;
  completion_percentage: number;
}
