-- Add session names visibility configuration column to company_settings table

ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS show_session_names_to_employees BOOLEAN DEFAULT false;

-- Add comment to describe the column
COMMENT ON COLUMN company_settings.show_session_names_to_employees IS 'Controls whether employees can see actual scenario names or generic placeholders (e.g., "Training Session 1"). Default is false (hidden) for "surprise mode" effect.';

-- Update existing rows to have default value if they don't already
UPDATE company_settings
SET show_session_names_to_employees = false
WHERE show_session_names_to_employees IS NULL;
