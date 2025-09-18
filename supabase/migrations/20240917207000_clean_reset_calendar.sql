-- Complete reset of calendar functionality with proper timezone handling
-- Reset all scheduled tasks to unscheduled to start fresh
UPDATE tasks 
SET 
  start_time = NULL,
  is_scheduled = FALSE,
  duration_minutes = 60
WHERE is_scheduled = TRUE;

-- Ensure the column is properly set to timestamp without timezone
ALTER TABLE tasks ALTER COLUMN start_time TYPE TIMESTAMP WITHOUT TIME ZONE;
