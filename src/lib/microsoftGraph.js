import { Client } from "@microsoft/microsoft-graph-client";
import { msalInstance, silentRequest } from "./msalConfig";

// Create authenticated Graph client
const getGraphClient = async () => {
  try {
    // Get active account
    const account = msalInstance.getActiveAccount();
    if (!account) {
      throw new Error("No active account found");
    }

    // Acquire token silently
    const response = await msalInstance.acquireTokenSilent({
      ...silentRequest,
      account: account,
    });

    // Create Graph client with token
    const graphClient = Client.init({
      authProvider: async (done) => {
        done(null, response.accessToken);
      },
    });

    return graphClient;
  } catch (error) {
    console.error("Error creating Graph client:", error);
    throw error;
  }
};

// Fetch calendar events from Outlook
export const getOutlookCalendarEvents = async (startDate, endDate) => {
  try {
    const graphClient = await getGraphClient();

    // Format dates for Microsoft Graph API
    const startDateTime = startDate.toISOString();
    const endDateTime = endDate.toISOString();

    console.log(`📅 Fetching Outlook events: ${startDateTime} to ${endDateTime}`);

    // Get calendar events
    const events = await graphClient
      .api("/me/events")
      .select("id,subject,body,start,end,location,categories,sensitivity,isAllDay,recurrence")
      .filter(`start/dateTime ge '${startDateTime}' and end/dateTime le '${endDateTime}'`)
      .orderby("start/dateTime")
      .top(100)
      .get();

    console.log(`📋 Found ${events.value.length} Outlook events`);
    return events.value;
  } catch (error) {
    console.error("Error fetching Outlook calendar:", error);
    throw error;
  }
};

// Convert Outlook event to LifeOS task format
export const convertOutlookEventToTask = (outlookEvent) => {
  try {
    // Parse start and end times
    const startTime = new Date(outlookEvent.start.dateTime);
    const endTime = new Date(outlookEvent.end.dateTime);
    
    // Calculate duration in minutes
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = Math.round(durationMs / (1000 * 60));

    // Create LifeOS task format
    const task = {
      title: outlookEvent.subject || "Untitled Event",
      description: outlookEvent.body?.content || "",
      tags: outlookEvent.categories || [],
      duration_minutes: Math.max(30, durationMinutes), // Minimum 30 minutes
      start_time: formatDateForLifeOS(startTime),
      is_scheduled: true,
      status: "todo",
      completed: false,
      outlook_id: outlookEvent.id, // Store original ID for sync
      source: "outlook"
    };

    console.log(`🔄 Converted: "${outlookEvent.subject}" → LifeOS task`);
    return task;
  } catch (error) {
    console.error("Error converting Outlook event:", error);
    return null;
  }
};

// Format date for LifeOS (YYYY-MM-DD HH:MM:SS format)
const formatDateForLifeOS = (date) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hour = date.getHours().toString().padStart(2, "0");
  const minute = date.getMinutes().toString().padStart(2, "0");
  
  return `${year}-${month}-${day} ${hour}:${minute}:00`;
};

// Import Outlook events to LifeOS
export const importOutlookEvents = async (events, supabase) => {
  try {
    const tasks = events
      .map(convertOutlookEventToTask)
      .filter(task => task !== null); // Remove failed conversions

    console.log(`📥 Importing ${tasks.length} events to LifeOS`);

    // Insert tasks into Supabase
    const { data, error } = await supabase
      .from("tasks")
      .insert(tasks)
      .select();

    if (error) {
      console.error("Error importing to database:", error);
      throw error;
    }

    console.log(`✅ Successfully imported ${data.length} calendar events`);
    return data;
  } catch (error) {
    console.error("Error importing Outlook events:", error);
    throw error;
  }
};
