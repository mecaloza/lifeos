import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Scale, ShieldAlert, Target, TimerReset, X } from "lucide-react";

const MODES = {
  wake: {
    label: "Wake-up log",
    description: "Capture the actual time you woke up today.",
    icon: CalendarClock,
  },
  weight: {
    label: "Weight check-in",
    description: "Log today’s weight and a quick note if needed.",
    icon: Scale,
  },
  training: {
    label: "Training update",
    description: "Mark a gym or BJJ session as planned, completed, or missed.",
    icon: ShieldAlert,
  },
  noshow: {
    label: "Morning no-show",
    description: "Confirm the missed morning session and schedule a fallback slot.",
    icon: TimerReset,
  },
  goals: {
    label: "Weekly goals",
    description: "Tune the wake-up, gym, BJJ, and weight targets for this week.",
    icon: Target,
  },
};

const todayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const INITIAL_STATE = {
  date: "",
  actualTime: "05:00",
  weightValue: "",
  sessionType: "gym_strength",
  status: "completed",
  notes: "",
  fallbackStartTime: "18:00",
  durationMinutes: 60,
  wakeTargetDays: 5,
  wakeTargetTime: "05:00",
  gymTarget: 4,
  bjjTarget: 4,
  weightTarget: 5,
};

export default function FitnessEntryModal({
  isOpen,
  mode,
  onClose,
  onSubmit,
  pending = false,
  goalDefaults = [],
}) {
  const [formState, setFormState] = useState(INITIAL_STATE);

  useEffect(() => {
    if (!isOpen) return;
    const wakeGoal = goalDefaults.find((goal) => goal.metricKey === "wake_up");
    const gymGoal = goalDefaults.find((goal) => goal.metricKey === "gym_strength");
    const bjjGoal = goalDefaults.find((goal) => goal.metricKey === "bjj");
    const weightGoal = goalDefaults.find((goal) => goal.metricKey === "weight_checkin");

    setFormState({
      ...INITIAL_STATE,
      date: todayDate(),
      wakeTargetDays: wakeGoal?.target || INITIAL_STATE.wakeTargetDays,
      wakeTargetTime: wakeGoal?.goalTime?.slice?.(0, 5) || INITIAL_STATE.wakeTargetTime,
      gymTarget: gymGoal?.target || INITIAL_STATE.gymTarget,
      bjjTarget: bjjGoal?.target || INITIAL_STATE.bjjTarget,
      weightTarget: weightGoal?.target || INITIAL_STATE.weightTarget,
    });
  }, [goalDefaults, isOpen, mode]);

  const modeConfig = MODES[mode] || MODES.wake;
  const ModeIcon = modeConfig.icon;

  const submitLabel = useMemo(() => {
    if (pending) return "Saving...";
    switch (mode) {
      case "weight":
        return "Save check-in";
      case "training":
        return "Update session";
      case "noshow":
        return "Confirm and schedule fallback";
      case "goals":
        return "Save goals";
      default:
        return "Save wake-up log";
    }
  }, [mode, pending]);

  if (!isOpen) return null;

  const updateField = (field, value) => {
    setFormState((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit(formState, mode);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#111111] border border-[#2d2d2d] rounded-3xl shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-[#242424] flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#1a1a1a] border border-[#2d2d2d] flex items-center justify-center">
              <ModeIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">{modeConfig.label}</h3>
              <p className="text-sm text-[#8f8f8f] mt-1">{modeConfig.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-2xl border border-[#2d2d2d] bg-[#151515] flex items-center justify-center hover:bg-[#1d1d1d] transition-colors"
          >
            <X className="w-5 h-5 text-[#a1a1a1]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-2">
              <span className="text-sm font-medium text-[#d1d1d1]">Date</span>
              <input
                type="date"
                value={formState.date}
                onChange={(event) => updateField("date", event.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#2d2d2d] rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-[#4a4a4a]"
              />
            </label>

            {(mode === "wake" || mode === "noshow") && (
              <label className="space-y-2">
                <span className="text-sm font-medium text-[#d1d1d1]">
                  {mode === "wake" ? "Actual wake-up time" : "Fallback start time"}
                </span>
                <input
                  type="time"
                  value={mode === "wake" ? formState.actualTime : formState.fallbackStartTime}
                  onChange={(event) =>
                    updateField(mode === "wake" ? "actualTime" : "fallbackStartTime", event.target.value)
                  }
                  className="w-full bg-[#0a0a0a] border border-[#2d2d2d] rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-[#4a4a4a]"
                />
              </label>
            )}

            {mode === "weight" && (
              <label className="space-y-2">
                <span className="text-sm font-medium text-[#d1d1d1]">Weight</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={formState.weightValue}
                  onChange={(event) => updateField("weightValue", event.target.value)}
                  placeholder="80.4"
                  className="w-full bg-[#0a0a0a] border border-[#2d2d2d] rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-[#4a4a4a]"
                />
              </label>
            )}

            {(mode === "training" || mode === "noshow") && (
              <label className="space-y-2">
                <span className="text-sm font-medium text-[#d1d1d1]">Session type</span>
                <select
                  value={formState.sessionType}
                  onChange={(event) => updateField("sessionType", event.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2d2d2d] rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-[#4a4a4a]"
                >
                  <option value="gym_strength">Gym strength</option>
                  <option value="bjj">Brazilian jiu-jitsu</option>
                </select>
              </label>
            )}

            {mode === "training" && (
              <label className="space-y-2">
                <span className="text-sm font-medium text-[#d1d1d1]">Status</span>
                <select
                  value={formState.status}
                  onChange={(event) => updateField("status", event.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2d2d2d] rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-[#4a4a4a]"
                >
                  <option value="planned">Planned</option>
                  <option value="completed">Completed</option>
                  <option value="missed">Missed</option>
                </select>
              </label>
            )}

            {mode === "noshow" && (
              <label className="space-y-2">
                <span className="text-sm font-medium text-[#d1d1d1]">Fallback duration (minutes)</span>
                <input
                  type="number"
                  min="15"
                  step="15"
                  value={formState.durationMinutes}
                  onChange={(event) => updateField("durationMinutes", Number(event.target.value || 60))}
                  className="w-full bg-[#0a0a0a] border border-[#2d2d2d] rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-[#4a4a4a]"
                />
              </label>
            )}
          </div>

          {mode === "goals" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[#d1d1d1]">Wake-up days / week</span>
                <input
                  type="number"
                  min="1"
                  max="7"
                  value={formState.wakeTargetDays}
                  onChange={(event) => updateField("wakeTargetDays", Number(event.target.value || 5))}
                  className="w-full bg-[#0a0a0a] border border-[#2d2d2d] rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-[#4a4a4a]"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-[#d1d1d1]">Wake-up target time</span>
                <input
                  type="time"
                  value={formState.wakeTargetTime}
                  onChange={(event) => updateField("wakeTargetTime", event.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2d2d2d] rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-[#4a4a4a]"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-[#d1d1d1]">Gym sessions / week</span>
                <input
                  type="number"
                  min="1"
                  max="14"
                  value={formState.gymTarget}
                  onChange={(event) => updateField("gymTarget", Number(event.target.value || 4))}
                  className="w-full bg-[#0a0a0a] border border-[#2d2d2d] rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-[#4a4a4a]"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-[#d1d1d1]">BJJ sessions / week</span>
                <input
                  type="number"
                  min="1"
                  max="14"
                  value={formState.bjjTarget}
                  onChange={(event) => updateField("bjjTarget", Number(event.target.value || 4))}
                  className="w-full bg-[#0a0a0a] border border-[#2d2d2d] rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-[#4a4a4a]"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-[#d1d1d1]">Weight check-ins / week</span>
                <input
                  type="number"
                  min="1"
                  max="14"
                  value={formState.weightTarget}
                  onChange={(event) => updateField("weightTarget", Number(event.target.value || 5))}
                  className="w-full bg-[#0a0a0a] border border-[#2d2d2d] rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-[#4a4a4a]"
                />
              </label>
            </div>
          )}

          <label className="space-y-2 block">
            <span className="text-sm font-medium text-[#d1d1d1]">Notes</span>
            <textarea
              rows={4}
              value={formState.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              placeholder="Optional context, win conditions, or what went wrong this morning..."
              className="w-full bg-[#0a0a0a] border border-[#2d2d2d] rounded-2xl px-4 py-3 text-white resize-none focus:outline-none focus:border-[#4a4a4a]"
            />
          </label>

          <div className="bg-[#0d1317] border border-[#1f2937] rounded-2xl px-4 py-3 text-sm text-[#9fb3c8]">
            {mode === "goals"
              ? "Goal edits update the scorecard targets instantly across the dashboard and future quick logs."
              : mode === "noshow"
              ? "No-show confirmation should protect the rest of the day by creating or updating one fallback calendar session."
              : "Every quick entry should keep the weekly scorecard fresh without forcing a long form."}
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-2xl border border-[#2d2d2d] text-[#a1a1a1] hover:bg-[#161616] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="px-5 py-3 rounded-2xl bg-white text-black font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
