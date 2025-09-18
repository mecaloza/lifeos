-- Create notes table with rich text support and task linking
CREATE TABLE IF NOT EXISTS notes (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content_html TEXT, -- Store rich HTML content with embedded images
  content_text TEXT, -- Plain text version for searching
  task_id BIGINT REFERENCES tasks(id) ON DELETE SET NULL, -- Optional link to a task
  is_pinned BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create attachments table for images and files
CREATE TABLE IF NOT EXISTS note_attachments (
  id BIGSERIAL PRIMARY KEY,
  note_id BIGINT REFERENCES notes(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL, -- Supabase storage URL
  file_type TEXT NOT NULL, -- image/png, image/jpeg, etc.
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable Row Level Security (RLS)
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies for development (allow all operations)
CREATE POLICY "Allow all operations for notes" ON notes
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Allow all operations for note_attachments" ON note_attachments
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_task_id ON notes(task_id);
CREATE INDEX IF NOT EXISTS idx_notes_title ON notes USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_notes_content_text ON notes USING gin(to_tsvector('english', content_text));
CREATE INDEX IF NOT EXISTS idx_notes_tags ON notes USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned);
CREATE INDEX IF NOT EXISTS idx_note_attachments_note_id ON note_attachments(note_id);

-- Create updated_at trigger for notes
CREATE OR REPLACE FUNCTION update_notes_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notes_updated_at_trigger
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_notes_updated_at_column();

-- Insert some sample notes for testing
INSERT INTO notes (title, content_text, tags) VALUES 
  ('Welcome to Notes', 'This is your first note! You can take notes about anything, add images, and link them to specific tasks.', ARRAY['welcome', 'getting-started']),
  ('Project Ideas', 'Ideas for upcoming projects and improvements to the system.', ARRAY['ideas', 'projects']),
  ('Meeting Notes Template', 'Use this template for taking meeting notes:

Date:
Attendees:
Agenda:
Discussion Points:
Action Items:
Next Steps:', ARRAY['template', 'meetings'])
ON CONFLICT DO NOTHING;
