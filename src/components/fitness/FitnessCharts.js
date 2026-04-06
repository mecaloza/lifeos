import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-[#0f0f0f] border border-[#2d2d2d] rounded-xl px-3 py-2 shadow-xl">
      <p className="text-sm font-medium text-white mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-3 text-xs">
            <span style={{ color: entry.color }}>{entry.name}</span>
            <span className="text-white font-medium">{entry.value ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FitnessCharts({ wakeTrend = [], weightTrend = [], trainingTrend = [] }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <section className="bg-[#111111] border border-[#2d2d2d] rounded-2xl p-6">
        <div className="mb-5">
          <h3 className="text-lg font-semibold text-white">Wake-up consistency</h3>
          <p className="text-sm text-[#8f8f8f] mt-1">
            Track the mornings you protected before the rest of the day got busy.
          </p>
        </div>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={wakeTrend}>
              <defs>
                <linearGradient id="wakeArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1f1f1f" vertical={false} />
              <XAxis dataKey="label" stroke="#666666" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} stroke="#666666" tickLine={false} axisLine={false} domain={[0, 1]} tickFormatter={(value) => (value === 1 ? "Win" : "Miss")} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="successValue" name="Wake-up win" stroke="#10B981" fill="url(#wakeArea)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="bg-[#111111] border border-[#2d2d2d] rounded-2xl p-6">
        <div className="mb-5">
          <h3 className="text-lg font-semibold text-white">Training load</h3>
          <p className="text-sm text-[#8f8f8f] mt-1">
            Compare gym and jiu-jitsu execution across the active week.
          </p>
        </div>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trainingTrend}>
              <CartesianGrid stroke="#1f1f1f" vertical={false} />
              <XAxis dataKey="label" stroke="#666666" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} stroke="#666666" tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="gym" name="Gym" fill="#3B82F6" radius={[8, 8, 0, 0]} />
              <Bar dataKey="bjj" name="BJJ" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="bg-[#111111] border border-[#2d2d2d] rounded-2xl p-6 xl:col-span-2">
        <div className="mb-5">
          <h3 className="text-lg font-semibold text-white">Weight trend</h3>
          <p className="text-sm text-[#8f8f8f] mt-1">
            Keep weight data visible without overcomplicating the logging flow.
          </p>
        </div>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weightTrend}>
              <CartesianGrid stroke="#1f1f1f" vertical={false} />
              <XAxis dataKey="label" stroke="#666666" tickLine={false} axisLine={false} />
              <YAxis stroke="#666666" tickLine={false} axisLine={false} domain={["auto", "auto"]} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="weightValue"
                name="Weight"
                stroke="#F59E0B"
                strokeWidth={3}
                dot={{ stroke: "#F59E0B", strokeWidth: 2, r: 4, fill: "#111111" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
