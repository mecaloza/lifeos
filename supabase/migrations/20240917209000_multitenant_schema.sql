-- Multi-tenant SaaS schema for LifeOS
-- Add user_id to all tables for data isolation

-- Add user_id to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to tags table  
ALTER TABLE tags ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to task_status_history table
ALTER TABLE task_status_history ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create user_outlook_accounts table for multiple account management
CREATE TABLE IF NOT EXISTS user_outlook_accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL, -- Microsoft account ID
  email TEXT NOT NULL,
  display_name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  access_token_encrypted TEXT, -- Encrypted storage
  refresh_token_encrypted TEXT, -- Encrypted storage
  token_expires_at TIMESTAMP WITH TIME ZONE,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(user_id, account_id)
);

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone TEXT DEFAULT 'UTC',
  week_start_day INTEGER DEFAULT 1, -- 1 = Monday
  work_hours_start TIME DEFAULT '09:00',
  work_hours_end TIME DEFAULT '17:00',
  auto_sync_calendars BOOLEAN DEFAULT TRUE,
  sync_frequency_minutes INTEGER DEFAULT 15,
  theme TEXT DEFAULT 'dark',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(user_id)
);

-- Update RLS policies for multi-tenancy
-- Tasks table RLS
DROP POLICY IF EXISTS "Allow all operations for tasks" ON tasks;
CREATE POLICY "Users can only access their own tasks" ON tasks
  FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- Tags table RLS  
DROP POLICY IF EXISTS "Allow all operations for tags" ON tags;
CREATE POLICY "Users can only access their own tags" ON tags
  FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- Task status history RLS
DROP POLICY IF EXISTS "Allow all operations for task_status_history" ON task_status_history;
CREATE POLICY "Users can only access their own task history" ON task_status_history
  FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- User Outlook accounts RLS
ALTER TABLE user_outlook_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own outlook accounts" ON user_outlook_accounts
  FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- User preferences RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own preferences" ON user_preferences
  FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- Function to automatically set user_id on insert
CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically set user_id
CREATE TRIGGER set_user_id_tasks BEFORE INSERT ON tasks FOR EACH ROW EXECUTE FUNCTION set_user_id();
CREATE TRIGGER set_user_id_tags BEFORE INSERT ON tags FOR EACH ROW EXECUTE FUNCTION set_user_id();
CREATE TRIGGER set_user_id_history BEFORE INSERT ON task_status_history FOR EACH ROW EXECUTE FUNCTION set_user_id();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_task_status_history_user_id ON task_status_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_outlook_accounts_user_id ON user_outlook_accounts(user_id);

