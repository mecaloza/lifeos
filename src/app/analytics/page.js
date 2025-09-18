"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";
import {
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Target,
  Calendar,
  Tag as TagIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AnalyticsPage() {
  const [tasks, setTasks] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [statusHistory, setStatusHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("week"); // week, month, all

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);

      // Fetch tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

      // Fetch tags
      const { data: tagsData, error: tagsError } = await supabase
        .from("tags")
        .select("*");

      // Fetch status history
      const { data: historyData, error: historyError } = await supabase
        .from("task_status_history")
        .select(
          `
          *,
          tasks (
            title,
            tags,
            created_at
          )
        `
        )
        .order("changed_at", { ascending: false });

      if (tasksError) console.error("Error fetching tasks:", tasksError);
      if (tagsError) console.error("Error fetching tags:", tagsError);
      if (historyError) console.error("Error fetching history:", historyError);

      setTasks(tasksData || []);
      setAvailableTags(tagsData || []);
      setStatusHistory(historyData || []);
    } catch (error) {
      console.error("Error fetching analytics data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate metrics
  const getStatusDistribution = () => {
    const statusCounts = {};
    const statuses = [
      { id: "backlog", name: "Backlog", color: "#666666" },
      { id: "todo", name: "To Do", color: "#3B82F6" },
      { id: "in_progress", name: "In Progress", color: "#F59E0B" },
      { id: "waiting", name: "Waiting", color: "#8B5CF6" },
      { id: "done", name: "Done", color: "#10B981" },
    ];

    statuses.forEach((status) => {
      statusCounts[status.id] = tasks.filter(
        (task) => task.status === status.id
      ).length;
    });

    return statuses.map((status) => ({
      name: status.name,
      value: statusCounts[status.id],
      color: status.color,
    }));
  };

  const getTasksByTag = () => {
    const tagCounts = {};

    tasks.forEach((task) => {
      if (task.tags && task.tags.length > 0) {
        task.tags.forEach((tagName) => {
          if (!tagCounts[tagName]) {
            tagCounts[tagName] = {
              total: 0,
              completed: 0,
              in_progress: 0,
              todo: 0,
              waiting: 0,
              backlog: 0,
            };
          }
          tagCounts[tagName].total++;
          tagCounts[tagName][task.status]++;
        });
      }
    });

    return Object.entries(tagCounts).map(([tagName, counts]) => {
      const tagInfo = availableTags.find((tag) => tag.name === tagName);
      return {
        tag: tagName,
        color: tagInfo?.color || "#666666",
        ...counts,
      };
    });
  };

  const getWeeklyProgress = () => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const thisWeekTasks = tasks.filter(
      (task) => new Date(task.created_at) >= weekAgo
    );

    const dailyData = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      dailyData[dateStr] = {
        date: date.toLocaleDateString("en-US", { weekday: "short" }),
        created: 0,
        completed: 0,
      };
    }

    thisWeekTasks.forEach((task) => {
      const createdDate = new Date(task.created_at).toISOString().split("T")[0];
      if (dailyData[createdDate]) {
        dailyData[createdDate].created++;
        if (task.status === "done") {
          dailyData[createdDate].completed++;
        }
      }
    });

    return Object.values(dailyData);
  };

  const getAverageTimeInStatus = () => {
    const statusDurations = {};

    statusHistory.forEach((entry) => {
      if (entry.duration_in_previous_status && entry.from_status) {
        if (!statusDurations[entry.from_status]) {
          statusDurations[entry.from_status] = [];
        }
        // Convert PostgreSQL interval to hours
        const duration = parseInterval(entry.duration_in_previous_status);
        statusDurations[entry.from_status].push(duration);
      }
    });

    return Object.entries(statusDurations).map(([status, durations]) => ({
      status: status.replace("_", " ").toUpperCase(),
      averageHours:
        Math.round(
          (durations.reduce((a, b) => a + b, 0) / durations.length) * 10
        ) / 10,
      count: durations.length,
    }));
  };

  const parseInterval = (interval) => {
    // Simple parser for PostgreSQL interval (assumes format like "2 days 03:45:12")
    const regex = /(\d+)\s*days?\s*(\d{2}):(\d{2}):(\d{2})/;
    const match = interval.match(regex);
    if (match) {
      const days = parseInt(match[1]) || 0;
      const hours = parseInt(match[2]) || 0;
      const minutes = parseInt(match[3]) || 0;
      return days * 24 + hours + minutes / 60;
    }
    return 0;
  };

  const getTotalMetrics = () => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "done").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const waiting = tasks.filter((t) => t.status === "waiting").length;

    return {
      total,
      completed,
      inProgress,
      waiting,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-2 border-[#a1a1a1] border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-white text-lg font-medium">Loading Analytics...</p>
        </div>
      </div>
    );
  }

  const statusData = getStatusDistribution();
  const tagData = getTasksByTag();
  const weeklyData = getWeeklyProgress();
  const durationData = getAverageTimeInStatus();
  const metrics = getTotalMetrics();

  return (
    <div className="min-h-screen bg-black">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">
              Analytics Dashboard
            </h1>
            <p className="text-[#a1a1a1] mt-1 text-base">
              Track your productivity and task flow metrics
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 bg-[#1a1a1a] border border-[#2d2d2d] text-white rounded-lg focus:border-[#3a3a3a] focus:outline-none"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#3B82F6]/20 rounded-lg">
                <Target className="w-5 h-5 text-[#3B82F6]" />
              </div>
              <div>
                <p className="text-[#a1a1a1] text-sm">Total Tasks</p>
                <p className="text-white text-2xl font-bold">{metrics.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#10B981]/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-[#10B981]" />
              </div>
              <div>
                <p className="text-[#a1a1a1] text-sm">Completed</p>
                <p className="text-white text-2xl font-bold">
                  {metrics.completed}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#F59E0B]/20 rounded-lg">
                <Clock className="w-5 h-5 text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-[#a1a1a1] text-sm">In Progress</p>
                <p className="text-white text-2xl font-bold">
                  {metrics.inProgress}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#8B5CF6]/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-[#8B5CF6]" />
              </div>
              <div>
                <p className="text-[#a1a1a1] text-sm">Waiting</p>
                <p className="text-white text-2xl font-bold">
                  {metrics.waiting}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#10B981]/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-[#10B981]" />
              </div>
              <div>
                <p className="text-[#a1a1a1] text-sm">Completion Rate</p>
                <p className="text-white text-2xl font-bold">
                  {metrics.completionRate}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Distribution Chart */}
          <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
            <h3 className="text-white font-semibold text-lg mb-4">
              Task Status Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #2d2d2d",
                    borderRadius: "8px",
                    color: "white",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {statusData.map((item) => (
                <div key={item.name} className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="text-[#a1a1a1] text-sm">
                    {item.name}: {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Progress Chart */}
          <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
            <h3 className="text-white font-semibold text-lg mb-4">
              Weekly Progress
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d2d" />
                <XAxis dataKey="date" stroke="#a1a1a1" fontSize={12} />
                <YAxis stroke="#a1a1a1" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #2d2d2d",
                    borderRadius: "8px",
                    color: "white",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="created"
                  stackId="1"
                  stroke="#3B82F6"
                  fill="#3B82F6"
                  fillOpacity={0.3}
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  stackId="2"
                  stroke="#10B981"
                  fill="#10B981"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center space-x-4 mt-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-[#3B82F6] rounded-full"></div>
                <span className="text-[#a1a1a1] text-sm">Created</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-[#10B981] rounded-full"></div>
                <span className="text-[#a1a1a1] text-sm">Completed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tags Analytics & Flow Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tasks by Tag */}
          <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
            <h3 className="text-white font-semibold text-lg mb-4">
              Tasks by Tag
            </h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {tagData.map((item) => (
                <div
                  key={item.tag}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="text-white font-medium">{item.tag}</span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="text-center">
                      <div className="text-[#3B82F6] font-medium">
                        {item.todo}
                      </div>
                      <div className="text-[#666666] text-xs">To Do</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[#F59E0B] font-medium">
                        {item.in_progress}
                      </div>
                      <div className="text-[#666666] text-xs">Progress</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[#10B981] font-medium">
                        {item.completed || item.done}
                      </div>
                      <div className="text-[#666666] text-xs">Done</div>
                    </div>
                    <div className="text-center">
                      <div className="text-white font-bold">{item.total}</div>
                      <div className="text-[#666666] text-xs">Total</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Average Time in Status */}
          <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
            <h3 className="text-white font-semibold text-lg mb-4">
              Average Time in Status
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={durationData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d2d" />
                <XAxis
                  type="number"
                  stroke="#a1a1a1"
                  fontSize={12}
                  label={{
                    value: "Hours",
                    position: "insideBottom",
                    offset: -5,
                    style: { textAnchor: "middle", fill: "#a1a1a1" },
                  }}
                />
                <YAxis
                  type="category"
                  dataKey="status"
                  stroke="#a1a1a1"
                  fontSize={12}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #2d2d2d",
                    borderRadius: "8px",
                    color: "white",
                  }}
                />
                <Bar
                  dataKey="averageHours"
                  fill="#8B5CF6"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* This Week's Tasks by Tag & Status */}
        <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
          <h3 className="text-white font-semibold text-lg mb-4">
            This Week's Tasks by Tag & Status
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {["todo", "in_progress", "waiting", "done"].map((status) => {
              const statusName = status.replace("_", " ").toUpperCase();
              const statusColor = {
                todo: "#3B82F6",
                in_progress: "#F59E0B",
                waiting: "#8B5CF6",
                done: "#10B981",
              }[status];

              const weekAgo = new Date();
              weekAgo.setDate(weekAgo.getDate() - 7);

              const thisWeekTasksInStatus = tasks.filter(
                (task) =>
                  task.status === status && new Date(task.created_at) >= weekAgo
              );

              const tagBreakdown = {};
              thisWeekTasksInStatus.forEach((task) => {
                if (task.tags && task.tags.length > 0) {
                  task.tags.forEach((tagName) => {
                    tagBreakdown[tagName] = (tagBreakdown[tagName] || 0) + 1;
                  });
                } else {
                  tagBreakdown["No Tag"] = (tagBreakdown["No Tag"] || 0) + 1;
                }
              });

              return (
                <div
                  key={status}
                  className="bg-[#0a0a0a] border border-[#2d2d2d] rounded-lg p-4"
                >
                  <div className="flex items-center space-x-2 mb-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: statusColor }}
                    ></div>
                    <h4 className="text-white font-medium text-sm">
                      {statusName}
                    </h4>
                    <span className="text-[#a1a1a1] text-xs">
                      ({thisWeekTasksInStatus.length})
                    </span>
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {Object.entries(tagBreakdown).map(([tagName, count]) => {
                      const tagInfo = availableTags.find(
                        (tag) => tag.name === tagName
                      );
                      const tagColor = tagInfo?.color || "#666666";
                      return (
                        <div
                          key={tagName}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: tagColor }}
                            ></div>
                            <span className="text-[#a1a1a1] text-xs">
                              {tagName}
                            </span>
                          </div>
                          <span className="text-white text-xs font-medium">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                    {Object.keys(tagBreakdown).length === 0 && (
                      <p className="text-[#666666] text-xs">
                        No tasks this week
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Task Flow & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Task Flow Funnel */}
          <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
            <h3 className="text-white font-semibold text-lg mb-4">
              Task Flow Funnel
            </h3>
            <div className="space-y-4">
              {[
                {
                  status: "backlog",
                  name: "Backlog",
                  color: "#666666",
                  count: tasks.filter((t) => t.status === "backlog").length,
                },
                {
                  status: "todo",
                  name: "To Do",
                  color: "#3B82F6",
                  count: tasks.filter((t) => t.status === "todo").length,
                },
                {
                  status: "in_progress",
                  name: "In Progress",
                  color: "#F59E0B",
                  count: tasks.filter((t) => t.status === "in_progress").length,
                },
                {
                  status: "waiting",
                  name: "Waiting",
                  color: "#8B5CF6",
                  count: tasks.filter((t) => t.status === "waiting").length,
                },
                {
                  status: "done",
                  name: "Done",
                  color: "#10B981",
                  count: tasks.filter((t) => t.status === "done").length,
                },
              ].map((stage, index) => {
                const percentage =
                  tasks.length > 0 ? (stage.count / tasks.length) * 100 : 0;
                return (
                  <div key={stage.status} className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        ></div>
                        <span className="text-white text-sm font-medium">
                          {stage.name}
                        </span>
                      </div>
                      <span className="text-[#a1a1a1] text-sm">
                        {stage.count} tasks
                      </span>
                    </div>
                    <div className="w-full bg-[#0a0a0a] rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{
                          backgroundColor: stage.color,
                          width: `${percentage}%`,
                          opacity: 0.8,
                        }}
                      ></div>
                    </div>
                    <div className="text-right text-[#666666] text-xs mt-1">
                      {Math.round(percentage)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
            <h3 className="text-white font-semibold text-lg mb-4">
              Recent Status Changes
            </h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {statusHistory.slice(0, 15).map((entry) => {
                const getStatusColor = (status) => {
                  const colors = {
                    backlog: "#666666",
                    todo: "#3B82F6",
                    in_progress: "#F59E0B",
                    waiting: "#8B5CF6",
                    done: "#10B981",
                  };
                  return colors[status] || "#666666";
                };

                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between py-2 border-b border-[#2d2d2d]/50 last:border-b-0"
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: getStatusColor(entry.to_status),
                        }}
                      ></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium text-sm truncate">
                          {entry.tasks?.title || "Unknown Task"}
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-[#666666]">
                          {entry.from_status && (
                            <>
                              <span>{entry.from_status.replace("_", " ")}</span>
                              <span>→</span>
                            </>
                          )}
                          <span
                            style={{ color: getStatusColor(entry.to_status) }}
                            className="font-medium"
                          >
                            {entry.to_status.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-[#666666] text-xs text-right">
                      <div>
                        {new Date(entry.changed_at).toLocaleDateString()}
                      </div>
                      <div>
                        {new Date(entry.changed_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
              {statusHistory.length === 0 && (
                <div className="text-center py-8 text-[#666666]">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>
                    No status changes yet. Move some tasks in the Kanban board!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
