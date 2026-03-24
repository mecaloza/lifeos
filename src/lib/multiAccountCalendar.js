import { Client } from "@microsoft/microsoft-graph-client";
import { accountManager } from "./multiAccountMsal";

// Create Graph client for specific account
const getGraphClientForAccount = async (account) => {
  try {
    const accessToken = await accountManager.getAccessToken(account);
    
    const graphClient = Client.init({
      authProvider: async (done) => {
        done(null, accessToken);
      },
    });

    return graphClient;
  } catch (error) {
    console.error("Error creating Graph client for account:", account?.username, error);
    throw error;
  }
};

// Fetch events from specific account
export const getCalendarEventsForAccount = async (account, startDate, endDate) => {
  try {
    const graphClient = await getGraphClientForAccount(account);
    
    const startDateTime = startDate.toISOString();
    const endDateTime = endDate.toISOString();

    console.log(`📅 Fetching events for ${account.username}: ${startDateTime} to ${endDateTime}`);

    const events = await graphClient
      .api("/me/events")
      .select("id,subject,body,start,end,location,categories,sensitivity,isAllDay,recurrence")
      .filter(`start/dateTime ge '${startDateTime}' and end/dateTime le '${endDateTime}'`)
      .orderby("start/dateTime")
      .top(100)
      .get();

    console.log(`📋 Found ${events.value.length} events for ${account.username}`);
    
    // Add account info to each event
    return events.value.map(event => ({
      ...event,
      accountId: account.homeAccountId,
      accountEmail: account.username,
    }));
  } catch (error) {
    console.error(`Error fetching calendar for ${account.username}:`, error);
    return [];
  }
};

// Fetch events from all connected accounts
export const getAllAccountsCalendarEvents = async (startDate, endDate) => {
  try {
    const accounts = accountManager.getAccountsInfo();
    console.log(`📧 Fetching events from ${accounts.length} accounts...`);
    
    const allEventsPromises = accounts.map(accountInfo => {
      const account = accountManager.accounts.find(acc => acc.homeAccountId === accountInfo.id);
      return getCalendarEventsForAccount(account, startDate, endDate);
    });

    const allEventsArrays = await Promise.allSettled(allEventsPromises);
    
    // Combine all events and handle failures
    const allEvents = [];
    allEventsArrays.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allEvents.push(...result.value);
      } else {
        console.error(`Failed to fetch calendar for account ${index}:`, result.reason);
      }
    });

    console.log(`📅 Total events from all accounts: ${allEvents.length}`);
    return allEvents;
  } catch (error) {
    console.error("Error fetching all calendars:", error);
    return [];
  }
};

// Convert Outlook event to LifeOS task format
export const convertOutlookEventToTask = (outlookEvent) => {
  try {
    // Handle timezone properly
    const startTime = new Date(outlookEvent.start.dateTime);
    const endTime = new Date(outlookEvent.end.dateTime);
    
    // Calculate duration in minutes
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = Math.max(30, Math.round(durationMs / (1000 * 60)));

    // Format for LifeOS
    const year = startTime.getFullYear();
    const month = (startTime.getMonth() + 1).toString().padStart(2, "0");
    const day = startTime.getDate().toString().padStart(2, "0");
    const hour = startTime.getHours().toString().padStart(2, "0");
    const minute = startTime.getMinutes().toString().padStart(2, "0");
    const lifeOSTimeString = `${year}-${month}-${day} ${hour}:${minute}:00`;

    // Create task with account info
    const task = {
      title: outlookEvent.subject || "Untitled Event",
      description: outlookEvent.body?.content ? 
        outlookEvent.body.content.replace(/<[^>]*>/g, '') // Strip HTML
        : outlookEvent.location?.displayName || "",
      tags: outlookEvent.categories || ["Outlook"],
      duration_minutes: durationMinutes,
      start_time: lifeOSTimeString,
      is_scheduled: true,
      status: "todo",
      completed: false,
      // Outlook-specific metadata
      outlook_id: outlookEvent.id,
      outlook_account: outlookEvent.accountEmail,
      source: "outlook",
      is_all_day: outlookEvent.isAllDay || false,
      location: outlookEvent.location?.displayName || "",
    };

    return task;
  } catch (error) {
    console.error("Error converting event:", outlookEvent.subject, error);
    return null;
  }
};

// Import events from all accounts
export const importAllAccountsEvents = async (startDate, endDate, supabase) => {
  try {
    console.log("🔄 Starting multi-account calendar import...");
    
    // Get events from all accounts
    const allEvents = await getAllAccountsCalendarEvents(startDate, endDate);
    
    if (allEvents.length === 0) {
      console.log("📭 No events found in any account");
      return [];
    }

    // Convert to LifeOS format
    const tasks = allEvents
      .map(convertOutlookEventToTask)
      .filter(task => task !== null);

    console.log(`📥 Converting ${allEvents.length} events → ${tasks.length} tasks`);

    // Check for existing imports to avoid duplicates
    const { data: existingTasks } = await supabase
      .from("tasks")
      .select("outlook_id")
      .not("outlook_id", "is", null);

    const existingIds = new Set(existingTasks?.map(t => t.outlook_id) || []);
    const newTasks = tasks.filter(task => !existingIds.has(task.outlook_id));

    if (newTasks.length === 0) {
      console.log("📋 No new events to import (all already exist)");
      return [];
    }

    // Insert new tasks
    const { data, error } = await supabase
      .from("tasks")
      .insert(newTasks)
      .select();

    if (error) {
      console.error("❌ Error importing to database:", error);
      throw error;
    }

    console.log(`✅ Successfully imported ${data.length} new events from multiple accounts`);
    
    // Group results by account for summary
    const byAccount = {};
    data.forEach(task => {
      const account = task.outlook_account || "Unknown";
      byAccount[account] = (byAccount[account] || 0) + 1;
    });

    console.log("📊 Import summary by account:", byAccount);
    return data;
  } catch (error) {
    console.error("❌ Multi-account import failed:", error);
    throw error;
  }
};
