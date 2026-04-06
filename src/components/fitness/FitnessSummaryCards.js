import { Activity, CalendarClock, Scale, ShieldCheck, Target, TrendingUp } from "lucide-react";

const ICONS = {
  wake_up: CalendarClock,
  gym_strength: Activity,
  bjj: ShieldCheck,
  weight_checkin: Scale,
};

const COLORS = {
  wake_up: "#10B981",
  gym_strength: "#3B82F6",
  bjj: "#8B5CF6",
  weight_checkin: "#F59E0B",
};

function formatProgress(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function defaultInsight(insights, scorecard) {
  const totalCurrent = scorecard.reduce((sum, item) => sum + (item.current || 0), 0);
  const totalTarget = scorecard.reduce((sum, item) => sum + (item.target || 0), 0);

  return {
    headline: insights?.headline || "Consistency focus",
    body:
      insights?.body ||
      "Protect the morning window first. When the wake-up habit stays on track, the rest of the training plan becomes easier to defend.",
    weeklyCompletion:
      insights?.weeklyCompletion ?? (totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0),
    bestStreak: insights?.bestStreak ?? 0,
    weeklyMomentum: insights?.weeklyMomentum ?? 0,
  };
}

export default function FitnessSummaryCards({ scorecard = [], insights = {} }) {
  const resolvedInsight = defaultInsight(insights, scorecard);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {scorecard.map((item) => {
          const Icon = ICONS[item.key] || Target;
          const color = item.color || COLORS[item.key] || "#10B981";
          const progress = formatProgress((item.current / Math.max(item.target || 1, 1)) * 100);

          return (
            <div
              key={item.key}
              className="bg-[#111111] border border-[#2d2d2d] rounded-2xl p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-[#8f8f8f] font-medium">{item.label}</p>
                  <div className="flex items-end gap-2 mt-3">
                    <span className="text-4xl font-bold text-white leading-none">
                      {item.current ?? 0}
                    </span>
                    <span className="text-sm text-[#8f8f8f] pb-1">/ {item.target ?? 0}</span>
                  </div>
                  {item.helperText ? (
                    <p className="text-xs text-[#666666] mt-2">{item.helperText}</p>
                  ) : null}
                </div>
                <div
                  className="w-12 h-12 rounded-2xl border flex items-center justify-center"
                  style={{
                    backgroundColor: `${color}18`,
                    borderColor: `${color}55`,
                  }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-xs text-[#8f8f8f] mb-2">
                  <span>Weekly progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.9fr] gap-4">
        <div className="bg-[#111111] border border-[#2d2d2d] rounded-2xl p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[#8f8f8f]">Weekly momentum</p>
              <h3 className="text-2xl font-semibold text-white mt-2">
                {resolvedInsight.headline}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl border border-[#264653] bg-[#0f1820] flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[#7DD3FC]" />
            </div>
          </div>
          <p className="text-sm text-[#a1a1a1] leading-6 mt-4">
            {resolvedInsight.body}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#111111] border border-[#2d2d2d] rounded-2xl p-5">
            <p className="text-sm text-[#8f8f8f]">Completion</p>
            <p className="text-3xl font-bold text-white mt-3">
              {resolvedInsight.weeklyCompletion}%
            </p>
            <p className="text-xs text-[#666666] mt-2">All scorecard targets combined</p>
          </div>
          <div className="bg-[#111111] border border-[#2d2d2d] rounded-2xl p-5">
            <p className="text-sm text-[#8f8f8f]">Best streak</p>
            <p className="text-3xl font-bold text-white mt-3">
              {resolvedInsight.bestStreak}
            </p>
            <p className="text-xs text-[#666666] mt-2">Wake-up wins in a row</p>
          </div>
          <div className="bg-[#111111] border border-[#2d2d2d] rounded-2xl p-5 col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-[#8f8f8f]">Momentum delta</p>
                <p className="text-3xl font-bold text-white mt-3">
                  {resolvedInsight.weeklyMomentum > 0 ? "+" : ""}
                  {resolvedInsight.weeklyMomentum}
                </p>
              </div>
              <div className="text-right text-xs text-[#666666] max-w-[170px]">
                Compare this week’s pace against the previous week once data starts building.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
