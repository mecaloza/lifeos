-- Update start_time column to use timestamp without timezone
-- This prevents automatic timezone conversion
ALTER TABLE tasks ALTER COLUMN start_time TYPE TIMESTAMP WITHOUT TIME ZONE;

-- Update existing tasks to remove timezone offset for consistent display
UPDATE tasks 
SET start_time = start_time AT TIME ZONE 'UTC' 
WHERE start_time IS NOT NULL;

-- Add a comment to clarify this stores local time
COMMENT ON COLUMN tasks.start_time IS 'Local time without timezone conversion - stores time as entered by user';
