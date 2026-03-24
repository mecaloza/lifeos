-- Fix RLS for tasks table to allow anonymous access (for development)
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can only access their own tasks" ON tasks;
DROP POLICY IF EXISTS "Enable read access for all users" ON tasks;
DROP POLICY IF EXISTS "Enable insert access for all users" ON tasks;
DROP POLICY IF EXISTS "Enable update access for all users" ON tasks;
DROP POLICY IF EXISTS "Enable delete access for all users" ON tasks;

-- Create permissive policy for all operations
CREATE POLICY "Allow all task operations" ON tasks
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Also drop any trigger that might be setting user_id
DROP TRIGGER IF EXISTS set_user_id_tasks ON tasks;
DROP FUNCTION IF EXISTS set_user_id_on_tasks();
