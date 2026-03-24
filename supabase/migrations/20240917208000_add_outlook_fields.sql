-- Add Outlook integration fields to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS outlook_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS outlook_account TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS location TEXT;

-- Create indexes for Outlook integration
CREATE INDEX IF NOT EXISTS idx_tasks_outlook_id ON tasks(outlook_id);
CREATE INDEX IF NOT EXISTS idx_tasks_outlook_account ON tasks(outlook_account);
CREATE INDEX IF NOT EXISTS idx_tasks_source ON tasks(source);

-- Add constraint to prevent duplicate Outlook events
ALTER TABLE tasks ADD CONSTRAINT unique_outlook_event UNIQUE (outlook_id) DEFERRABLE INITIALLY DEFERRED;
