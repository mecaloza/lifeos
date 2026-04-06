export const FITNESS_GOAL_CONFIG = {
  wake_up: {
    metricKey: "wake_up",
    label: "Wake Up Before 5:00 AM",
    targetCount: 5,
    targetTime: "05:00:00",
    helperText: "Beat the entrepreneur-day chaos before it starts.",
    unitLabel: "days",
    accentColor: "#8B5CF6",
    chartColor: "#8B5CF6",
  },
  gym_strength: {
    metricKey: "gym_strength",
    label: "Gym Strength",
    targetCount: 4,
    helperText: "Strength sessions completed this week.",
    unitLabel: "sessions",
    accentColor: "#3B82F6",
    chartColor: "#3B82F6",
  },
  bjj: {
    metricKey: "bjj",
    label: "Brazilian Jiu-Jitsu",
    targetCount: 4,
    helperText: "Sessions protected and executed.",
    unitLabel: "sessions",
    accentColor: "#10B981",
    chartColor: "#10B981",
  },
  weight_checkin: {
    metricKey: "weight_checkin",
    label: "Weight Check-ins",
    targetCount: 5,
    helperText: "Keep the trend visible with light friction.",
    unitLabel: "logs",
    accentColor: "#F59E0B",
    chartColor: "#F59E0B",
  },
};

export const FITNESS_SESSION_TYPES = ["gym_strength", "bjj"];

export const FITNESS_FALLBACK_OPTIONS = [
  {
    value: "lunch_reset",
    label: "Lunch Reset",
    description: "Move the session to your lunch block.",
    defaultHour: 13,
    defaultMinute: 0,
    durationMinutes: 45,
  },
  {
    value: "after_work_reset",
    label: "After Work Reset",
    description: "Push the session to the end of the workday.",
    defaultHour: 18,
    defaultMinute: 0,
    durationMinutes: 60,
  },
  {
    value: "evening_mobility",
    label: "Evening Mobility",
    description: "Swap the missed session for a lighter evening block.",
    defaultHour: 20,
    defaultMinute: 0,
    durationMinutes: 30,
  },
];

export const FITNESS_STATUS_META = {
  on_track: { label: "On Track", color: "#10B981" },
  behind: { label: "Behind", color: "#F59E0B" },
  goal_met: { label: "Goal Met", color: "#3B82F6" },
};
