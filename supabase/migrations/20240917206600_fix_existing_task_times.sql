-- Fix existing scheduled tasks that have wrong dates due to timezone conversion
-- This will reset all scheduled tasks to unscheduled so they can be re-scheduled correctly
UPDATE tasks 
SET 
  start_time = NULL,
  is_scheduled = FALSE
WHERE is_scheduled = TRUE;
