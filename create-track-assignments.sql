-- Create track assignments system
-- Run this in Supabase SQL Editor

-- Create track_assignments table
CREATE TABLE IF NOT EXISTS track_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL,
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('assigned', 'in_progress', 'completed', 'cancelled')) DEFAULT 'assigned',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_track_assignments_employee_id ON track_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_track_assignments_track_id ON track_assignments(track_id);
CREATE INDEX IF NOT EXISTS idx_track_assignments_status ON track_assignments(status);
CREATE INDEX IF NOT EXISTS idx_track_assignments_assigned_at ON track_assignments(assigned_at);

-- Enable RLS
ALTER TABLE track_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Employees can view their own assignments
CREATE POLICY "Employees can view own track assignments" ON track_assignments
  FOR SELECT USING (
    employee_id IN (
      SELECT id FROM users WHERE auth.uid() = id
    )
  );

-- Managers can view assignments for their company's employees
CREATE POLICY "Managers can view company track assignments" ON track_assignments
  FOR SELECT USING (
    track_id IN (
      SELECT t.id FROM tracks t
      INNER JOIN company_members cm ON t.company_id = cm.company_id
      WHERE cm.user_id = auth.uid() AND cm.role IN ('owner', 'manager')
    )
  );

-- Managers can create assignments for their company's tracks
CREATE POLICY "Managers can create track assignments" ON track_assignments
  FOR INSERT WITH CHECK (
    track_id IN (
      SELECT t.id FROM tracks t
      INNER JOIN company_members cm ON t.company_id = cm.company_id
      WHERE cm.user_id = auth.uid() AND cm.role IN ('owner', 'manager')
    )
  );

-- Managers can update assignments for their company
CREATE POLICY "Managers can update track assignments" ON track_assignments
  FOR UPDATE USING (
    track_id IN (
      SELECT t.id FROM tracks t
      INNER JOIN company_members cm ON t.company_id = cm.company_id
      WHERE cm.user_id = auth.uid() AND cm.role IN ('owner', 'manager')
    )
  );

-- Employees can update their own assignment progress
CREATE POLICY "Employees can update own assignment progress" ON track_assignments
  FOR UPDATE USING (
    employee_id IN (
      SELECT id FROM users WHERE auth.uid() = id
    )
  ) WITH CHECK (
    employee_id IN (
      SELECT id FROM users WHERE auth.uid() = id
    )
  );

-- Managers can delete assignments for their company
CREATE POLICY "Managers can delete track assignments" ON track_assignments
  FOR DELETE USING (
    track_id IN (
      SELECT t.id FROM tracks t
      INNER JOIN company_members cm ON t.company_id = cm.company_id
      WHERE cm.user_id = auth.uid() AND cm.role IN ('owner', 'manager')
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_track_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_track_assignments_updated_at ON track_assignments;
CREATE TRIGGER update_track_assignments_updated_at
  BEFORE UPDATE ON track_assignments
  FOR EACH ROW EXECUTE FUNCTION update_track_assignments_updated_at();

-- Create scenario_progress table to track individual scenario completion
CREATE TABLE IF NOT EXISTS scenario_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID REFERENCES track_assignments(id) ON DELETE CASCADE,
  scenario_id UUID REFERENCES scenarios(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('not_started', 'in_progress', 'completed', 'skipped')) DEFAULT 'not_started',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  score INTEGER CHECK (score >= 0 AND score <= 100),
  feedback TEXT,
  attempts INTEGER DEFAULT 0,
  time_spent_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assignment_id, scenario_id)
);

-- Add indexes for scenario_progress
CREATE INDEX IF NOT EXISTS idx_scenario_progress_assignment_id ON scenario_progress(assignment_id);
CREATE INDEX IF NOT EXISTS idx_scenario_progress_scenario_id ON scenario_progress(scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_progress_status ON scenario_progress(status);

-- Enable RLS for scenario_progress
ALTER TABLE scenario_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scenario_progress
-- Employees can view their own scenario progress
CREATE POLICY "Employees can view own scenario progress" ON scenario_progress
  FOR SELECT USING (
    assignment_id IN (
      SELECT id FROM track_assignments WHERE employee_id IN (
        SELECT id FROM users WHERE auth.uid() = id
      )
    )
  );

-- Managers can view scenario progress for their company
CREATE POLICY "Managers can view company scenario progress" ON scenario_progress
  FOR SELECT USING (
    assignment_id IN (
      SELECT ta.id FROM track_assignments ta
      INNER JOIN tracks t ON ta.track_id = t.id
      INNER JOIN company_members cm ON t.company_id = cm.company_id
      WHERE cm.user_id = auth.uid() AND cm.role IN ('owner', 'manager')
    )
  );

-- Employees can update their own scenario progress
CREATE POLICY "Employees can update own scenario progress" ON scenario_progress
  FOR ALL USING (
    assignment_id IN (
      SELECT id FROM track_assignments WHERE employee_id IN (
        SELECT id FROM users WHERE auth.uid() = id
      )
    )
  );

-- Create trigger for scenario_progress updated_at
DROP TRIGGER IF EXISTS update_scenario_progress_updated_at ON scenario_progress;
CREATE TRIGGER update_scenario_progress_updated_at
  BEFORE UPDATE ON scenario_progress
  FOR EACH ROW EXECUTE FUNCTION update_track_assignments_updated_at();

-- Create function to automatically update track assignment progress
CREATE OR REPLACE FUNCTION update_track_assignment_progress()
RETURNS TRIGGER AS $$
DECLARE
  total_scenarios INTEGER;
  completed_scenarios INTEGER;
  new_progress INTEGER;
  assignment_record RECORD;
BEGIN
  -- Get the assignment record
  SELECT * INTO assignment_record FROM track_assignments WHERE id = NEW.assignment_id;

  -- Count total scenarios in the track
  SELECT COUNT(*) INTO total_scenarios
  FROM scenarios
  WHERE track_id = assignment_record.track_id AND is_active = true;

  -- Count completed scenarios
  SELECT COUNT(*) INTO completed_scenarios
  FROM scenario_progress
  WHERE assignment_id = NEW.assignment_id AND status = 'completed';

  -- Calculate new progress percentage
  IF total_scenarios > 0 THEN
    new_progress := (completed_scenarios * 100) / total_scenarios;
  ELSE
    new_progress := 0;
  END IF;

  -- Update track assignment progress
  UPDATE track_assignments
  SET
    progress_percentage = new_progress,
    status = CASE
      WHEN new_progress = 100 THEN 'completed'
      WHEN new_progress > 0 AND status = 'assigned' THEN 'in_progress'
      ELSE status
    END,
    completed_at = CASE
      WHEN new_progress = 100 AND completed_at IS NULL THEN NOW()
      ELSE completed_at
    END,
    started_at = CASE
      WHEN new_progress > 0 AND started_at IS NULL THEN NOW()
      ELSE started_at
    END
  WHERE id = NEW.assignment_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update progress
DROP TRIGGER IF EXISTS auto_update_track_progress ON scenario_progress;
CREATE TRIGGER auto_update_track_progress
  AFTER INSERT OR UPDATE ON scenario_progress
  FOR EACH ROW EXECUTE FUNCTION update_track_assignment_progress();