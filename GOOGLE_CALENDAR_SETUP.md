# Google Calendar Setup Guide

This guide explains how to set up Google Calendar integration for LifeOS.

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Name it something like "LifeOS Calendar"
4. Click **Create**

## Step 2: Enable the Google Calendar API

1. In your project, go to **APIs & Services** → **Library**
2. Search for "Google Calendar API"
3. Click on it and click **Enable**

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** (unless you have a Google Workspace)
3. Fill in the required fields:
   - App name: "LifeOS"
   - User support email: Your email
   - Developer contact: Your email
4. Click **Save and Continue**
5. On **Scopes**, click **Add or Remove Scopes**
6. Find and add: `https://www.googleapis.com/auth/calendar.readonly`
7. Click **Save and Continue**
8. On **Test users**, add your Gmail account
9. Click **Save and Continue**

## Step 4: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: "LifeOS Web Client"
5. **Authorized JavaScript origins**: Add:
   - `http://localhost:3000`
   - `http://localhost:3001`
6. Click **Create**
7. Copy the **Client ID** (you'll need this)

## Step 5: Add Database Column

In your Supabase dashboard, go to **SQL Editor** and run:

```sql
-- Add google_id column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS google_id TEXT;

-- Create index for faster duplicate checking
CREATE INDEX IF NOT EXISTS idx_tasks_google_id ON tasks(google_id);
```

## Step 6: Configure LifeOS

Add your Client ID to `.env.local`:

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

## Step 7: Restart the Development Server

```bash
npm run dev
```

## Usage

1. Go to the Calendar page in LifeOS
2. Scroll down to "Sincronizar Calendarios"
3. Click **Conectar con Google**
4. Select your Google account
5. Grant calendar access
6. Your events will be imported!

## Troubleshooting

### "Google Identity Services not loaded"
- Make sure the page has fully loaded
- Try refreshing the page

### "popup_closed_by_user"
- The login popup was closed before completing
- Try again and complete the authorization

### "access_denied"
- Make sure your email is added as a test user (Step 3.8)
- Or publish your app in the OAuth consent screen

### Events not showing
- Only events with specific times are imported (all-day events are skipped)
- Check the browser console for error messages

## Notes

- Google Calendar sync is manual (click "Sincronizar Ahora")
- Events are imported with the tag "Google Calendar"
- Meetings with attendees also get the "Meeting" tag
- Events from Google are shown on the calendar but won't appear in the To Do sidebar
