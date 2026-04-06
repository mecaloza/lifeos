"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Loader2,
  Scale,
  ShieldAlert,
  Target,
  TimerReset,
} from "lucide-react";
import FitnessSummaryCards from "@/components/fitness/FitnessSummaryCards";
import FitnessCharts from "@/components/fitness/FitnessCharts";
import FitnessEntryModal from "@/components/fitness/FitnessEntryModal";
import { fetchFitnessDashboard } from "@/lib/fitness/queries";
import {
  createWeightMetric,
  handleMorningNoShow,
  logTrainingSession,
  upsertFitnessGoal,
  upsertWakeUpLog,
} from "@/lib/fitness/mutations";

const DEFAULT_SCORECARD = [
  {
    key: "wake_up",
    label: "Wake-ups before 5:00",
    current: 0,
    target: 5,
    helperText: "Beat the entrepreneur-day chaos before it starts.",
    color: "#10B981",
  },
  {
    key: "gym_strength",
    label: "Gym strength",
    current: 0,
    target: 4,
    helperText: "Strength sessions completed this week.",
    color: "#3B82F6",
  },
  {
    key: "bjj",
    label: "Brazilian jiu-jitsu",
    current: 0,
    target: 4,
    helperText: "Sessions protected and executed.",
    color: "#8B5CF6",
  },
  {
    key: "weight_checkin",
    label: "Weight check-ins",
    current: 0,
    target: 5,
    helperText: "Keep the trend visible with light friction.",
    color: "#F59E0B",
  },
];

const QUICK_ACTIONS = [
  { key: "wake", label: "Log wake-up", description: "Capture the exact time you woke up.", icon: CalendarClock },
  { key: "weight", label: "Add weight", description: "Keep weight trend data fresh.", icon: Scale },
  { key: "training", label: "Training update", description: "Mark a gym or BJJ session outcome.", icon: ShieldAlert },
  { key: "noshow", label: "Morning no-show", description: "Recover the day with a fallback slot.", icon: TimerReset },
  { key: "goals", label: "Edit goals", description: "Update weekly targets without leaving the dashboard.", icon: Target },
];

function toDisplayDate(value) {
  if (!value) return "—";
  const parsedValue =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00`)
      : new Date(value);
  return parsedValue.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function normalizeScorecard(rawScorecard) {
  const incoming = Array.isArray(rawScorecard)
    ? rawScorecard.reduce((acc, item) => {
        if (item?.key) acc[item.key] = item;
        return acc;
      }, {})
    : rawScorecard || {};

  return DEFAULT_SCORECARD.map((item) => ({
    ...item,
    ...(incoming[item.key] || {}),
  }));
}

function normalizeWakeTrend(rawTrend = []) {
  if (!Array.isArray(rawTrend) || rawTrend.length === 0) {
    return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => ({
      label,
      successValue: 0,
    }));
  }

  return rawTrend.map((item) => ({
    label: item.label || item.dayLabel || toDisplayDate(item.date),
    successValue:
      item.successValue ??
      item.value ??
      (item.success === true ? 1 : 0),
  }));
}

function normalizeWeightTrend(rawTrend = []) {
  return (Array.isArray(rawTrend) ? rawTrend : []).map((item) => ({
    label: item.label || toDisplayDate(item.date || item.measured_on),
    weightValue:
      item.weightValue ?? item.value ?? item.weight ?? item.weight_value ?? 0,
  }));
}

function normalizeTrainingTrend(rawTrend = []) {
  if (!Array.isArray(rawTrend) || rawTrend.length === 0) {
    return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => ({
      label,
      gym: 0,
      bjj: 0,
    }));
  }

  return rawTrend.map((item) => ({
    label: item.label || item.dayLabel || toDisplayDate(item.date),
    gym: item.gym ?? item.gymStrength ?? item.gym_strength ?? 0,
    bjj: item.bjj ?? 0,
  }));
}

function normalizeRecentSessions(rawSessions = []) {
  return (Array.isArray(rawSessions) ? rawSessions : []).map((session, index) => ({
    id: session.id || `${session.sessionType || session.session_type}-${index}`,
    title:
      session.title ||
      (session.sessionType === "bjj" || session.session_type === "bjj"
        ? "BJJ session"
        : "Gym strength session"),
    status: session.status || "planned",
    dateLabel: toDisplayDate(session.date || session.session_date || session.scheduled_for),
    note: session.notes || session.note || "",
  }));
}

function normalizeInsights(rawInsights = {}, scorecard = DEFAULT_SCORECARD) {
  const totalCurrent = scorecard.reduce((sum, item) => sum + (item.current || 0), 0);
  const totalTarget = scorecard.reduce((sum, item) => sum + (item.target || 0), 0);

  return {
    headline: rawInsights.headline || "Protect the morning, protect the week",
    body:
      rawInsights.body ||
      "This dashboard is built around your highest leverage habit: waking up early enough to keep training on track before the rest of the day takes over.",
    weeklyCompletion:
      rawInsights.weeklyCompletion ??
      (totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0),
    bestStreak: rawInsights.bestStreak ?? rawInsights.wakeStreak ?? 0,
    weeklyMomentum: rawInsights.weeklyMomentum ?? rawInsights.delta ?? 0,
  };
}

export default function FitnessPage() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [pendingMode, setPendingMode] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const loadDashboard = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      else setRefreshing(true);

      setErrorMessage("");
      const rawDashboard = await fetchFitnessDashboard();
      const scorecard = normalizeScorecard(rawDashboard?.scorecard);

      setDashboard({
        scorecard,
        wakeTrend: normalizeWakeTrend(rawDashboard?.wakeTrend),
        weightTrend: normalizeWeightTrend(rawDashboard?.weightTrend),
        trainingTrend: normalizeTrainingTrend(rawDashboard?.trainingTrend),
        recentSessions: normalizeRecentSessions(rawDashboard?.recentSessions),
        insights: normalizeInsights(rawDashboard?.insights, scorecard),
      });
    } catch (error) {
      console.error("Failed to load fitness dashboard:", error);
      setErrorMessage(
        error?.message ||
          "Fitness data is not ready yet. Once the fitness queries land, this page will hydrate automatically."
      );
      setDashboard({
        scorecard: DEFAULT_SCORECARD,
        wakeTrend: normalizeWakeTrend([]),
        weightTrend: normalizeWeightTrend([]),
        trainingTrend: normalizeTrainingTrend([]),
        recentSessions: [],
        insights: normalizeInsights({}, DEFAULT_SCORECARD),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(true);
  }, [loadDashboard]);

  const scorecard = dashboard?.scorecard || DEFAULT_SCORECARD;
  const insights = dashboard?.insights || normalizeInsights({}, scorecard);

  const totalCompletion = useMemo(() => {
    const totalTarget = scorecard.reduce((sum, item) => sum + (item.target || 0), 0);
    const totalCurrent = scorecard.reduce((sum, item) => sum + (item.current || 0), 0);
    return totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0;
  }, [scorecard]);

  const openModal = (mode) => setActiveModal(mode);
  const closeModal = () => {
    if (pendingMode) return;
    setActiveModal(null);
  };

  const handleModalSubmit = async (formState, mode) => {
    try {
      setPendingMode(mode);
      if (mode === "wake") {
        await upsertWakeUpLog({ date: formState.date, actualTime: formState.actualTime });
      } else if (mode === "weight") {
        await createWeightMetric({
          date: formState.date,
          weightValue: Number(formState.weightValue),
          notes: formState.notes,
        });
      } else if (mode === "training") {
        await logTrainingSession({
          date: formState.date,
          sessionType: formState.sessionType,
          status: formState.status,
          notes: formState.notes,
        });
      } else if (mode === "noshow") {
        await handleMorningNoShow({
          date: formState.date,
          sessionType: formState.sessionType,
          fallbackStartTime: formState.fallbackStartTime,
          durationMinutes: Number(formState.durationMinutes),
          notes: formState.notes,
        });
      } else if (mode === "goals") {
        await Promise.all([
          upsertFitnessGoal({
            metricKey: "wake_up",
            targetCount: Number(formState.wakeTargetDays),
            targetTime: formState.wakeTargetTime,
          }),
          upsertFitnessGoal({
            metricKey: "gym_strength",
            targetCount: Number(formState.gymTarget),
          }),
          upsertFitnessGoal({
            metricKey: "bjj",
            targetCount: Number(formState.bjjTarget),
          }),
          upsertFitnessGoal({
            metricKey: "weight_checkin",
            targetCount: Number(formState.weightTarget),
          }),
        ]);
      }

      setActiveModal(null);
      await loadDashboard(false);
    } catch (error) {
      console.error("Failed to submit fitness entry:", error);
      setErrorMessage(error?.message || "Unable to save the fitness entry right now.");
    } finally {
      setPendingMode(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#111111] border border-[#2d2d2d] flex items-center justify-center mx-auto">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <div>
            <p className="text-white text-lg font-medium">Loading FitnessOS...</p>
            <p className="text-sm text-[#8f8f8f] mt-1">Preparing the habit, weight, and training dashboard.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="p-6 space-y-6">
        <section className="bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.22),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(139,92,246,0.18),_transparent_35%),#111111] border border-[#2d2d2d] rounded-[28px] p-8 overflow-hidden relative">
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_55%)]" />
          <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.35em] text-[#7dd3fc] font-semibold">FitnessOS</p>
              <h1 className="text-4xl lg:text-5xl font-bold text-white mt-4 leading-tight">
                Build consistency before the rest of the day takes over.
              </h1>
              <p className="text-[#b5b5b5] text-base lg:text-lg mt-4 leading-7">
                Protect the wake-up habit, keep your gym and jiu-jitsu cadence visible, and recover fast when the morning plan slips.
              </p>
              <div className="flex flex-wrap gap-3 mt-6">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.key}
                      type="button"
                      onClick={() => openModal(action.key)}
                      className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#161616] border border-[#2d2d2d] text-white hover:bg-[#1f1f1f] transition-colors"
                    >
                      <Icon className="w-4 h-4" />
                      <span className="font-medium text-sm">{action.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 min-w-[280px] lg:max-w-[360px]">
              <div className="bg-[#0e0e0e]/90 border border-[#2d2d2d] rounded-2xl p-4">
                <p className="text-sm text-[#8f8f8f]">Weekly completion</p>
                <p className="text-4xl font-bold text-white mt-3">{totalCompletion}%</p>
              </div>
              <div className="bg-[#0e0e0e]/90 border border-[#2d2d2d] rounded-2xl p-4">
                <p className="text-sm text-[#8f8f8f]">Best wake streak</p>
                <p className="text-4xl font-bold text-white mt-3">{insights.bestStreak}</p>
              </div>
              <div className="bg-[#0e0e0e]/90 border border-[#2d2d2d] rounded-2xl p-4 col-span-2">
                <p className="text-sm text-[#8f8f8f]">Recovery principle</p>
                <p className="text-lg font-semibold text-white mt-3">
                  Missing the morning should trigger a smarter fallback, not a dead day.
                </p>
              </div>
            </div>
          </div>
        </section>

        {errorMessage ? (
          <div className="bg-[#1a1111] border border-[#4d2222] rounded-2xl px-4 py-3 text-sm text-[#f5bcbc]">
            {errorMessage}
          </div>
        ) : null}

        <FitnessSummaryCards scorecard={scorecard} insights={insights} />
        <FitnessCharts
          wakeTrend={dashboard?.wakeTrend}
          weightTrend={dashboard?.weightTrend}
          trainingTrend={dashboard?.trainingTrend}
        />

        <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
          <div className="bg-[#111111] border border-[#2d2d2d] rounded-2xl p-6">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="text-lg font-semibold text-white">Quick actions</h3>
                <p className="text-sm text-[#8f8f8f] mt-1">
                  Keep the update loop tight so the dashboard stays trustworthy.
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadDashboard(false)}
                className="px-4 py-2 rounded-2xl border border-[#2d2d2d] text-[#a1a1a1] hover:text-white hover:bg-[#181818] transition-colors disabled:opacity-60"
                disabled={refreshing}
              >
                {refreshing ? "Refreshing..." : "Refresh data"}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.key}
                    type="button"
                    onClick={() => openModal(action.key)}
                    className="text-left bg-[#0d0d0d] border border-[#242424] rounded-2xl p-5 hover:border-[#3a3a3a] hover:bg-[#151515] transition-all"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-[#1b1b1b] border border-[#292929] flex items-center justify-center mb-4">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="text-white font-semibold">{action.label}</h4>
                    <p className="text-sm text-[#8f8f8f] mt-2 leading-6">{action.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-[#111111] border border-[#2d2d2d] rounded-2xl p-6">
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-white">Recent session ledger</h3>
              <p className="text-sm text-[#8f8f8f] mt-1">
                The dashboard stays believable when the recent actions are visible.
              </p>
            </div>
            <div className="space-y-3">
              {(dashboard?.recentSessions || []).length > 0 ? (
                dashboard.recentSessions.map((session) => (
                  <div
                    key={session.id}
                    className="bg-[#0d0d0d] border border-[#242424] rounded-2xl px-4 py-3 flex items-start justify-between gap-3"
                  >
                    <div>
                      <p className="text-white font-medium">{session.title}</p>
                      <p className="text-sm text-[#8f8f8f] mt-1">{session.dateLabel}</p>
                      {session.note ? (
                        <p className="text-xs text-[#666666] mt-2 leading-5">{session.note}</p>
                      ) : null}
                    </div>
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                        session.status === "completed"
                          ? "bg-[#0f241d] border-[#1d5c45] text-[#7ee8b7]"
                          : session.status === "missed"
                          ? "bg-[#2b1616] border-[#6b2b2b] text-[#f8b4b4]"
                          : "bg-[#171d2c] border-[#27406d] text-[#93c5fd]"
                      }`}
                    >
                      {session.status.replace(/_/g, " ")}
                    </span>
                  </div>
                ))
              ) : (
                <div className="bg-[#0d0d0d] border border-dashed border-[#2d2d2d] rounded-2xl px-4 py-6 text-sm text-[#8f8f8f]">
                  No session activity yet. Use the quick-update modal to create the first entries and bring the scorecard to life.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <FitnessEntryModal
        isOpen={Boolean(activeModal)}
        mode={activeModal}
        onClose={closeModal}
        onSubmit={handleModalSubmit}
        pending={Boolean(pendingMode)}
        goalDefaults={scorecard}
      />
    </div>
  );
}
