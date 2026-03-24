// Smart filtering for Outlook events - not all meetings should be tasks

// Check if an event should be imported as a task
export const shouldImportAsTask = (outlookEvent) => {
  const subject = (outlookEvent.subject || "").toLowerCase();
  const body = (outlookEvent.body?.content || "").toLowerCase();
  const location = (outlookEvent.location?.displayName || "").toLowerCase();

  // Skip certain types of events
  const skipKeywords = [
    // Automatic/system events
    "canceled",
    "cancelled",
    "tentative",
    "free/busy",
    // Social events that aren't work tasks
    "birthday",
    "anniversary",
    "holiday",
    "vacation",
    // Large meetings that aren't actionable tasks
    "all hands",
    "company meeting",
    "town hall",
    // Personal events (can be customized)
    "personal",
    "family",
    "doctor",
    "dental",
  ];

  // Skip very short events (likely not tasks)
  const duration =
    new Date(outlookEvent.end.dateTime) - new Date(outlookEvent.start.dateTime);
  const durationMinutes = duration / (1000 * 60);
  if (durationMinutes < 15) {
    console.log(
      `⏭️ Skipping short event: "${outlookEvent.subject}" (${durationMinutes} min)`
    );
    return false;
  }

  // Skip all-day events (usually not tasks)
  if (outlookEvent.isAllDay) {
    console.log(`⏭️ Skipping all-day event: "${outlookEvent.subject}"`);
    return false;
  }

  // Check for skip keywords (only in subject and location, not body HTML)
  for (const keyword of skipKeywords) {
    if (subject.includes(keyword) || location.includes(keyword)) {
      console.log(
        `⏭️ SKIPPING: "${outlookEvent.subject}" (${keyword} in subject/location)`
      );
      return false;
    }
  }

  // For body content, only check for very specific skip terms
  const bodySkipKeywords = ["birthday", "anniversary", "vacation", "holiday"];
  for (const keyword of bodySkipKeywords) {
    if (body.includes(keyword)) {
      console.log(
        `⏭️ SKIPPING: "${outlookEvent.subject}" (${keyword} in body content)`
      );
      return false;
    }
  }

  // Import as task if contains work-related keywords:
  const importKeywords = [
    // Work-related (English)
    "meeting",
    "standup",
    "sync",
    "review",
    "planning",
    "sprint",
    "project",
    "client",
    "demo",
    "presentation",
    "interview",
    "call",
    "session",
    "workshop",
    "training",
    "1:1",
    "one-on-one",
    // Spanish equivalents
    "reunion",
    "junta",
    "llamada",
    "sesion",
    "entrevista",
    "proyecto",
    "revision",
    "revison",
    "pixeles",
    "general", // Add specific keywords from your events
    // Common work terms
    "team",
    "equipo",
    "weekly",
    "semanal",
    "daily",
    "diario",
  ];

  // Check for import keywords
  for (const keyword of importKeywords) {
    if (subject.includes(keyword) || body.includes(keyword)) {
      console.log(
        `✅ IMPORTING: "${outlookEvent.subject}" (matched keyword: "${keyword}")`
      );
      return true;
    }
  }

  // Check for Teams/Meet meetings (usually work)
  if (
    location.includes("teams") ||
    location.includes("meet") ||
    body.includes("teams.microsoft.com") ||
    body.includes("meet.google.com")
  ) {
    console.log(`✅ IMPORTING: "${outlookEvent.subject}" (Teams/Meet meeting)`);
    return true;
  }

  // Events with attendees are usually work-related
  if (outlookEvent.attendees && outlookEvent.attendees.length > 1) {
    console.log(
      `✅ IMPORTING: "${outlookEvent.subject}" (multi-attendee: ${outlookEvent.attendees.length})`
    );
    return true;
  }

  // Events during work hours (7 AM - 7 PM) are likely work-related
  const eventHour = new Date(outlookEvent.start.dateTime).getHours();
  if (eventHour >= 7 && eventHour <= 19) {
    console.log(
      `✅ IMPORTING: "${outlookEvent.subject}" (work hours: ${eventHour}:00)`
    );
    return true;
  }

  // If we get here, it's probably not a work task
  console.log(
    `⏭️ SKIPPING: "${outlookEvent.subject}" (no work indicators found)`
  );
  return false;
};

// Create task tags based on event properties
export const generateEventTags = (outlookEvent) => {
  const tags = ["Outlook"];
  const subject = (outlookEvent.subject || "").toLowerCase();

  // Add category-based tags
  if (outlookEvent.categories && outlookEvent.categories.length > 0) {
    tags.push(...outlookEvent.categories);
  }

  // Add smart tags based on content
  if (subject.includes("standup") || subject.includes("daily")) {
    tags.push("Daily");
  }
  if (subject.includes("client") || subject.includes("customer")) {
    tags.push("Client");
  }
  if (subject.includes("interview") || subject.includes("hiring")) {
    tags.push("Hiring");
  }
  if (subject.includes("1:1") || subject.includes("one-on-one")) {
    tags.push("1-on-1");
  }
  if (subject.includes("sprint") || subject.includes("planning")) {
    tags.push("Planning");
  }

  // Add time-based tags
  const eventHour = new Date(outlookEvent.start.dateTime).getHours();
  if (eventHour < 9) {
    tags.push("Early");
  } else if (eventHour >= 17) {
    tags.push("Late");
  }

  return [...new Set(tags)]; // Remove duplicates
};
