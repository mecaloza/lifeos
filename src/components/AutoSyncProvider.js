"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { autoSyncManager } from "@/lib/autoSync";

// One-time cleanup: remove duplicate scheduled tasks (same title + start_time)
async function cleanupDuplicateTasks() {
  try {
    const alreadyCleaned = localStorage.getItem("lifeos_duplicates_cleaned");
    if (alreadyCleaned) return;

    console.log("🧹 Checking for duplicate calendar tasks...");

    const { data: tasks, error } = await supabase
      .from("tasks")
      .select("id, title, start_time, source, google_id, outlook_id, created_at")
      .eq("is_scheduled", true)
      .not("start_time", "is", null)
      .order("id", { ascending: true });

    if (error || !tasks || tasks.length === 0) return;

    // Group by normalized title + start_time
    const groups = {};
    for (const task of tasks) {
      const key = `${(task.title || "").trim().toLowerCase()}|${task.start_time}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    }

    // Find duplicates (groups with more than 1 task)
    const idsToDelete = [];
    for (const [key, group] of Object.entries(groups)) {
      if (group.length > 1) {
        // Keep the first one (lowest ID), delete the rest
        const [keep, ...duplicates] = group;
        console.log(
          `🔗 "${keep.title}" at ${keep.start_time}: keeping #${keep.id}, removing ${duplicates.length} duplicate(s)`
        );
        idsToDelete.push(...duplicates.map((t) => t.id));
      }
    }

    if (idsToDelete.length === 0) {
      console.log("✅ No duplicate tasks found");
      localStorage.setItem("lifeos_duplicates_cleaned", "true");
      return;
    }

    console.log(`🗑️ Removing ${idsToDelete.length} duplicate tasks...`);

    // Delete in batches of 50
    for (let i = 0; i < idsToDelete.length; i += 50) {
      const batch = idsToDelete.slice(i, i + 50);
      const { error: delError } = await supabase
        .from("tasks")
        .delete()
        .in("id", batch);

      if (delError) {
        console.error("❌ Error deleting duplicates:", delError);
        return;
      }
    }

    console.log(`✅ Cleaned up ${idsToDelete.length} duplicate tasks!`);
    localStorage.setItem("lifeos_duplicates_cleaned", "true");
  } catch (err) {
    console.error("Cleanup error:", err);
  }
}

// One-time fix: delete calendar-imported events that had wrong times (snapped to full hours)
// so they get re-imported with correct start_time and duration
async function fixCalendarEventTimes() {
  try {
    const alreadyFixed = localStorage.getItem("lifeos_calendar_times_fixed_v2");
    if (alreadyFixed) return;

    console.log("🔧 Fixing calendar events with incorrect times...");

    // Find all calendar-imported tasks (have calendar tags)
    const { data: tasks, error } = await supabase
      .from("tasks")
      .select("id, title, start_time, tags, duration_minutes")
      .eq("is_scheduled", true)
      .not("start_time", "is", null);

    if (error || !tasks || tasks.length === 0) {
      localStorage.setItem("lifeos_calendar_times_fixed_v2", "true");
      return;
    }

    // Only target tasks imported from calendars
    const calendarTasks = tasks.filter((t) => {
      const tags = t.tags || [];
      return tags.some((tag) =>
        ["Google Calendar", "Outlook", "Calendar", "Meeting", "Reunión"].includes(tag)
      );
    });

    if (calendarTasks.length === 0) {
      console.log("✅ No calendar tasks to fix");
      localStorage.setItem("lifeos_calendar_times_fixed_v2", "true");
      return;
    }

    const idsToDelete = calendarTasks.map((t) => t.id);
    console.log(`🗑️ Removing ${idsToDelete.length} calendar events for re-import with correct times...`);

    // Delete in batches of 50
    for (let i = 0; i < idsToDelete.length; i += 50) {
      const batch = idsToDelete.slice(i, i + 50);
      const { error: delError } = await supabase
        .from("tasks")
        .delete()
        .in("id", batch);

      if (delError) {
        console.error("❌ Error deleting calendar tasks:", delError);
        return;
      }
    }

    console.log(`✅ Removed ${idsToDelete.length} calendar tasks. They will re-import with correct times on next sync.`);
    localStorage.setItem("lifeos_calendar_times_fixed_v2", "true");
  } catch (err) {
    console.error("Fix calendar times error:", err);
  }
}

export default function AutoSyncProvider() {
  useEffect(() => {
    // Fix incorrect calendar events, clean duplicates, then start auto-sync
    const timer = setTimeout(async () => {
      await fixCalendarEventTimes();
      await cleanupDuplicateTasks();
      autoSyncManager.startAutoSync(supabase).catch((err) => {
        console.log("Auto-sync init skipped:", err.message);
      });
    }, 3000);

    return () => {
      clearTimeout(timer);
      autoSyncManager.stopAutoSync();
    };
  }, []);

  return null;
}
