-- Add status column to tasks table for Kanban functionality
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'backlog';

-- Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- Update existing tasks to have backlog status if null
UPDATE tasks SET status = 'backlog' WHERE status IS NULL;
