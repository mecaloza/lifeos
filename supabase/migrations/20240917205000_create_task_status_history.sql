-- Create task status history table to track flow transitions
CREATE TABLE IF NOT EXISTS task_status_history (
  id BIGSERIAL PRIMARY KEY,
  task_id BIGINT REFERENCES tasks(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  duration_in_previous_status INTERVAL
);

-- Enable Row Level Security (RLS)
ALTER TABLE task_status_history ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations (for development)
CREATE POLICY "Allow all operations for task_status_history" ON task_status_history
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_task_status_history_task_id ON task_status_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_status_history_changed_at ON task_status_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_status_history_to_status ON task_status_history(to_status);

-- Function to automatically track status changes
CREATE OR REPLACE FUNCTION track_task_status_change()
RETURNS TRIGGER AS $$
DECLARE
  previous_status_entry RECORD;
  time_in_previous_status INTERVAL;
BEGIN
  -- Only track if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Calculate duration in previous status
    IF OLD.status IS NOT NULL THEN
      SELECT changed_at INTO previous_status_entry
      FROM task_status_history 
      WHERE task_id = NEW.id AND to_status = OLD.status 
      ORDER BY changed_at DESC 
      LIMIT 1;
      
      IF previous_status_entry.changed_at IS NOT NULL THEN
        time_in_previous_status := NOW() - previous_status_entry.changed_at;
      ELSE
        -- If no previous entry, calculate from task creation
        time_in_previous_status := NOW() - OLD.created_at;
      END IF;
    ELSE
      time_in_previous_status := NULL;
    END IF;

    -- Insert the status change record
    INSERT INTO task_status_history (
      task_id, 
      from_status, 
      to_status, 
      changed_at, 
      duration_in_previous_status
    ) VALUES (
      NEW.id, 
      OLD.status, 
      NEW.status, 
      NOW(), 
      time_in_previous_status
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically track status changes
DROP TRIGGER IF EXISTS task_status_change_trigger ON tasks;
CREATE TRIGGER task_status_change_trigger
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION track_task_status_change();

-- Insert initial status for existing tasks
INSERT INTO task_status_history (task_id, from_status, to_status, changed_at)
SELECT 
  id, 
  NULL, 
  COALESCE(status, 'backlog'), 
  created_at
FROM tasks 
WHERE id NOT IN (SELECT DISTINCT task_id FROM task_status_history WHERE task_id IS NOT NULL);
