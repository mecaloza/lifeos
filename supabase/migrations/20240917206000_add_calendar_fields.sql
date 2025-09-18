-- Add calendar-specific fields to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN DEFAULT FALSE;

-- Create indexes for better calendar performance
CREATE INDEX IF NOT EXISTS idx_tasks_start_time ON tasks(start_time);
CREATE INDEX IF NOT EXISTS idx_tasks_is_scheduled ON tasks(is_scheduled);

-- Update trigger to handle calendar fields
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  
  -- Set is_scheduled based on whether start_time is set
  IF NEW.start_time IS NOT NULL THEN
    NEW.is_scheduled = TRUE;
  ELSE
    NEW.is_scheduled = FALSE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
