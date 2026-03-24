// Server-side calendar sync - fetches events and upserts into tasks table
// GET: Supports ?provider=google|outlook query param (legacy, still works)
// POST: Syncs ALL connected accounts, returns detailed results
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  getValidToken,
  refreshGoogleToken as refreshGoogle,
  refreshOutlookToken as refreshOutlook,
} from "@/lib/tokenManager";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ─── Token refresh (inline for accounts with full row data) ───

async function refreshGoogleTokenForAccount(account) {
  if (!account.refresh_token) return null;

  try {
    const result = await refreshGoogle(account.refresh_token);

    await supabase
      .from("calendar_tokens")
      .update({
        access_token: result.access_token,
        token_expiry: result.token_expiry,
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);

    return { ...account, access_token: result.access_token, token_expiry: result.token_expiry };
  } catch (error) {
    console.error(`Error refreshing Google token for ${account.account_email}:`, error);
    return null;
  }
}

async function refreshOutlookTokenForAccount(account) {
  if (!account.refresh_token) return null;

  try {
    const result = await refreshOutlook(account.refresh_token);

    const updateData = {
      access_token: result.access_token,
      token_expiry: result.token_expiry,
      updated_at: new Date().toISOString(),
    };
    if (result.refresh_token) {
      updateData.refresh_token = result.refresh_token;
    }

    await supabase
      .from("calendar_tokens")
      .update(updateData)
      .eq("id", account.id);

    return { ...account, access_token: result.access_token, token_expiry: result.token_expiry };
  } catch (error) {
    console.error(`Error refreshing Outlook token for ${account.account_email}:`, error);
    return null;
  }
}

// ─── Google Calendar API ───

async function fetchGoogleCalendarEvents(token, startDate, endDate) {
  const timeMin = new Date(startDate).toISOString();
  const timeMax = new Date(endDate).toISOString();

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${encodeURIComponent(timeMin)}&` +
      `timeMax=${encodeURIComponent(timeMax)}&` +
      `singleEvents=true&` +
      `orderBy=startTime&` +
      `maxResults=250`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch Google events");
  }

  const data = await response.json();
  return data.items || [];
}

// ─── Convert Google event to LifeOS task ───

function convertGoogleEventToTask(googleEvent, accountEmail) {
  try {
    if (!googleEvent.start?.dateTime) {
      return null; // skip all-day events
    }

    const startTime = new Date(googleEvent.start.dateTime);
    const endTime = new Date(googleEvent.end.dateTime);
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = Math.max(5, Math.round(durationMs / (1000 * 60)));

    // Extract LOCAL time from ISO string (e.g. "2026-03-24T09:10:00-05:00" → "2026-03-24 09:10:00")
    // This avoids UTC conversion issues on the server
    const localMatch = googleEvent.start.dateTime.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    const timeString = localMatch
      ? `${localMatch[1]} ${localMatch[2]}:00`
      : `${startTime.getFullYear()}-${(startTime.getMonth()+1).toString().padStart(2,"0")}-${startTime.getDate().toString().padStart(2,"0")} ${startTime.getHours().toString().padStart(2,"0")}:${startTime.getMinutes().toString().padStart(2,"0")}:00`;

    const tags = ["Google Calendar", `Google: ${accountEmail}`];
    if (googleEvent.attendees && googleEvent.attendees.length > 0) {
      tags.push("Meeting");
    }

    return {
      title: googleEvent.summary || "Sin titulo",
      description: googleEvent.description?.substring(0, 500) || googleEvent.location || "",
      tags,
      duration_minutes: durationMinutes,
      start_time: timeString,
      is_scheduled: true,
      status: "todo",
      completed: false,
      source: "google",
      google_id: googleEvent.id,
      location: googleEvent.location || "",
    };
  } catch (error) {
    console.error("Error converting Google event:", googleEvent.summary, error);
    return null;
  }
}

// ─── Outlook Calendar API ───

async function fetchOutlookCalendarEvents(token, startDate, endDate) {
  const startISO = new Date(startDate).toISOString();
  const endISO = new Date(endDate).toISOString();

  const url =
    `https://graph.microsoft.com/v1.0/me/calendarView?` +
    `startDateTime=${encodeURIComponent(startISO)}&` +
    `endDateTime=${encodeURIComponent(endISO)}&` +
    `$top=250&` +
    `$select=id,subject,bodyPreview,start,end,location,isAllDay,attendees,categories&` +
    `$orderby=start/dateTime`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: 'outlook.timezone="America/Bogota"',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch Outlook events");
  }

  const data = await response.json();
  return data.value || [];
}

function convertOutlookEventToTask(outlookEvent, accountEmail) {
  try {
    if (outlookEvent.isAllDay) return null;

    // Times come in local timezone (America/Bogota) thanks to Prefer header
    // Extract local time directly from string to avoid UTC conversion on server
    const localMatch = outlookEvent.start.dateTime.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    const endMatch = outlookEvent.end.dateTime.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);

    const startTime = new Date(outlookEvent.start.dateTime);
    const endTime = new Date(outlookEvent.end.dateTime);
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = Math.max(5, Math.round(durationMs / (1000 * 60)));

    // Skip very short events
    if (durationMinutes < 15) return null;

    const timeString = localMatch
      ? `${localMatch[1]} ${localMatch[2]}:00`
      : `${startTime.getFullYear()}-${(startTime.getMonth()+1).toString().padStart(2,"0")}-${startTime.getDate().toString().padStart(2,"0")} ${startTime.getHours().toString().padStart(2,"0")}:${startTime.getMinutes().toString().padStart(2,"0")}:00`;

    const tags = ["Outlook", `Outlook: ${accountEmail}`];
    if (outlookEvent.attendees && outlookEvent.attendees.length > 1) {
      tags.push("Meeting");
    }
    if (outlookEvent.categories && outlookEvent.categories.length > 0) {
      tags.push(...outlookEvent.categories);
    }

    return {
      title: outlookEvent.subject || "Sin titulo",
      description: outlookEvent.bodyPreview?.substring(0, 500) || "",
      tags: [...new Set(tags)],
      duration_minutes: durationMinutes,
      start_time: timeString,
      is_scheduled: true,
      status: "todo",
      completed: false,
      source: "outlook",
      outlook_id: outlookEvent.id,
      location: outlookEvent.location?.displayName || "",
    };
  } catch (error) {
    console.error("Error converting Outlook event:", outlookEvent.subject, error);
    return null;
  }
}

// ─── Sync logic (shared for both providers) ───

async function syncGoogleAccounts(accounts) {
  const today = new Date();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(today.getDate() - 7);
  const threeWeeksLater = new Date();
  threeWeeksLater.setDate(today.getDate() + 21);

  // Fetch existing google events for dedup and updates
  const { data: existing } = await supabase
    .from("tasks")
    .select("id, google_id, tags, title, start_time, duration_minutes, location, description")
    .not("google_id", "is", null);
  const existingMap = new Map((existing || []).map((t) => [t.google_id, t]));
  const existingIds = new Set(existing?.map((t) => t.google_id) || []);

  // Cross-calendar dedup
  const { data: allScheduled } = await supabase
    .from("tasks")
    .select("title, start_time")
    .eq("is_scheduled", true)
    .not("start_time", "is", null);
  const existingKeys = new Set(
    (allScheduled || []).map((t) => `${(t.title || "").trim().toLowerCase()}|${t.start_time}`)
  );

  let totalImported = 0;
  let totalUpdated = 0;
  const errors = [];
  const synced = [];

  for (const account of accounts) {
    const now = Date.now();
    const expiryTime = new Date(account.token_expiry).getTime();
    const isExpired = now > expiryTime - 5 * 60 * 1000;

    let token = account.access_token;

    if (isExpired) {
      const refreshed = await refreshGoogleTokenForAccount(account);
      if (!refreshed) {
        errors.push(`Failed to refresh token for ${account.account_email}`);
        continue;
      }
      token = refreshed.access_token;
    }

    let accountEvents = 0;

    try {
      const events = await fetchGoogleCalendarEvents(token, oneWeekAgo, threeWeeksLater);
      const tasks = events
        .map((e) => convertGoogleEventToTask(e, account.account_email))
        .filter((t) => t !== null);

      // Update existing events
      const emailTag = `Google: ${account.account_email}`;
      for (const task of tasks) {
        const existingTask = existingMap.get(task.google_id);
        if (!existingTask) continue;

        const updates = {};

        if (!(existingTask.tags || []).includes(emailTag)) {
          updates.tags = [...new Set([...(existingTask.tags || []), emailTag])];
        }
        if (task.start_time && task.start_time !== existingTask.start_time) {
          updates.start_time = task.start_time;
        }
        if (task.duration_minutes && task.duration_minutes !== existingTask.duration_minutes) {
          updates.duration_minutes = task.duration_minutes;
        }
        if (task.title && task.title !== existingTask.title) {
          updates.title = task.title;
        }
        if (task.location !== undefined && task.location !== existingTask.location) {
          updates.location = task.location;
        }
        if (task.description !== undefined && task.description !== existingTask.description) {
          updates.description = task.description;
        }

        if (Object.keys(updates).length > 0) {
          await supabase.from("tasks").update(updates).eq("id", existingTask.id);
          totalUpdated++;
        }
      }

      // Insert new events
      const newTasks = tasks.filter((task) => {
        if (existingIds.has(task.google_id)) return false;
        const key = `${(task.title || "").trim().toLowerCase()}|${task.start_time}`;
        if (existingKeys.has(key)) return false;
        return true;
      });

      for (const task of newTasks) {
        const { data, error } = await supabase.from("tasks").insert(task).select();
        if (error) {
          if (error.message?.includes("duplicate") || error.code === "23505") continue;
          console.error(`Error saving "${task.title}":`, error);
          continue;
        }
        if (data) {
          totalImported++;
          accountEvents++;
          data.forEach((t) => {
            existingIds.add(t.google_id);
            existingKeys.add(`${(t.title || "").trim().toLowerCase()}|${t.start_time}`);
          });
        }
      }

      synced.push({
        provider: "google",
        email: account.account_email,
        eventsCount: accountEvents,
      });
    } catch (error) {
      errors.push(`${account.account_email}: ${error.message}`);
    }
  }

  return { imported: totalImported, updated: totalUpdated, errors, synced };
}

async function syncOutlookAccounts(accounts) {
  const today = new Date();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(today.getDate() - 7);
  const threeWeeksLater = new Date();
  threeWeeksLater.setDate(today.getDate() + 21);

  // Fetch existing outlook events for dedup
  const { data: existing } = await supabase
    .from("tasks")
    .select("id, outlook_id, tags, title, start_time, duration_minutes, location, description")
    .not("outlook_id", "is", null);
  const existingMap = new Map((existing || []).map((t) => [t.outlook_id, t]));
  const existingIds = new Set(existing?.map((t) => t.outlook_id) || []);

  const { data: allScheduled } = await supabase
    .from("tasks")
    .select("title, start_time")
    .eq("is_scheduled", true)
    .not("start_time", "is", null);
  const existingKeys = new Set(
    (allScheduled || []).map((t) => `${(t.title || "").trim().toLowerCase()}|${t.start_time}`)
  );

  let totalImported = 0;
  let totalUpdated = 0;
  const errors = [];
  const synced = [];

  for (const account of accounts) {
    const now = Date.now();
    const expiryTime = new Date(account.token_expiry).getTime();
    const isExpired = now > expiryTime - 5 * 60 * 1000;

    let token = account.access_token;

    if (isExpired) {
      const refreshed = await refreshOutlookTokenForAccount(account);
      if (!refreshed) {
        errors.push(`Failed to refresh token for ${account.account_email}`);
        continue;
      }
      token = refreshed.access_token;
    }

    if (!token) {
      errors.push(`No valid token for ${account.account_email}`);
      continue;
    }

    let accountEvents = 0;

    try {
      const events = await fetchOutlookCalendarEvents(token, oneWeekAgo, threeWeeksLater);
      const tasks = events
        .map((e) => convertOutlookEventToTask(e, account.account_email))
        .filter((t) => t !== null);

      // Update existing events
      for (const task of tasks) {
        const existingTask = existingMap.get(task.outlook_id);
        if (!existingTask) continue;

        const updates = {};
        if (task.start_time && task.start_time !== existingTask.start_time) {
          updates.start_time = task.start_time;
        }
        if (task.duration_minutes && task.duration_minutes !== existingTask.duration_minutes) {
          updates.duration_minutes = task.duration_minutes;
        }
        if (task.title && task.title !== existingTask.title) {
          updates.title = task.title;
        }
        if (task.location !== undefined && task.location !== existingTask.location) {
          updates.location = task.location;
        }

        if (Object.keys(updates).length > 0) {
          await supabase.from("tasks").update(updates).eq("id", existingTask.id);
          totalUpdated++;
        }
      }

      // Insert new events
      const newTasks = tasks.filter((task) => {
        if (existingIds.has(task.outlook_id)) return false;
        const key = `${(task.title || "").trim().toLowerCase()}|${task.start_time}`;
        if (existingKeys.has(key)) return false;
        return true;
      });

      for (const task of newTasks) {
        const { data, error } = await supabase.from("tasks").insert(task).select();
        if (error) {
          if (error.message?.includes("duplicate") || error.code === "23505") continue;
          console.error(`Error saving "${task.title}":`, error);
          continue;
        }
        if (data) {
          totalImported++;
          accountEvents++;
          data.forEach((t) => {
            existingIds.add(t.outlook_id);
            existingKeys.add(`${(t.title || "").trim().toLowerCase()}|${t.start_time}`);
          });
        }
      }

      synced.push({
        provider: "outlook",
        email: account.account_email,
        eventsCount: accountEvents,
      });
    } catch (error) {
      errors.push(`${account.account_email}: ${error.message}`);
    }
  }

  return { imported: totalImported, updated: totalUpdated, errors, synced };
}

// ─── Shared sync logic ───

async function runSync(provider) {
  const results = { google: null, outlook: null };

  // Sync Google
  if (!provider || provider === "google") {
    const { data: googleAccounts, error } = await supabase
      .from("calendar_tokens")
      .select("*")
      .eq("provider", "google");

    if (error) {
      throw new Error(`DB error: ${error.message}`);
    }

    if (googleAccounts && googleAccounts.length > 0) {
      results.google = await syncGoogleAccounts(googleAccounts);
    } else {
      results.google = { imported: 0, updated: 0, errors: ["No Google accounts connected"], synced: [] };
    }
  }

  // Sync Outlook
  if (!provider || provider === "outlook") {
    const { data: outlookAccounts, error } = await supabase
      .from("calendar_tokens")
      .select("*")
      .eq("provider", "outlook");

    if (error) {
      throw new Error(`DB error: ${error.message}`);
    }

    if (outlookAccounts && outlookAccounts.length > 0) {
      results.outlook = await syncOutlookAccounts(outlookAccounts);
    } else {
      results.outlook = { imported: 0, updated: 0, errors: [], synced: [] };
    }
  }

  // Build summary
  const totalImported = (results.google?.imported || 0) + (results.outlook?.imported || 0);
  const totalUpdated = (results.google?.updated || 0) + (results.outlook?.updated || 0);
  const allErrors = [
    ...(results.google?.errors || []),
    ...(results.outlook?.errors || []),
  ];
  const allSynced = [
    ...(results.google?.synced || []),
    ...(results.outlook?.synced || []),
  ];

  return {
    success: true,
    imported: totalImported,
    updated: totalUpdated,
    errors: allErrors,
    synced: allSynced,
    details: results,
  };
}

// ─── API Route Handlers ───

// POST: Sync ALL connected accounts (new endpoint)
export async function POST(request) {
  try {
    let provider = null;

    // Optionally accept { provider: "google" | "outlook" } in body
    try {
      const body = await request.json();
      provider = body.provider || null;
    } catch {
      // No body or invalid JSON is fine — sync all
    }

    const result = await runSync(provider);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Calendar sync error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET: Legacy endpoint with ?provider= query param
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider"); // "google", "outlook", or null (both)

    const result = await runSync(provider);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Calendar sync error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
