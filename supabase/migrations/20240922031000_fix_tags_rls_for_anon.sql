-- Fix RLS for tags table to allow anonymous access (for development)
-- This allows the app to work without authentication

-- Drop the restrictive policy that requires user authentication
DROP POLICY IF EXISTS "Users can only access their own tags" ON tags;

-- Create a permissive policy that allows all operations
-- For production, you should implement proper authentication
CREATE POLICY "Allow all tag operations" ON tags
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Drop the trigger that tries to set user_id (fails for anonymous users)
DROP TRIGGER IF EXISTS set_user_id_tags ON tags;

-- Make user_id nullable for tags (system-wide tags don't need a user)
ALTER TABLE tags ALTER COLUMN user_id DROP NOT NULL;

