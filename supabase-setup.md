# Supabase Setup Guide

## 1. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Create a new project
4. Wait for the project to be ready

## 2. Create Tasks Table

Go to the SQL Editor in your Supabase dashboard and run this SQL:

```sql
-- Create tasks table
CREATE TABLE tasks (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT[],
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable Row Level Security
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations (for development)
-- You should update this for production with proper authentication
CREATE POLICY "Allow all operations for tasks" ON tasks
  FOR ALL USING (true) WITH CHECK (true);

-- Create an index for better performance
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
```

## 3. Get Your API Keys

1. Go to your project settings
2. Click on "API" in the sidebar
3. Copy:
   - Project URL (looks like: https://xxxxx.supabase.co)
   - Anon/Public key (a long string)

## 4. Configure Your App

1. Create a `.env.local` file in your project root
2. Add your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 5. Install Dependencies

Run this command to install the Supabase client:

```bash
npm install
```

## 6. Test Your Connection

1. Start your development server:

```bash
npm run dev
```

2. Go to http://localhost:3000/tasks

3. Try creating a task - it should save to Supabase!

## Features

The app now has:

- ✅ Real-time sync with Supabase
- ✅ Automatic fallback to localStorage if Supabase is offline
- ✅ Loading states during data fetching
- ✅ Error handling
- ✅ Task persistence across devices (when using same Supabase project)

## Troubleshooting

If you see tasks but can't save new ones:

1. Check your .env.local file has correct values
2. Make sure your Supabase project is active
3. Verify the tasks table was created correctly
4. Check the browser console for error messages
