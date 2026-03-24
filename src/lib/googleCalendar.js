// Google Calendar integration for LifeOS
// Supports multiple Google accounts with server-side token persistence

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";

let codeClient = null;

// ─── Server-backed account helpers ───

// In-memory cache of accounts (refreshed from server)
let cachedAccounts = [];
let lastFetchTime = 0;
const CACHE_TTL = 30000; // 30 seconds

// Fetch accounts from server (Supabase-backed)
export const getStoredAccounts = async () => {
  const now = Date.now();
  if (cachedAccounts.length > 0 && now - lastFetchTime < CACHE_TTL) {
    return cachedAccounts;
  }
  try {
    const res = await fetch("/api/auth/google/tokens");
    const data = await res.json();
    cachedAccounts = (data.accounts || []).map((a) => ({
      email: a.email,
      token: a.token,
      expiry: a.expiry,
      expired: a.expired,
      has_refresh_token: a.has_refresh_token,
    }));
    lastFetchTime = now;
    return cachedAccounts;
  } catch (error) {
    console.error("Error fetching Google accounts:", error);
    return cachedAccounts; // Return stale cache on error
  }
};

// Synchronous version using cache (for backward compat)
export const getStoredAccountsSync = () => cachedAccounts;

// Invalidate cache after connect/disconnect
const invalidateCache = () => {
  cachedAccounts = [];
  lastFetchTime = 0;
};

// ─── Initialize Google Identity Services (Code Client for auth code flow) ───

export const initializeGoogle = () => {
  return new Promise((resolve, reject) => {
    if (codeClient) {
      resolve(true);
      return;
    }

    if (typeof google === "undefined" || !google.accounts) {
      reject(new Error("Google Identity Services not loaded"));
      return;
    }

    try {
      codeClient = google.accounts.oauth2.initCodeClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        ux_mode: "popup",
        access_type: "offline",
        callback: () => {}, // overridden per-request
      });
      resolve(true);
    } catch (error) {
      reject(error);
    }
  });
};

// ─── Add / connect a Google account (shows account picker) ───

export const addGoogleAccount = async () => {
  await initializeGoogle();

  return new Promise((resolve, reject) => {
    if (!codeClient) {
      reject(new Error("Code client not initialized"));
      return;
    }

    codeClient.callback = async (response) => {
      if (response.error) {
        reject(new Error(response.error));
        return;
      }

      try {
        // Send auth code to server for exchange
        const res = await fetch("/api/auth/google/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: response.code }),
        });

        const data = await res.json();

        if (!res.ok) {
          reject(new Error(data.error || "Failed to exchange code"));
          return;
        }

        invalidateCache();
        console.log(`✅ Google account added: ${data.email} (refresh token: ${data.has_refresh_token})`);
        resolve({ email: data.email, token: data.access_token });
      } catch (err) {
        reject(err);
      }
    };

    codeClient.requestCode();
  });
};

// ─── Refresh token for a specific account (server-side, no popup) ───

export const refreshAccountToken = async (email) => {
  try {
    // The tokens endpoint auto-refreshes expired tokens server-side
    const res = await fetch("/api/auth/google/tokens");
    const data = await res.json();
    const account = (data.accounts || []).find((a) => a.email === email);

    if (account && account.token) {
      invalidateCache();
      return { email: account.email, token: account.token };
    }

    throw new Error(`No valid token for ${email}`);
  } catch (error) {
    console.error(`Failed to refresh token for ${email}:`, error);
    throw error;
  }
};

// ─── Get valid tokens for all accounts ───

export const getValidAccountTokens = async () => {
  const accounts = await getStoredAccounts();
  return accounts.filter((a) => a.token && !a.expired);
};

// Sync version using cache
export const getValidAccountTokensSync = () => {
  return cachedAccounts.filter((a) => a.token && !a.expired);
};

// ─── Legacy helpers (backward compat) ───

export const isGoogleConnected = () => cachedAccounts.length > 0;
export const hasValidGoogleToken = () => cachedAccounts.some((a) => a.token && !a.expired);

// Async versions
export const isGoogleConnectedAsync = async () => {
  const accounts = await getStoredAccounts();
  return accounts.length > 0;
};
export const hasValidGoogleTokenAsync = async () => {
  const accounts = await getStoredAccounts();
  return accounts.some((a) => a.token && !a.expired);
};

export const loginToGoogle = addGoogleAccount; // alias

export const disconnectGoogle = async (email) => {
  try {
    await fetch("/api/auth/google/disconnect", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email || null }),
    });
    invalidateCache();
    console.log(`🔌 Disconnected Google account: ${email || "all"}`);
  } catch (error) {
    console.error("Error disconnecting Google:", error);
  }
};

export const disconnectAllGoogle = async () => {
  await disconnectGoogle(null);
};

// ─── Fetch events from Google Calendar API ───

const fetchCalendarEvents = async (token, startDate, endDate) => {
  const timeMin = new Date(startDate).toISOString();
  const timeMax = new Date(endDate).toISOString();

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${encodeURIComponent(timeMin)}&` +
      `timeMax=${encodeURIComponent(timeMax)}&` +
      `singleEvents=true&` +
      `orderBy=startTime&` +
      `maxResults=200`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch events");
  }

  const data = await response.json();
  return data.items || [];
};

// ─── Convert Google event to LifeOS task ───

export const convertGoogleEventToTask = (googleEvent, accountEmail) => {
  try {
    if (!googleEvent.start?.dateTime) {
      return null; // skip all-day events
    }

    const startTime = new Date(googleEvent.start.dateTime);
    const endTime = new Date(googleEvent.end.dateTime);
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = Math.max(5, Math.round(durationMs / (1000 * 60)));

    const year = startTime.getFullYear();
    const month = (startTime.getMonth() + 1).toString().padStart(2, "0");
    const day = startTime.getDate().toString().padStart(2, "0");
    const hour = startTime.getHours().toString().padStart(2, "0");
    const minute = startTime.getMinutes().toString().padStart(2, "0");
    const timeString = `${year}-${month}-${day} ${hour}:${minute}:00`;

    const tags = ["Google Calendar", `Google: ${accountEmail}`];
    if (googleEvent.attendees && googleEvent.attendees.length > 0) {
      tags.push("Meeting");
    }

    return {
      title: googleEvent.summary || "Sin título",
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
};

// ─── Import events from ALL connected Google accounts ───

export const importGoogleCalendarToLifeOS = async (supabase) => {
  console.log("🚀 Starting Google Calendar import (all accounts)...");

  // Fetch accounts from server (auto-refreshes expired tokens)
  const validAccounts = await getValidAccountTokens();
  if (validAccounts.length === 0) {
    console.log("📭 No valid Google tokens");
    return [];
  }

  const today = new Date();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(today.getDate() - 7);
  const threeWeeksLater = new Date();
  threeWeeksLater.setDate(today.getDate() + 21);

  // Fetch existing google_ids for dedup and updates
  const { data: existing } = await supabase
    .from("tasks")
    .select("id, google_id, tags, title, start_time, duration_minutes, location, description")
    .not("google_id", "is", null);
  const existingMap = new Map((existing || []).map((t) => [t.google_id, t]));
  const existingIds = new Set(existing?.map((t) => t.google_id) || []);

  // Cross-calendar dedup set
  const { data: allScheduled } = await supabase
    .from("tasks")
    .select("title, start_time")
    .eq("is_scheduled", true)
    .not("start_time", "is", null);
  const existingKeys = new Set(
    (allScheduled || []).map((t) => `${(t.title || "").trim().toLowerCase()}|${t.start_time}`)
  );

  let allImported = [];

  for (const account of validAccounts) {
    try {
      console.log(`📅 Fetching events for ${account.email}...`);
      const events = await fetchCalendarEvents(account.token, oneWeekAgo, threeWeeksLater);

      const tasks = events
        .map((e) => convertGoogleEventToTask(e, account.email))
        .filter((t) => t !== null);

      // Update existing events: sync time changes, title, tags, etc.
      const emailTag = `Google: ${account.email}`;
      for (const task of tasks) {
        const existingTask = existingMap.get(task.google_id);
        if (!existingTask) continue;

        const updates = {};

        // Update tags if email tag missing
        if (!(existingTask.tags || []).includes(emailTag)) {
          updates.tags = [...new Set([...(existingTask.tags || []), emailTag])];
        }

        // Update time if changed
        if (task.start_time && task.start_time !== existingTask.start_time) {
          updates.start_time = task.start_time;
          console.log(`🕐 Time updated for "${task.title}": ${existingTask.start_time} → ${task.start_time}`);
        }

        // Update duration if changed
        if (task.duration_minutes && task.duration_minutes !== existingTask.duration_minutes) {
          updates.duration_minutes = task.duration_minutes;
        }

        // Update title if changed
        if (task.title && task.title !== existingTask.title) {
          updates.title = task.title;
          console.log(`📝 Title updated: "${existingTask.title}" → "${task.title}"`);
        }

        // Update location if changed
        if (task.location !== undefined && task.location !== existingTask.location) {
          updates.location = task.location;
        }

        // Update description if changed
        if (task.description !== undefined && task.description !== existingTask.description) {
          updates.description = task.description;
        }

        // Apply updates if any
        if (Object.keys(updates).length > 0) {
          await supabase.from("tasks").update(updates).eq("id", existingTask.id);
          console.log(`🔄 Updated "${task.title}" (${Object.keys(updates).join(", ")})`);
        }
      }

      // Filter duplicates — only insert truly new events
      const newTasks = tasks.filter((task) => {
        if (existingIds.has(task.google_id)) return false;
        const key = `${(task.title || "").trim().toLowerCase()}|${task.start_time}`;
        if (existingKeys.has(key)) return false;
        return true;
      });

      if (newTasks.length > 0) {
        for (const task of newTasks) {
          const { data, error } = await supabase.from("tasks").insert(task).select();
          if (error) {
            if (error.message?.includes("duplicate") || error.code === "23505") {
              console.log(`⏭️ Skipping duplicate: "${task.title}"`);
              continue;
            }
            console.error(`❌ Error saving "${task.title}":`, error);
            continue;
          }
          if (data) {
            allImported.push(...data);
            data.forEach((t) => {
              existingIds.add(t.google_id);
              existingKeys.add(`${(t.title || "").trim().toLowerCase()}|${t.start_time}`);
            });
          }
        }
        console.log(`✅ ${account.email}: imported ${allImported.length} new events`);
      } else {
        console.log(`✅ ${account.email}: all events already imported`);
      }
    } catch (error) {
      console.error(`❌ Error syncing ${account.email}:`, error.message);
    }
  }

  console.log(`✅ Total imported: ${allImported.length} events from ${validAccounts.length} account(s)`);
  return allImported;
};

// Legacy single-account helpers
export const getGoogleCalendarEvents = async (startDate, endDate) => {
  const accounts = await getValidAccountTokens();
  if (accounts.length === 0) throw new Error("No valid Google token");
  return fetchCalendarEvents(accounts[0].token, startDate, endDate);
};

export const getGoogleAccessToken = async () => {
  const accounts = await getValidAccountTokens();
  return accounts.length > 0 ? accounts[0].token : null;
};

export const getCachedToken = () => {
  const accounts = getValidAccountTokensSync();
  return accounts.length > 0 ? accounts[0].token : null;
};

export const refreshGoogleToken = async () => {
  const accounts = await getStoredAccounts();
  if (accounts.length === 0) throw new Error("No Google accounts to refresh");
  return refreshAccountToken(accounts[0].email);
};
