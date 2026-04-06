import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { FITNESS_FALLBACK_OPTIONS, FITNESS_GOAL_CONFIG } from "@/lib/fitness/constants";
import { ensureDefaultFitnessGoals, readLocalFitnessStore, writeLocalStore } from "@/lib/fitness/queries";

function toDateString(value = new Date()) {
  return format(new Date(value), "yyyy-MM-dd");
}

function toTimeString(value) {
  if (!value) return null;
  if (typeof value === "string") {
    return value.length === 5 ? `${value}:00` : value;
  }
  return format(new Date(value), "HH:mm:ss");
}

function toTimestampString(value) {
  if (!value) return null;
  if (typeof value === "string" && value.includes(" ")) {
    return value;
  }
  if (typeof value === "string" && value.length === 5) {
    return `${toDateString()} ${value}:00`;
  }
  return format(new Date(value), "yyyy-MM-dd HH:mm:ss");
}

function labelForSession(sessionType) {
  return sessionType === "bjj" ? "BJJ" : "Gym Strength";
}

function fallbackTemplateValue(key) {
  return FITNESS_FALLBACK_OPTIONS.find((option) => option.value === key) || FITNESS_FALLBACK_OPTIONS[1];
}

async function getAuthenticatedUserId() {
  if (!supabase?.auth) {
    return null;
  }

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error("Error reading auth user for fitness mutations:", error);
      return null;
    }
    return data.user?.id || null;
  } catch (error) {
    console.error("Error reading auth user for fitness mutations:", error);
    return null;
  }
}

async function withSupabaseFallback({ action, fallback }) {
  try {
    if (supabase) {
      return await action();
    }
  } catch (error) {
    console.error("Fitness mutation fallback:", error);
  }

  return fallback();
}

export async function upsertFitnessGoal({ metricKey, targetCount, targetTime = null }) {
  const userId = await getAuthenticatedUserId();

  return withSupabaseFallback({
    action: async () => {
      if (!userId) throw new Error("No authenticated user for synced fitness goals.");

      const { data: existing, error: existingError } = await supabase
        .from("fitness_goals")
        .select("*")
        .eq("metric_key", metricKey)
        .eq("is_active", true)
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1);

      if (existingError) throw existingError;

      if (existing?.length) {
        const { data, error } = await supabase
          .from("fitness_goals")
          .update({ target_count: targetCount, target_time: toTimeString(targetTime) })
          .eq("id", existing[0].id)
          .eq("user_id", userId)
          .select("*")
          .single();
        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from("fitness_goals")
        .insert([{ metric_key: metricKey, user_id: userId, target_count: targetCount, target_time: toTimeString(targetTime), is_active: true }])
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    fallback: async () => {
      const store = await readLocalFitnessStore();
      const goals = [...store.goals];
      const index = goals.findIndex((goal) => goal.metric_key === metricKey);
      const nextGoal = {
        metric_key: metricKey,
        target_count: targetCount,
        target_time: toTimeString(targetTime),
        is_active: true,
      };
      if (index >= 0) goals[index] = { ...goals[index], ...nextGoal };
      else goals.push(nextGoal);
      return writeLocalStore({ ...store, goals });
    },
  });
}

export async function upsertWakeUpLog({ date = new Date(), actualTime, notes = "", note = "" }) {
  const sessionDate = toDateString(date);
  const normalizedTime = toTimeString(actualTime);
  const noteText = notes || note || "";
  const goals = await ensureDefaultFitnessGoals();
  const wakeGoal = goals.find((goal) => goal.metric_key === "wake_up") || { target_time: FITNESS_GOAL_CONFIG.wake_up.targetTime };
  const success = Boolean(normalizedTime && normalizedTime <= (wakeGoal.target_time || FITNESS_GOAL_CONFIG.wake_up.targetTime));
  const userId = await getAuthenticatedUserId();

  return withSupabaseFallback({
    action: async () => {
      if (!userId) throw new Error("No authenticated user for synced wake-up logs.");

      const { data: existing, error: existingError } = await supabase
        .from("fitness_habit_logs")
        .select("*")
        .eq("metric_key", "wake_up")
        .eq("logged_on", sessionDate)
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1);
      if (existingError) throw existingError;

      if (existing?.length) {
        const { data, error } = await supabase
          .from("fitness_habit_logs")
          .update({ actual_time: normalizedTime, success, note: noteText })
          .eq("id", existing[0].id)
          .eq("user_id", userId)
          .select("*")
          .single();
        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from("fitness_habit_logs")
        .insert([{ metric_key: "wake_up", user_id: userId, logged_on: sessionDate, actual_time: normalizedTime, success, note: noteText }])
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    fallback: async () => {
      const store = await readLocalFitnessStore();
      const habitLogs = [...store.habitLogs];
      const index = habitLogs.findIndex((entry) => entry.metric_key === "wake_up" && entry.logged_on === sessionDate);
      const nextEntry = {
        ...(index >= 0 ? habitLogs[index] : {}),
        metric_key: "wake_up",
        logged_on: sessionDate,
        actual_time: normalizedTime,
        success,
        note: noteText,
      };
      if (index >= 0) habitLogs[index] = nextEntry;
      else habitLogs.unshift(nextEntry);
      return writeLocalStore({ ...store, habitLogs });
    },
  });
}

export async function createWeightMetric({ date = new Date(), weightValue, notes = "", note = "" }) {
  const noteText = notes || note || "";
  const userId = await getAuthenticatedUserId();
  const payload = {
    measured_on: toDateString(date),
    weight_value: Number(weightValue),
    note: noteText,
  };

  return withSupabaseFallback({
    action: async () => {
      if (!userId) throw new Error("No authenticated user for synced weight check-ins.");

      const { data, error } = await supabase
        .from("fitness_body_metrics")
        .insert([{ user_id: userId, ...payload }])
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    fallback: async () => {
      const store = await readLocalFitnessStore();
      const bodyMetrics = [{ id: Date.now(), ...payload }, ...store.bodyMetrics];
      return writeLocalStore({ ...store, bodyMetrics });
    },
  });
}

export async function logTrainingSession({
  id = null,
  date = new Date(),
  sessionType = "gym_strength",
  status = "completed",
  notes = "",
  plannedStartTime = null,
  durationMinutes = 60,
  isFallback = false,
  calendarTaskId = null,
  sourceSessionId = null,
  sessionTitle = null,
}) {
  const userId = await getAuthenticatedUserId();
  const payload = {
    session_type: sessionType,
    session_title: sessionTitle || `${labelForSession(sessionType)} Session`,
    session_date: toDateString(date),
    scheduled_for: plannedStartTime ? toTimestampString(plannedStartTime) : null,
    duration_minutes: Number(durationMinutes) || 60,
    status,
    is_fallback: Boolean(isFallback),
    fallback_template: isFallback ? "custom" : null,
    note: notes || "",
    calendar_task_id: calendarTaskId,
    source_session_id: sourceSessionId,
  };

  return withSupabaseFallback({
    action: async () => {
      if (!userId) throw new Error("No authenticated user for synced training sessions.");

      if (id) {
        const { data, error } = await supabase
          .from("fitness_training_sessions")
          .update(payload)
          .eq("id", id)
          .eq("user_id", userId)
          .select("*")
          .single();
        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from("fitness_training_sessions")
        .insert([{ user_id: userId, ...payload }])
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    fallback: async () => {
      const store = await readLocalFitnessStore();
      const trainingSessions = [...store.trainingSessions];
      const nextSession = { id: id || Date.now(), ...payload };
      const index = trainingSessions.findIndex((entry) => entry.id === nextSession.id);
      if (index >= 0) trainingSessions[index] = nextSession;
      else trainingSessions.unshift(nextSession);
      return writeLocalStore({ ...store, trainingSessions });
    },
  });
}

async function markSourceSessionMissed({ userId, sessionId, sessionDate, sessionType, durationMinutes, noteText }) {
  if (sessionId) {
    const { data, error } = await supabase
      .from("fitness_training_sessions")
      .update({ status: "missed", note: noteText || "Morning session missed." })
      .eq("id", sessionId)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  const { data: existing, error: existingError } = await supabase
    .from("fitness_training_sessions")
    .select("*")
    .eq("session_type", sessionType)
    .eq("session_date", sessionDate)
    .eq("user_id", userId)
    .eq("is_fallback", false)
    .order("created_at", { ascending: false })
    .limit(1);
  if (existingError) throw existingError;

  if (existing?.length) {
    const { data, error } = await supabase
      .from("fitness_training_sessions")
      .update({ status: "missed", note: noteText || existing[0].note || "Morning session missed." })
      .eq("id", existing[0].id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("fitness_training_sessions")
    .insert([
      {
        user_id: userId,
        session_type: sessionType,
        session_title: `Morning ${labelForSession(sessionType)}`,
        session_date: sessionDate,
        scheduled_for: `${sessionDate} 05:00:00`,
        duration_minutes: Number(durationMinutes) || 60,
        status: "missed",
        is_fallback: false,
        note: noteText || "Morning session missed.",
      },
    ])
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function handleMorningNoShow({
  date = new Date(),
  sessionType = "gym_strength",
  fallbackStartTime = null,
  durationMinutes = 60,
  notes = "",
  sessionId = null,
}) {
  const userId = await getAuthenticatedUserId();
  const sessionDate = toDateString(date);
  const fallbackOption = fallbackTemplateValue("after_work_reset");
  const fallbackTimestamp = fallbackStartTime
    ? (String(fallbackStartTime).includes(" ") ? String(fallbackStartTime) : `${sessionDate} ${String(fallbackStartTime).length === 5 ? `${fallbackStartTime}:00` : fallbackStartTime}`)
    : `${sessionDate} ${String(fallbackOption.defaultHour).padStart(2, "0")}:${String(fallbackOption.defaultMinute).padStart(2, "0")}:00`;
  const noteText = notes || `Missed morning ${labelForSession(sessionType)} session.`;

  return withSupabaseFallback({
    action: async () => {
      if (!userId) throw new Error("No authenticated user for synced no-show recovery.");

      const sourceSession = await markSourceSessionMissed({
        userId,
        sessionId,
        sessionDate,
        sessionType,
        durationMinutes,
        noteText,
      });

      const { data: existingFallback, error: fallbackError } = await supabase
        .from("fitness_training_sessions")
        .select("*")
        .eq("source_session_id", sourceSession.id)
        .eq("user_id", userId)
        .eq("is_fallback", true)
        .order("created_at", { ascending: true })
        .limit(1);
      if (fallbackError) throw fallbackError;

      const taskPayload = {
        user_id: userId,
        title: `Fallback ${labelForSession(sessionType)} Session`,
        description: `Auto-created after a missed morning ${labelForSession(sessionType).toLowerCase()} session.`,
        tags: ["Fitness", "Fallback", labelForSession(sessionType)],
        completed: false,
        status: "todo",
        start_time: fallbackTimestamp,
        duration_minutes: Number(durationMinutes) || fallbackOption.durationMinutes,
        is_scheduled: true,
        priority: "high",
        source: "manual",
      };

      let task = null;
      if (existingFallback?.[0]?.calendar_task_id) {
        const { data, error } = await supabase
          .from("tasks")
          .update(taskPayload)
          .eq("id", existingFallback[0].calendar_task_id)
          .eq("user_id", userId)
          .select("*")
          .single();
        if (error) throw error;
        task = data;
      } else {
        const { data, error } = await supabase
          .from("tasks")
          .insert([taskPayload])
          .select("*")
          .single();
        if (error) throw error;
        task = data;
      }

      const fallbackPayload = {
        user_id: userId,
        session_type: sessionType,
        session_title: `Fallback ${labelForSession(sessionType)} Session`,
        session_date: sessionDate,
        scheduled_for: fallbackTimestamp,
        duration_minutes: Number(durationMinutes) || fallbackOption.durationMinutes,
        status: "planned",
        is_fallback: true,
        fallback_template: fallbackOption.value,
        note: notes || `Fallback ${labelForSession(sessionType)} session scheduled.`,
        calendar_task_id: task.id,
        source_session_id: sourceSession.id,
      };

      let fallbackSession = null;
      if (existingFallback?.length) {
        const { data, error } = await supabase
          .from("fitness_training_sessions")
          .update(fallbackPayload)
          .eq("id", existingFallback[0].id)
          .eq("user_id", userId)
          .select("*")
          .single();
        if (error) throw error;
        fallbackSession = data;
      } else {
        const { data, error } = await supabase
          .from("fitness_training_sessions")
          .insert([fallbackPayload])
          .select("*")
          .single();
        if (error) throw error;
        fallbackSession = data;
      }

      return { missedSession: sourceSession, fallbackSession, task };
    },
    fallback: async () => {
      const store = await readLocalFitnessStore();
      const trainingSessions = [...store.trainingSessions];
      const sourceIndex = trainingSessions.findIndex((entry) => entry.id === sessionId);
      let sourceSessionId = sessionId || Date.now();
      if (sourceIndex >= 0) {
        trainingSessions[sourceIndex] = { ...trainingSessions[sourceIndex], status: "missed", note: noteText };
        sourceSessionId = trainingSessions[sourceIndex].id;
      } else {
        trainingSessions.unshift({
          id: sourceSessionId,
          session_type: sessionType,
          session_title: `Morning ${labelForSession(sessionType)}`,
          session_date: sessionDate,
          scheduled_for: `${sessionDate} 05:00:00`,
          duration_minutes: Number(durationMinutes) || 60,
          status: "missed",
          is_fallback: false,
          note: noteText,
        });
      }

      const fallbackIndex = trainingSessions.findIndex((entry) => entry.source_session_id === sourceSessionId && entry.is_fallback);
      const fallbackEntry = {
        id: fallbackIndex >= 0 ? trainingSessions[fallbackIndex].id : Date.now() + 1,
        session_type: sessionType,
        session_title: `Fallback ${labelForSession(sessionType)} Session`,
        session_date: sessionDate,
        scheduled_for: fallbackTimestamp,
        duration_minutes: Number(durationMinutes) || fallbackOption.durationMinutes,
        status: "planned",
        is_fallback: true,
        fallback_template: fallbackOption.value,
        note: notes || `Fallback ${labelForSession(sessionType)} session scheduled.`,
        calendar_task_id: fallbackIndex >= 0 ? trainingSessions[fallbackIndex].calendar_task_id || Date.now() + 2 : Date.now() + 2,
        source_session_id: sourceSessionId,
      };

      if (fallbackIndex >= 0) trainingSessions[fallbackIndex] = fallbackEntry;
      else trainingSessions.unshift(fallbackEntry);

      return writeLocalStore({ ...store, trainingSessions }).then(() => ({
        missedSession: trainingSessions.find((entry) => entry.id === sourceSessionId),
        fallbackSession: fallbackEntry,
        task: null,
      }));
    },
  });
}

export const createWeightCheckIn = createWeightMetric;
export const confirmMorningNoShow = handleMorningNoShow;
export const upsertTrainingSession = logTrainingSession;
