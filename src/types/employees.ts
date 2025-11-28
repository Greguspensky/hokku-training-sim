/**
 * Employee Type Definitions
 * Employee data, invitations, and progress tracking
 */

export interface Employee {
  id: string;
  name: string;
  email?: string;
  company_id: string;
  manager_id: string;
  invite_token: string;
  is_active: boolean;
  has_joined: boolean;
  created_at: string;
  joined_at?: string;
  user_id?: string; // Auth user ID
}

export interface CreateEmployeeData {
  name: string;
  company_id: string;
  manager_id: string;
}

export interface UpdateEmployeeData {
  name?: string;
  email?: string;
  is_active?: boolean;
  has_joined?: boolean;
  joined_at?: string;
  user_id?: string;
}

export interface EmployeeSignupData {
  email: string;
  password: string;
  invite_token: string;
}

export interface InviteTokenData {
  employee_id: string;
  employee_name: string;
  company_id: string;
  company_name?: string;
  manager_id: string;
  is_valid: boolean;
}

export interface EmployeeProgress {
  employee_id: string;
  employee_name: string;
  total_sessions: number;
  completed_scenarios: number;
  avg_score?: number;
  last_session_date?: string;
}

export interface EmployeeStats {
  total_employees: number;
  active_employees: number;
  pending_invites: number;
  avg_completion_rate: number;
}
