import { supabase } from "@/lib/supabase";
import { endOfWeek, eachDayOfInterval, format, startOfWeek, subDays } from "date-fns";
import { FITNESS_GOAL_CONFIG } from "@/lib/fitness/constants";

const STORAGE_KEY = "lifeos_fitness_data_v1";

const DEFAULT_GOALS = Object.values(FITNESS_GOAL_CONFIG).map((goal) => ({
  metric_key: goal.metricKey,
  target_count: goal.targetCount,
  target_time: goal.targetTime || null,
  is_active: true,
}));

function emptyStore() {
  return {
    goals: [...DEFAULT_GOALS],
    habitLogs: [],
    bodyMetrics: [],
    trainingSessions: [],
  };
}

function toDateString(value = new Date()) {
  return format(new Date(value), "yyyy-MM-dd");
}

function toTimestampDate(value) {
  if (!value) return new Date(0);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00`);
  }
  const normalized = String(value).replace(" ", "T");
  return new Date(normalized);
}

function getWeekRange(referenceDate = new Date()) {
  return {
    start: startOfWeek(referenceDate, { weekStartsOn: 1 }),
    end: endOfWeek(referenceDate, { weekStartsOn: 1 }),
  };
}

function readFromStore(rawStore) {
  if (!rawStore) {
    return emptyStore();
  }

  return {
    ...emptyStore(),
    ...rawStore,
    goals: Array.isArray(rawStore.goals) && rawStore.goals.length > 0 ? rawStore.goals : [...DEFAULT_GOALS],
  };
}

export async function readLocalFitnessStore() {
  if (typeof window === "undefined") {
    return emptyStore();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return readFromStore(raw ? JSON.parse(raw) : null);
  } catch (error) {
    console.error("Error reading local fitness store:", error);
    return emptyStore();
  }
}

export async function writeLocalStore(nextStore) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStore));
  }
  return nextStore;
}

async function getAuthenticatedUserId() {
  if (!supabase?.auth) {
    return null;
  }

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error("Error reading auth user for fitness sync:", error);
      return null;
    }
    return data.user?.id || null;
  } catch (error) {
    console.error("Error reading auth user for fitness sync:", error);
    return null;
  }
}

function buildGoalsMap(goals = []) {
  const activeGoals = Array.isArray(goals) ? goals : [];
  return Object.keys(FITNESS_GOAL_CONFIG).reduce((acc, metricKey) => {
    const config = FITNESS_GOAL_CONFIG[metricKey];
    const row = activeGoals.find((goal) => goal.metric_key === metricKey && goal.is_active !== false);
    acc[metricKey] = {
      metric_key: metricKey,
      target_count: row?.target_count ?? config.targetCount,
      target_time: row?.target_time ?? config.targetTime ?? null,
      label: config.label,
      helperText: config.helperText,
      color: config.chartColor,
    };
    return acc;
  }, {});
}

function buildScorecard(goalsMap, habitLogs, bodyMetrics, trainingSessions) {
  const wakeCount = habitLogs.filter((log) => log.metric_key === "wake_up" && log.success).length;
  const gymCount = trainingSessions.filter((session) => session.session_type === "gym_strength" && session.status === "completed").length;
  const bjjCount = trainingSessions.filter((session) => session.session_type === "bjj" && session.status === "completed").length;
  const weightCount = bodyMetrics.length;

  const progressByMetric = {
    wake_up: wakeCount,
    gym_strength: gymCount,
    bjj: bjjCount,
    weight_checkin: weightCount,
  };

  return Object.keys(goalsMap).map((metricKey) => {
    const goal = goalsMap[metricKey];
    const current = progressByMetric[metricKey] || 0;
    const target = goal.target_count || 0;
    const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    return {
      key: metricKey,
      metricKey,
      label: goal.label,
      helperText: goal.helperText,
      color: goal.color,
      current,
      target,
      progress,
      status: current >= target ? "goal_met" : progress >= 70 ? "on_track" : "behind",
      goalTime: goal.target_time,
    };
  });
}

function buildWakeTrend(habitLogs, referenceDate = new Date()) {
  const dates = eachDayOfInterval({ start: subDays(referenceDate, 6), end: referenceDate });
  const logMap = new Map(habitLogs.map((log) => [log.logged_on, log]));

  return dates.map((date) => {
    const key = toDateString(date);
    const log = logMap.get(key);
    return {
      date: key,
      label: format(date, "EEE"),
      success: log?.success ? 1 : 0,
      successValue: log?.success ? 1 : 0,
      actualTime: log?.actual_time || null,
    };
  });
}

function buildWeightTrend(bodyMetrics) {
  return [...bodyMetrics]
    .sort((a, b) => toTimestampDate(a.measured_on) - toTimestampDate(b.measured_on))
    .slice(-8)
    .map((metric) => ({
      date: metric.measured_on,
      label: format(toTimestampDate(metric.measured_on), "MMM d"),
      weightValue: Number(metric.weight_value),
      value: Number(metric.weight_value),
    }));
}

function buildTrainingTrend(trainingSessions, referenceDate = new Date()) {
  const dates = eachDayOfInterval({ start: subDays(referenceDate, 6), end: referenceDate });

  return dates.map((date) => {
    const key = toDateString(date);
    const daySessions = trainingSessions.filter((session) => session.session_date === key && session.status === "completed");
    return {
      date: key,
      label: format(date, "EEE"),
      gym: daySessions.filter((session) => session.session_type === "gym_strength").length,
      bjj: daySessions.filter((session) => session.session_type === "bjj").length,
    };
  });
}

function buildRecentSessions(habitLogs, bodyMetrics, trainingSessions) {
  const items = [
    ...trainingSessions.map((session) => ({
      id: `session-${session.id}`,
      title: session.session_title || (session.session_type === "gym_strength" ? "Gym strength session" : "BJJ session"),
      type: "session",
      sessionType: session.session_type,
      status: session.status,
      date: session.scheduled_for || session.session_date,
      dateLabel: format(toTimestampDate(session.scheduled_for || session.session_date), "MMM d"),
      subtitle: session.note || session.status,
      note: session.note || "",
      sortDate: session.scheduled_for || session.session_date,
    })),
    ...habitLogs.map((log) => ({
      id: `wake-${log.id}`,
      title: log.success ? "Wake-up goal met" : "Wake-up goal missed",
      type: "wake_up",
      sessionType: "wake_up",
      status: log.success ? "completed" : "missed",
      date: log.logged_on,
      dateLabel: format(toTimestampDate(log.logged_on), "MMM d"),
      subtitle: log.actual_time ? `Logged ${log.actual_time}` : log.note || "",
      note: log.actual_time ? `Logged ${log.actual_time}` : log.note || "",
      sortDate: log.logged_on,
    })),
    ...bodyMetrics.map((metric) => ({
      id: `weight-${metric.id}`,
      title: "Weight check-in",
      type: "weight",
      sessionType: "weight_checkin",
      status: "completed",
      date: metric.measured_on,
      dateLabel: format(toTimestampDate(metric.measured_on), "MMM d"),
      subtitle: `${metric.weight_value} kg`,
      note: `${metric.weight_value} kg`,
      sortDate: metric.measured_on,
    })),
  ];

  return items.sort((a, b) => toTimestampDate(b.sortDate) - toTimestampDate(a.sortDate)).slice(0, 8);
}

function calculateBestWakeStreak(habitLogs) {
  const sortedLogs = [...habitLogs].sort((a, b) => toTimestampDate(a.logged_on) - toTimestampDate(b.logged_on));
  let current = 0;
  let best = 0;

  for (const log of sortedLogs) {
    if (log.success) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }

  return best;
}

function calculateWeeklyMomentum(weekScorecard, previousScorecard) {
  const currentTotal = weekScorecard.reduce((sum, item) => sum + item.current, 0);
  const previousTotal = previousScorecard.reduce((sum, item) => sum + item.current, 0);
  return currentTotal - previousTotal;
}

function buildDashboardFromRows({ goals, habitLogs, bodyMetrics, trainingSessions, referenceDate = new Date() }) {
  const goalsMap = buildGoalsMap(goals);
  const { start, end } = getWeekRange(referenceDate);
  const previousStart = subDays(start, 7);
  const previousEnd = subDays(end, 7);
  const weekStart = toDateString(start);
  const weekEnd = toDateString(end);
  const previousWeekStart = toDateString(previousStart);
  const previousWeekEnd = toDateString(previousEnd);

  const weekHabitLogs = habitLogs.filter((log) => log.logged_on >= weekStart && log.logged_on <= weekEnd);
  const weekBodyMetrics = bodyMetrics.filter((metric) => metric.measured_on >= weekStart && metric.measured_on <= weekEnd);
  const weekTrainingSessions = trainingSessions.filter((session) => session.session_date >= weekStart && session.session_date <= weekEnd);
  const previousWeekHabitLogs = habitLogs.filter((log) => log.logged_on >= previousWeekStart && log.logged_on <= previousWeekEnd);
  const previousWeekBodyMetrics = bodyMetrics.filter((metric) => metric.measured_on >= previousWeekStart && metric.measured_on <= previousWeekEnd);
  const previousWeekTrainingSessions = trainingSessions.filter((session) => session.session_date >= previousWeekStart && session.session_date <= previousWeekEnd);

  const scorecard = buildScorecard(goalsMap, weekHabitLogs, weekBodyMetrics, weekTrainingSessions);
  const previousScorecard = buildScorecard(goalsMap, previousWeekHabitLogs, previousWeekBodyMetrics, previousWeekTrainingSessions);
  const weeklyCompletion = Math.round(scorecard.reduce((sum, item) => sum + item.progress, 0) / Math.max(scorecard.length, 1));
  const recentSessions = buildRecentSessions(habitLogs, bodyMetrics, trainingSessions);

  return {
    goals: goalsMap,
    scorecard,
    wakeTrend: buildWakeTrend(habitLogs, referenceDate),
    weightTrend: buildWeightTrend(bodyMetrics),
    trainingTrend: buildTrainingTrend(trainingSessions, referenceDate),
    recentSessions,
    recentActivity: recentSessions,
    insights: {
      headline: scorecard[0]?.current >= scorecard[0]?.target ? "Morning system protected" : "Protect the morning first",
      body: "This dashboard is built around the highest-leverage behavior: waking up early enough to defend training before the rest of the schedule takes over.",
      weeklyCompletion,
      bestStreak: calculateBestWakeStreak(habitLogs),
      weeklyMomentum: calculateWeeklyMomentum(scorecard, previousScorecard),
    },
    range: { start, end },
  };
}

function emptyDashboard(referenceDate = new Date()) {
  return buildDashboardFromRows({
    goals: DEFAULT_GOALS,
    habitLogs: [],
    bodyMetrics: [],
    trainingSessions: [],
    referenceDate,
  });
}

export async function ensureDefaultFitnessGoals() {
  if (!supabase) {
    const store = await readLocalFitnessStore();
    if (!store.goals?.length) {
      const nextStore = { ...store, goals: [...DEFAULT_GOALS] };
      await writeLocalStore(nextStore);
      return nextStore.goals;
    }
    return store.goals;
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    const store = await readLocalFitnessStore();
    return store.goals;
  }

  const { data, error } = await supabase
    .from("fitness_goals")
    .select("*")
    .eq("is_active", true)
    .eq("user_id", userId);

  if (error) throw error;

  const existingKeys = new Set((data || []).map((goal) => goal.metric_key));
  const missing = DEFAULT_GOALS.filter((goal) => !existingKeys.has(goal.metric_key)).map((goal) => ({
    ...goal,
    user_id: userId,
  }));

  if (!missing.length) {
    return data || [];
  }

  const { data: inserted, error: insertError } = await supabase
    .from("fitness_goals")
    .insert(missing)
    .select("*");

  if (insertError) throw insertError;
  return [...(data || []), ...(inserted || [])];
}

export async function fetchFitnessDashboard(referenceDate = new Date()) {
  if (!supabase) {
    const store = await readLocalFitnessStore();
    return buildDashboardFromRows({
      goals: store.goals,
      habitLogs: store.habitLogs,
      bodyMetrics: store.bodyMetrics,
      trainingSessions: store.trainingSessions,
      referenceDate,
    });
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    const store = await readLocalFitnessStore();
    return buildDashboardFromRows({
      goals: store.goals,
      habitLogs: store.habitLogs,
      bodyMetrics: store.bodyMetrics,
      trainingSessions: store.trainingSessions,
      referenceDate,
    });
  }

  const goals = await ensureDefaultFitnessGoals();
  const trendStart = toDateString(subDays(referenceDate, 27));
  const trendEnd = toDateString(referenceDate);

  const [habitLogsResponse, bodyMetricsResponse, sessionsResponse] = await Promise.all([
    supabase
      .from("fitness_habit_logs")
      .select("*")
      .gte("logged_on", trendStart)
      .lte("logged_on", trendEnd)
      .eq("user_id", userId)
      .order("logged_on", { ascending: true }),
    supabase
      .from("fitness_body_metrics")
      .select("*")
      .gte("measured_on", trendStart)
      .lte("measured_on", trendEnd)
      .eq("user_id", userId)
      .order("measured_on", { ascending: true }),
    supabase
      .from("fitness_training_sessions")
      .select("*")
      .gte("session_date", trendStart)
      .lte("session_date", trendEnd)
      .eq("user_id", userId)
      .order("session_date", { ascending: true }),
  ]);

  if (habitLogsResponse.error) throw habitLogsResponse.error;
  if (bodyMetricsResponse.error) throw bodyMetricsResponse.error;
  if (sessionsResponse.error) throw sessionsResponse.error;

  return buildDashboardFromRows({
    goals,
    habitLogs: habitLogsResponse.data || [],
    bodyMetrics: bodyMetricsResponse.data || [],
    trainingSessions: sessionsResponse.data || [],
    referenceDate,
  });
}

export async function getFitnessSnapshot(referenceDate = new Date()) {
  return fetchFitnessDashboard(referenceDate);
}

export { buildDashboardFromRows, emptyDashboard, getWeekRange, toDateString };
