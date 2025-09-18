-- Add content_html column to existing notes table
ALTER TABLE notes ADD COLUMN IF NOT EXISTS content_html TEXT;

-- Migrate existing content_text to content_html (convert newlines to <br> tags)
UPDATE notes 
SET content_html = REPLACE(COALESCE(content_text, ''), E'\n', '<br>')
WHERE content_html IS NULL;

-- Update sample notes with proper HTML content
UPDATE notes 
SET content_html = 'This is your first note! You can take notes about anything, add images, and link them to specific tasks.<br><br>Try pasting an image directly into the text!'
WHERE title = 'Welcome to Notes';

UPDATE notes 
SET content_html = 'Ideas for upcoming projects and improvements to the system:<br><br>• Add markdown support<br>• Implement note templates<br>• Add collaborative features'
WHERE title = 'Project Ideas';

UPDATE notes 
SET content_html = 'Use this template for taking meeting notes:<br><br><strong>Date:</strong><br><strong>Attendees:</strong><br><strong>Agenda:</strong><br><strong>Discussion Points:</strong><br><strong>Action Items:</strong><br><strong>Next Steps:</strong>'
WHERE title = 'Meeting Notes Template';
