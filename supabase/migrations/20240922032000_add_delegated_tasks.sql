-- Add delegation fields to tasks table
-- For tracking tasks assigned to team members

-- Add delegation columns
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_delegated BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS delegated_to TEXT; -- Name of team member
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS delegation_status TEXT DEFAULT 'to_deliver'; -- to_deliver, delivered, done
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS delegation_notes TEXT; -- Notes about the delegation
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS delegated_at TIMESTAMP WITH TIME ZONE; -- When it was delegated

-- Create index for faster queries on delegated tasks
CREATE INDEX IF NOT EXISTS idx_tasks_is_delegated ON tasks(is_delegated) WHERE is_delegated = TRUE;
CREATE INDEX IF NOT EXISTS idx_tasks_delegation_status ON tasks(delegation_status);

-- Create a team_members table for storing team member names (optional, for autocomplete)
CREATE TABLE IF NOT EXISTS team_members (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS on team_members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Allow all operations on team_members (for development)
CREATE POLICY "Allow all team_members operations" ON team_members
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

