-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#3B82F6', -- Default blue color
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable Row Level Security (RLS)
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations (for development)
CREATE POLICY "Allow all operations for tags" ON tags
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- Insert some default tags
INSERT INTO tags (name, color) VALUES 
  ('Work', '#EF4444'),        -- Red
  ('Personal', '#10B981'),    -- Green  
  ('Urgent', '#F59E0B'),      -- Yellow
  ('Shopping', '#8B5CF6'),    -- Purple
  ('Health', '#06B6D4'),      -- Cyan
  ('Learning', '#F97316'),    -- Orange
  ('Finance', '#84CC16'),     -- Lime
  ('Project', '#3B82F6'),     -- Blue
  ('Meeting', '#EC4899'),     -- Pink
  ('Travel', '#14B8A6')       -- Teal
ON CONFLICT (name) DO NOTHING;
