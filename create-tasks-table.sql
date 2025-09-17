-- Drop existing table if it exists (optional, remove if you want to keep existing data)
-- DROP TABLE IF EXISTS tasks;

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable Row Level Security (RLS)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations (for development)
-- This allows anyone to read/write without authentication
CREATE POLICY "Allow all operations for tasks" ON tasks
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);

-- Optional: Insert a test task to verify everything works
INSERT INTO tasks (title, description, tags, completed)
VALUES (
  'Test Task from SQL', 
  'This is a test task created directly in Supabase', 
  ARRAY['test', 'supabase', 'sql'],
  false
);

-- Verify the table was created and has data
SELECT * FROM tasks;
