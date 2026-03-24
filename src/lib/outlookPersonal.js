// Simple personal Outlook calendar integration
import { PublicClientApplication } from "@azure/msal-browser";
import { Client } from "@microsoft/microsoft-graph-client";
import { shouldImportAsTask, generateEventTags } from "./eventFilters";

// Simple MSAL configuration for personal use
const msalConfig = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || "",
    authority: "https://login.microsoftonline.com/common",
    redirectUri: typeof window !== "undefined" ? window.location.origin + "/" : "http://localhost:3000/",
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: true,
  },
};

// Scopes needed for calendar access
const loginScopes = ["User.Read", "Calendars.Read", "Calendars.ReadWrite"];

// For silent token acquisition (no prompt)
const silentRequest = {
  scopes: loginScopes,
};

// For interactive login (with account selection)
const interactiveRequest = {
  scopes: loginScopes,
  prompt: "select_account",
};

let msalInstance = null;
let _silentOnlyMode = false;

// Control whether getAccessToken should skip popup fallback (used by auto-sync)
export const setSilentMode = (silent) => {
  _silentOnlyMode = silent;
};

// Initialize MSAL
export const initializeMsal = async () => {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig);
    await msalInstance.initialize();
  }
  return msalInstance;
};

// Simple login to Microsoft
// forceAccountSelect: if true, always show account picker; if false, use cached account if available
export const loginToMicrosoft = async (forceAccountSelect = true) => {
  try {
    const msal = await initializeMsal();
    
    // Check if we have a cached account we can use
    const accounts = msal.getAllAccounts();
    if (!forceAccountSelect && accounts.length > 0) {
      console.log("✅ Using cached Microsoft account:", accounts[0].username);
      return accounts[0];
    }
    
    console.log("🔐 Opening Microsoft login...");
    const response = await msal.loginPopup(interactiveRequest);

    if (response.account) {
      console.log("✅ Logged in to Microsoft:", response.account.username);
      return response.account;
    }
  } catch (error) {
    console.error("Error logging in to Microsoft:", error);
    if (error.errorCode === "user_cancelled") {
      console.log("User cancelled login");
      return null;
    }
    throw error;
  }
};

// ─── Server-side token persistence helpers ───

const saveOutlookTokenToServer = async (email, accessToken) => {
  try {
    const expiry = new Date(Date.now() + 3600 * 1000).toISOString();
    await fetch("/api/auth/outlook/save-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, access_token: accessToken, expiry }),
    });
    console.log(`💾 Outlook token saved to server for ${email}`);
  } catch (error) {
    console.error("Error saving Outlook token to server:", error);
  }
};

export const getOutlookTokenFromServer = async () => {
  try {
    const res = await fetch("/api/auth/outlook/tokens");
    const data = await res.json();
    const accounts = data.accounts || [];
    if (accounts.length > 0 && accounts[0].token) {
      return accounts[0].token;
    }
    return null;
  } catch {
    return null;
  }
};

export const getOutlookAccountsFromServer = async () => {
  try {
    const res = await fetch("/api/auth/outlook/tokens");
    const data = await res.json();
    return data.accounts || [];
  } catch {
    return [];
  }
};

// Get access token (silently if possible, popup fallback unless in silent mode)
export const getAccessToken = async () => {
  try {
    const msal = await initializeMsal();
    const accounts = msal.getAllAccounts();

    if (accounts.length === 0) {
      return null;
    }

    const account = accounts[0];

    try {
      // Try silent token acquisition first
      const response = await msal.acquireTokenSilent({
        ...silentRequest,
        account: account,
      });
      // Save token to server for cross-device persistence
      saveOutlookTokenToServer(account.username, response.accessToken);
      return response.accessToken;
    } catch (silentError) {
      // In silent mode (auto-sync), never show popup
      if (_silentOnlyMode) {
        console.log("🔇 Silent mode: skipping popup fallback");
        return null;
      }

      console.log("🔄 Silent failed, trying popup...");
      try {
        const response = await msal.acquireTokenPopup({
          ...silentRequest,
          account: account,
        });
        // Save token to server for cross-device persistence
        saveOutlookTokenToServer(account.username, response.accessToken);
        return response.accessToken;
      } catch (popupError) {
        console.error("❌ Token popup failed:", popupError);
        return null;
      }
    }
  } catch (error) {
    console.error("Error getting token:", error);
    return null;
  }
};

// Get access token silently only (no popup) - for auto-sync checks
export const getAccessTokenSilent = async () => {
  try {
    const msal = await initializeMsal();
    const accounts = msal.getAllAccounts();

    if (accounts.length === 0) {
      // Fallback: try server-stored token
      return await getOutlookTokenFromServer();
    }

    const response = await msal.acquireTokenSilent({
      ...silentRequest,
      account: accounts[0],
    });
    // Save to server for cross-device persistence
    saveOutlookTokenToServer(accounts[0].username, response.accessToken);
    return response.accessToken;
  } catch (error) {
    // Fallback: try server-stored token
    return await getOutlookTokenFromServer();
  }
};

// Get calendar events with timezone fix
export const getOutlookEvents = async (startDate, endDate) => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error("No access token available");
    }

    // Create Graph client
    const graphClient = Client.init({
      authProvider: async (done) => {
        done(null, accessToken);
      },
    });

    // Expand date range to catch timezone edge cases
    const expandedStart = new Date(startDate);
    expandedStart.setDate(expandedStart.getDate() - 1); // 1 day before
    const expandedEnd = new Date(endDate);
    expandedEnd.setDate(expandedEnd.getDate() + 1); // 1 day after

    const startDateTime = expandedStart.toISOString();
    const endDateTime = expandedEnd.toISOString();

    console.log(
      `📅 Fetching Outlook events (expanded range): ${expandedStart.toLocaleDateString()} to ${expandedEnd.toLocaleDateString()}`
    );

    // Get events with recurring events expanded and attendees info
    const events = await graphClient
      .api("/me/calendarview") // Use calendarview for recurring events
      .query({
        startDateTime: startDateTime,
        endDateTime: endDateTime,
        $select:
          "id,subject,body,start,end,location,categories,isAllDay,type,seriesMasterId,attendees",
        $orderby: "start/dateTime",
        $top: 200,
      })
      .get();

    console.log(
      `📋 Found ${events.value.length} events in your Outlook calendar`
    );

    // Debug first few events for timezone check
    if (events.value.length > 0) {
      console.log("🕐 Sample events (including recurring):");
      events.value.slice(0, 5).forEach((event) => {
        const isRecurring = event.seriesMasterId ? "🔄 Recurring" : "📅 Single";
        console.log(
          `  ${isRecurring} "${event.subject}": ${
            event.start.dateTime
          } → ${new Date(event.start.dateTime).toLocaleString()}`
        );
      });
    }

    return events.value;
  } catch (error) {
    console.error("Error fetching Outlook events:", error);
    throw error;
  }
};

// Convert Outlook event to LifeOS task with filtering and timezone fix
export const convertToLifeOSTask = (outlookEvent) => {
  try {
    // Check if this event should be imported as a task
    if (!shouldImportAsTask(outlookEvent)) {
      return null; // Skip this event
    }

    // Microsoft Graph returns times in UTC, need to convert to local timezone
    const utcStartTime = new Date(outlookEvent.start.dateTime);
    const utcEndTime = new Date(outlookEvent.end.dateTime);

    // Get user's timezone offset in minutes
    const timezoneOffset = new Date().getTimezoneOffset();

    // Convert UTC to local time
    const localStartTime = new Date(
      utcStartTime.getTime() - timezoneOffset * 60 * 1000
    );
    const localEndTime = new Date(
      utcEndTime.getTime() - timezoneOffset * 60 * 1000
    );

    console.log(`🕐 Converting "${outlookEvent.subject}":`, {
      outlookUTC: outlookEvent.start.dateTime,
      utcTime: utcStartTime.toLocaleString(),
      timezoneOffset: `${timezoneOffset} minutes`,
      correctedLocal: localStartTime.toLocaleString(),
      isRecurring: outlookEvent.seriesMasterId ? "🔄 Yes" : "📅 No",
      eventType: outlookEvent.type || "Unknown",
    });

    // Calculate duration using local times
    const durationMs = localEndTime.getTime() - localStartTime.getTime();
    const durationMinutes = Math.max(5, Math.round(durationMs / (1000 * 60)));

    // Format corrected local time for LifeOS
    const year = localStartTime.getFullYear();
    const month = (localStartTime.getMonth() + 1).toString().padStart(2, "0");
    const day = localStartTime.getDate().toString().padStart(2, "0");
    const hour = localStartTime.getHours().toString().padStart(2, "0");
    const minute = localStartTime.getMinutes().toString().padStart(2, "0");
    const timeString = `${year}-${month}-${day} ${hour}:${minute}:00`;

    // Generate smart tags + add account email tag
    const smartTags = generateEventTags(outlookEvent);
    // Add email-specific tag for color coding
    const accountEmail = outlookEvent._accountEmail || "";
    if (accountEmail) {
      smartTags.push(`Outlook: ${accountEmail}`);
    }

    console.log(
      `🔄 Converting to task: ${timeString} (${durationMinutes} min) [${smartTags.join(
        ", "
      )}]`
    );

    return {
      title: outlookEvent.subject || "Sin título",
      description:
        outlookEvent.location?.displayName ||
        outlookEvent.body?.content?.replace(/<[^>]*>/g, "").substring(0, 200) ||
        "",
      tags: smartTags,
      duration_minutes: durationMinutes,
      start_time: timeString,
      is_scheduled: true,
      status: "todo",
      completed: false,
      source: "outlook",
      outlook_id: outlookEvent.id,
      location: outlookEvent.location?.displayName || "",
      // Remove is_recurring and is_all_day as they don't exist in the schema
    };
  } catch (error) {
    console.error("Error converting event:", outlookEvent.subject, error);
    return null;
  }
};

// Import events to LifeOS with expanded range
export const importOutlookToLifeOS = async (supabase) => {
  try {
    console.log("🚀 Starting enhanced Outlook import...");

    // Get events for expanded range (1 week past + 3 weeks future)
    const today = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(today.getDate() - 7);
    const threeWeeksLater = new Date();
    threeWeeksLater.setDate(today.getDate() + 21);

    console.log(
      `📅 Import range: ${oneWeekAgo.toLocaleDateString()} to ${threeWeeksLater.toLocaleDateString()}`
    );

    // Fetch from Outlook
    const outlookEvents = await getOutlookEvents(oneWeekAgo, threeWeeksLater);

    if (outlookEvents.length === 0) {
      console.log("📭 No events found in your Outlook calendar for this range");
      return [];
    }

    // Get current account email for tagging
    let outlookEmail = "";
    try {
      const msal = await initializeMsal();
      const accounts = msal.getAllAccounts();
      outlookEmail = accounts?.[0]?.username || "";
    } catch (e) {
      console.log("Could not get Outlook email for tagging");
    }

    // Convert to LifeOS format with smart filtering
    console.log("🔍 Applying smart filters...");

    const tasks = outlookEvents
      .map((event) => convertToLifeOSTask({ ...event, _accountEmail: outlookEmail }))
      .filter((task) => task !== null);

    const skippedCount = outlookEvents.length - tasks.length;

    console.log(`📊 Filtering results:`, {
      totalOutlookEvents: outlookEvents.length,
      convertedToTasks: tasks.length,
      skippedEvents: skippedCount,
      skippedReasons: "Social events, birthdays, all-day events, etc.",
    });

    // Show what types of events were imported
    if (tasks.length > 0) {
      console.log("✅ Imported event types:");
      tasks.slice(0, 5).forEach((task) => {
        const recurring = task.is_recurring ? "🔄" : "📅";
        console.log(
          `  ${recurring} "${task.title}" → ${
            task.start_time
          } [${task.tags.join(", ")}]`
        );
      });
    }

    // Check for duplicates by outlook_id
    const { data: existing } = await supabase
      .from("tasks")
      .select("id, outlook_id, tags, title, start_time, duration_minutes, location, description")
      .not("outlook_id", "is", null);

    const existingMap = new Map((existing || []).map((t) => [t.outlook_id, t]));
    const existingIds = new Set(existing?.map((t) => t.outlook_id) || []);

    // Update existing events: sync time changes, title, tags, etc.
    const outlookEmailTag = `Outlook: ${outlookEmail}`;
    for (const task of tasks) {
      const existingTask = existingMap.get(task.outlook_id);
      if (!existingTask) continue;

      const updates = {};

      // Update tags if email tag missing
      if (!(existingTask.tags || []).includes(outlookEmailTag)) {
        updates.tags = [...new Set([...(existingTask.tags || []), outlookEmailTag])];
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
      }

      // Update location if changed
      if (task.location !== undefined && task.location !== existingTask.location) {
        updates.location = task.location;
      }

      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        await supabase.from("tasks").update(updates).eq("id", existingTask.id);
        console.log(`🔄 Updated "${task.title}" (${Object.keys(updates).join(", ")})`);
      }
    }

    let newTasks = tasks.filter((task) => !existingIds.has(task.outlook_id));

    // Cross-calendar dedup: skip if same title + start_time already exists (e.g. from Google)
    if (newTasks.length > 0) {
      const { data: allScheduled } = await supabase
        .from("tasks")
        .select("title, start_time")
        .eq("is_scheduled", true)
        .not("start_time", "is", null);

      if (allScheduled && allScheduled.length > 0) {
        const existingKey = new Set(
          allScheduled.map((t) =>
            `${(t.title || "").trim().toLowerCase()}|${t.start_time}`
          )
        );

        const beforeCount = newTasks.length;
        newTasks = newTasks.filter((task) => {
          const key = `${(task.title || "").trim().toLowerCase()}|${task.start_time}`;
          if (existingKey.has(key)) {
            console.log(`⏭️ Cross-calendar duplicate: "${task.title}" at ${task.start_time}`);
            return false;
          }
          return true;
        });

        if (beforeCount !== newTasks.length) {
          console.log(`🔗 Skipped ${beforeCount - newTasks.length} cross-calendar duplicates`);
        }
      }
    }

    console.log(`📊 Final import summary:`, {
      outlookEventsFound: outlookEvents.length,
      afterFiltering: tasks.length,
      alreadyImported: tasks.length - newTasks.length,
      newTasksToAdd: newTasks.length,
    });

    if (newTasks.length === 0) {
      console.log("📋 All events already imported - no new events found");
      return [];
    }

    // Insert new tasks one by one to skip duplicates gracefully
    const inserted = [];
    for (const task of newTasks) {
      const { data, error } = await supabase
        .from("tasks")
        .insert(task)
        .select();

      if (error) {
        if (error.message?.includes("duplicate") || error.code === "23505") {
          console.log(`⏭️ Skipping duplicate: "${task.title}"`);
          continue;
        }
        console.error("❌ Error saving task:", error);
        continue;
      }
      if (data) inserted.push(...data);
    }
    const data = inserted;

    console.log(
      `✅ Successfully imported ${data.length} new tasks with correct timezone!`
    );

    // Show sample of imported tasks
    if (data.length > 0) {
      console.log("📋 Sample imported tasks:");
      data.slice(0, 3).forEach((task) => {
        const time = new Date(
          `${task.start_time.replace(" ", "T")}`
        ).toLocaleTimeString();
        console.log(
          `  "${task.title}": ${time} (${
            task.duration_minutes
          }min) [${task.tags.join(", ")}]`
        );
      });
    }

    return data;
  } catch (error) {
    console.error("❌ Import failed:", error);
    throw error;
  }
};
