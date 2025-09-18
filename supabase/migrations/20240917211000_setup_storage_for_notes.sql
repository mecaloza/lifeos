-- Create a storage bucket for note attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('note-attachments', 'note-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow public access to note attachments
CREATE POLICY "Public Access to note attachments" ON storage.objects FOR SELECT USING (bucket_id = 'note-attachments');

-- Create policy to allow authenticated uploads to note attachments
CREATE POLICY "Allow uploads to note attachments" ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'note-attachments');

-- Create policy to allow updates to note attachments
CREATE POLICY "Allow updates to note attachments" ON storage.objects 
FOR UPDATE 
WITH CHECK (bucket_id = 'note-attachments');

-- Create policy to allow deletes from note attachments
CREATE POLICY "Allow deletes from note attachments" ON storage.objects 
FOR DELETE 
USING (bucket_id = 'note-attachments');
