-- Add priority system to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';

-- Add constraint to ensure valid priority values
ALTER TABLE tasks ADD CONSTRAINT check_priority_values 
  CHECK (priority IN ('urgent', 'high', 'medium', 'low'));

-- Create index for priority-based queries
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);

-- Update existing tasks to have medium priority
UPDATE tasks SET priority = 'medium' WHERE priority IS NULL;


