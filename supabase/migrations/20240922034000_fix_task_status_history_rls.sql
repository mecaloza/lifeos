-- Fix RLS for task_status_history table to allow anonymous access (for development)
DROP POLICY IF EXISTS "Users can only access their own task history" ON task_status_history;
DROP POLICY IF EXISTS "Allow all task_status_history operations" ON task_status_history;

-- Create permissive policy for all operations
CREATE POLICY "Allow all task_status_history operations" ON task_status_history
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Drop any user_id trigger if exists
DROP TRIGGER IF EXISTS set_user_id_task_status_history ON task_status_history;
