"use client";

import { useState, useEffect } from "react";
import { Plus, X, Tag, Trash2, Clock, Loader, History, Mail, Eye, EyeOff, Palette, Users, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

const TAG_COLORS = [
  "#EF4444", "#F97316", "#F59E0B", "#84CC16", "#10B981",
  "#06B6D4", "#3B82F6", "#8B5CF6", "#EC4899", "#6B7280",
];

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [showNewTask, setShowNewTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    tags: [],
    duration_minutes: 60,
    start_time: null,
    priority: "medium",
  });
  const [selectedTagId, setSelectedTagId] = useState("");
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3B82F6");
  const [savingTag, setSavingTag] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [selectedTaskForTimeline, setSelectedTaskForTimeline] = useState(null);
  const [taskTimeline, setTaskTimeline] = useState([]);
  const [showIntegratedTasks, setShowIntegratedTasks] = useState(false);
  const [showDelegatedTasks, setShowDelegatedTasks] = useState(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  // Fetch tasks and tags from Supabase on mount
  useEffect(() => {
    fetchTasks();
    fetchAvailableTags();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching tasks:", error);
        // Fallback to localStorage if Supabase fails
        const savedTasks = localStorage.getItem("tasks");
        if (savedTasks) {
          setTasks(JSON.parse(savedTasks));
        }
      } else {
        setTasks(data || []);
        // Also save to localStorage as backup
        localStorage.setItem("tasks", JSON.stringify(data || []));
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableTags = async () => {
    try {
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching tags:", error);
        // Fallback to some default tags if database fails
        setAvailableTags([
          { id: 1, name: "Work", color: "#EF4444" },
          { id: 2, name: "Personal", color: "#10B981" },
          { id: 3, name: "Urgent", color: "#F59E0B" },
          { id: 4, name: "Project", color: "#3B82F6" },
        ]);
      } else {
        setAvailableTags(data || []);
      }
    } catch (error) {
      console.error("Error fetching tags:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) return;

    setSaving(true);
    try {
      const newTask = {
        title: formData.title,
        description: formData.description,
        tags: formData.tags,
        status: "backlog",
        completed: false,
      };

      // Try to save to Supabase
      const { data, error } = await supabase
        .from("tasks")
        .insert([newTask])
        .select()
        .single();

      if (error) {
        console.error("Error saving to Supabase:", error);
        // Fallback to localStorage if Supabase fails
        const localTask = { ...newTask, id: Date.now() };
        const updatedTasks = [localTask, ...tasks];
        setTasks(updatedTasks);
        localStorage.setItem("tasks", JSON.stringify(updatedTasks));
      } else {
        setTasks([data, ...tasks]);
        // Also update localStorage
        localStorage.setItem("tasks", JSON.stringify([data, ...tasks]));
      }

      setFormData({
        title: "",
        description: "",
        tags: [],
        duration_minutes: 60,
        start_time: null,
        priority: "medium",
      });
      setSelectedTagId("");
      setShowNewTask(false);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setSaving(false);
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tag) => tag !== tagToRemove),
    });
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    setSavingTag(true);
    try {
      const { data, error } = await supabase
        .from("tags")
        .insert([{ name: newTagName.trim(), color: newTagColor }])
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          alert("A tag with this name already exists!");
        } else {
          console.error("Error creating tag:", error);
        }
      } else {
        // Add the new tag to availableTags
        setAvailableTags([...availableTags, data].sort((a, b) => a.name.localeCompare(b.name)));
        // Also add it to the current task
        setFormData({
          ...formData,
          tags: [...formData.tags, data.name],
        });
        // Reset the form
        setNewTagName("");
        setNewTagColor("#3B82F6");
        setShowCreateTag(false);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setSavingTag(false);
    }
  };

  const startEditingTask = (task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || "",
      tags: task.tags || [],
      duration_minutes: task.duration_minutes || 60,
      start_time: task.start_time,
      priority: task.priority || "medium",
    });
    setShowNewTask(false);
  };

  const handleUpdateTask = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) return;

    setSaving(true);
    try {
      const updatedTask = {
        title: formData.title,
        description: formData.description,
        tags: formData.tags,
        status: editingTask.status || "backlog",
      };

      // Try to update in Supabase
      const { data, error } = await supabase
        .from("tasks")
        .update(updatedTask)
        .eq("id", editingTask.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating task in Supabase:", error);
        // Fallback to localStorage if Supabase fails
        const updatedTasks = tasks.map((task) =>
          task.id === editingTask.id ? { ...task, ...updatedTask } : task
        );
        setTasks(updatedTasks);
        localStorage.setItem("tasks", JSON.stringify(updatedTasks));
      } else {
        const updatedTasks = tasks.map((task) =>
          task.id === editingTask.id ? data : task
        );
        setTasks(updatedTasks);
        localStorage.setItem("tasks", JSON.stringify(updatedTasks));
      }

      setFormData({
        title: "",
        description: "",
        tags: [],
        duration_minutes: 60,
        start_time: null,
        priority: "medium",
      });
      setSelectedTagId("");
      setEditingTask(null);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async (id) => {
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", id);

      if (error) {
        console.error("Error deleting from Supabase:", error);
      }

      // Update local state regardless
      const updatedTasks = tasks.filter((task) => task.id !== id);
      setTasks(updatedTasks);
      localStorage.setItem("tasks", JSON.stringify(updatedTasks));
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const toggleComplete = async (id) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const updatedCompleted = !task.completed;

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ completed: updatedCompleted })
        .eq("id", id);

      if (error) {
        console.error("Error updating Supabase:", error);
      }

      // Update local state regardless
      const updatedTasks = tasks.map((task) =>
        task.id === id ? { ...task, completed: updatedCompleted } : task
      );
      setTasks(updatedTasks);
      localStorage.setItem("tasks", JSON.stringify(updatedTasks));
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // Get all unique tags from all tasks
  const allTags = [...new Set(tasks.flatMap((task) => task.tags || []))];

  // Filter tasks - hide integrated, delegated, completed, and grouped child tasks by default
  const filteredTasks = tasks.filter((task) => {
    // Hide child tasks that belong to a group
    if (task.parent_task_id) {
      return false;
    }
    // Hide completed tasks unless toggled
    if (!showCompletedTasks && task.completed) {
      return false;
    }
    // Hide integrated tasks unless toggled
    const isIntegrated = task.source && task.source !== "manual";
    if (!showIntegratedTasks && isIntegrated) {
      return false;
    }
    // Hide delegated tasks unless toggled
    if (!showDelegatedTasks && task.is_delegated) {
      return false;
    }
    return true;
  });

  // Count integrated tasks
  const integratedTasksCount = tasks.filter(
    (task) => task.source && task.source !== "manual"
  ).length;

  // Count delegated tasks
  const delegatedTasksCount = tasks.filter((task) => task.is_delegated).length;

  // Count completed tasks
  const completedTasksCount = tasks.filter((task) => task.completed).length;

  const showTaskTimeline = async (task) => {
    try {
      setSelectedTaskForTimeline(task);

      // Fetch complete timeline for this task
      const { data, error } = await supabase
        .from("task_status_history")
        .select("*")
        .eq("task_id", task.id)
        .order("changed_at", { ascending: true });

      if (error) {
        console.error("Error fetching task timeline:", error);
        setTaskTimeline([]);
      } else {
        setTaskTimeline(data || []);
      }

      setShowTimeline(true);
    } catch (error) {
      console.error("Error:", error);
      setTaskTimeline([]);
      setShowTimeline(true);
    }
  };

  const closeTimeline = () => {
    setShowTimeline(false);
    setSelectedTaskForTimeline(null);
    setTaskTimeline([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg flex items-center justify-center mx-auto mb-4">
            <Loader className="w-8 h-8 animate-spin text-[#a1a1a1]" />
          </div>
          <p className="text-white text-lg font-medium">
            Loading your tasks...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Tasks</h1>
            <p className="text-[#a1a1a1] mt-1 text-base">
              Manage your workflow with intelligent tagging
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {/* Toggle for completed tasks */}
            {completedTasksCount > 0 && (
              <button
                onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                className={`flex items-center space-x-2 px-4 py-2 border rounded-lg transition-all duration-200 font-medium ${
                  showCompletedTasks
                    ? "bg-green-500/20 border-green-500/50 text-green-400"
                    : "bg-[#1e1e1e] border-[#2d2d2d] text-[#a1a1a1] hover:bg-[#2a2a2a] hover:border-[#3a3a3a]"
                }`}
                title={showCompletedTasks ? "Hide completed tasks" : "Show completed tasks"}
              >
                {showCompletedTasks ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Done ({completedTasksCount})</span>
              </button>
            )}

            {/* Toggle for delegated tasks */}
            {delegatedTasksCount > 0 && (
              <button
                onClick={() => setShowDelegatedTasks(!showDelegatedTasks)}
                className={`flex items-center space-x-2 px-4 py-2 border rounded-lg transition-all duration-200 font-medium ${
                  showDelegatedTasks
                    ? "bg-purple-500/20 border-purple-500/50 text-purple-400"
                    : "bg-[#1e1e1e] border-[#2d2d2d] text-[#a1a1a1] hover:bg-[#2a2a2a] hover:border-[#3a3a3a]"
                }`}
                title={showDelegatedTasks ? "Hide delegated tasks" : "Show delegated tasks"}
              >
                {showDelegatedTasks ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
                <Users className="w-4 h-4" />
                <span className="text-sm">Delegated ({delegatedTasksCount})</span>
              </button>
            )}

            {/* Toggle for integrated tasks */}
            <button
              onClick={() => setShowIntegratedTasks(!showIntegratedTasks)}
              className={`flex items-center space-x-2 px-4 py-2 border rounded-lg transition-all duration-200 font-medium ${
                showIntegratedTasks
                  ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                  : "bg-[#1e1e1e] border-[#2d2d2d] text-[#a1a1a1] hover:bg-[#2a2a2a] hover:border-[#3a3a3a]"
              }`}
              title={showIntegratedTasks ? "Hide calendar events" : "Show calendar events"}
            >
              {showIntegratedTasks ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
              <Mail className="w-4 h-4" />
              <span className="text-sm">{showIntegratedTasks ? "Synced" : "Synced"}</span>
            </button>
            
            <button
              onClick={() => {
                setShowNewTask(true);
                setEditingTask(null);
                setFormData({ title: "", description: "", tags: [] });
                setSelectedTagId("");
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-[#1e1e1e] border border-[#2d2d2d] text-white rounded-lg hover:bg-[#2a2a2a] hover:border-[#3a3a3a] transition-all duration-200 font-medium"
            >
              <Plus className="w-5 h-5" />
              <span>New Task</span>
            </button>
          </div>
        </div>

        {/* Task Creation/Edit Form */}
        {(showNewTask || editingTask) && (
          <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">
                {editingTask ? "Edit Task" : "Create New Task"}
              </h2>
              <button
                onClick={() => {
                  setShowNewTask(false);
                  setEditingTask(null);
                  setFormData({ title: "", description: "", tags: [] });
                  setSelectedTagId("");
                }}
                className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#a1a1a1] hover:text-white" />
              </button>
            </div>

            <form
              onSubmit={editingTask ? handleUpdateTask : handleSubmit}
              className="space-y-4"
            >
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-[#a1a1a1] mb-2">
                  Task Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[#2d2d2d] bg-[#0a0a0a] text-white placeholder-[#666666] focus:border-[#3a3a3a] focus:outline-none transition-colors duration-200"
                  placeholder="What needs to be done?"
                  required
                  disabled={saving}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-[#a1a1a1] mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[#2d2d2d] bg-[#0a0a0a] text-white placeholder-[#666666] focus:border-[#3a3a3a] focus:outline-none transition-colors duration-200 resize-none"
                  placeholder="Add more details..."
                  rows="3"
                  disabled={saving}
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-[#a1a1a1] mb-2">
                  Tags
                </label>
                <div className="flex space-x-2 mb-3">
                  <select
                    value={selectedTagId}
                    onChange={(e) => {
                      const tagId = e.target.value;
                      if (tagId && availableTags.length > 0) {
                        const selectedTag = availableTags.find(
                          (tag) => tag.id.toString() === tagId
                        );
                        if (
                          selectedTag &&
                          !formData.tags.includes(selectedTag.name)
                        ) {
                          setFormData({
                            ...formData,
                            tags: [...formData.tags, selectedTag.name],
                          });
                        }
                      }
                      setSelectedTagId("");
                    }}
                    className="flex-1 px-3 py-2 rounded-lg border border-[#2d2d2d] bg-[#0a0a0a] text-white focus:border-[#3a3a3a] focus:outline-none transition-colors duration-200"
                    disabled={saving}
                  >
                    <option value="" className="bg-[#0a0a0a] text-[#666666]">
                      Select a tag to add...
                    </option>
                    {availableTags.map((tag) => (
                      <option
                        key={tag.id}
                        value={tag.id}
                        disabled={formData.tags.includes(tag.name)}
                        className="bg-[#0a0a0a] text-white disabled:text-[#666666]"
                      >
                        {tag.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowCreateTag(!showCreateTag)}
                    className={`px-3 py-2 rounded-lg border transition-all duration-200 flex items-center space-x-1 ${
                      showCreateTag
                        ? "bg-[#8B5CF6]/20 border-[#8B5CF6]/50 text-[#8B5CF6]"
                        : "border-[#2d2d2d] bg-[#0a0a0a] text-[#a1a1a1] hover:bg-[#1a1a1a] hover:border-[#3a3a3a] hover:text-white"
                    }`}
                    disabled={saving}
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm">New</span>
                  </button>
                </div>

                {/* Create New Tag Form */}
                {showCreateTag && (
                  <div className="mb-4 p-4 bg-[#0a0a0a] border border-[#2d2d2d] rounded-lg space-y-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="Tag name..."
                        className="flex-1 px-3 py-2 rounded-lg border border-[#2d2d2d] bg-[#1a1a1a] text-white placeholder-[#666666] focus:border-[#3a3a3a] focus:outline-none text-sm"
                        disabled={savingTag}
                      />
                      <div
                        className="w-8 h-8 rounded-lg border border-[#3a3a3a] cursor-pointer"
                        style={{ backgroundColor: newTagColor }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {TAG_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewTagColor(color)}
                          className={`w-6 h-6 rounded-md transition-all duration-150 ${
                            newTagColor === color
                              ? "ring-2 ring-white ring-offset-1 ring-offset-[#0a0a0a] scale-110"
                              : "hover:scale-110"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <span
                        className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium"
                        style={{
                          backgroundColor: `${newTagColor}25`,
                          color: newTagColor,
                          border: `1px solid ${newTagColor}50`,
                        }}
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {newTagName || "Preview"}
                      </span>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateTag(false);
                            setNewTagName("");
                            setNewTagColor("#3B82F6");
                          }}
                          className="px-3 py-1.5 text-sm text-[#a1a1a1] hover:text-white transition-colors"
                          disabled={savingTag}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateTag}
                          disabled={savingTag || !newTagName.trim()}
                          className="px-3 py-1.5 text-sm bg-[#8B5CF6] text-white rounded-lg hover:bg-[#7C3AED] transition-colors disabled:opacity-50 flex items-center space-x-1"
                        >
                          {savingTag ? (
                            <Loader className="w-3 h-3 animate-spin" />
                          ) : (
                            <Plus className="w-3 h-3" />
                          )}
                          <span>Create</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Display current tags */}
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {formData.tags.map((tagName, index) => {
                      const tagInfo = availableTags.find(
                        (t) => t.name === tagName
                      );
                      const bgColor = tagInfo?.color
                        ? `${tagInfo.color}30`
                        : "#8B5CF630";
                      const textColor = tagInfo?.color || "#8B5CF6";
                      return (
                        <span
                          key={index}
                          className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm"
                          style={{
                            backgroundColor: bgColor,
                            color: textColor,
                            border: `1px solid ${textColor}60`,
                          }}
                        >
                          <Tag className="w-4 h-4 mr-2" />
                          {tagName}
                          <button
                            type="button"
                            onClick={() => removeTag(tagName)}
                            className="ml-2 opacity-70 hover:opacity-100 p-1 rounded-full hover:bg-black/20 transition-all"
                            disabled={saving}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-[#a1a1a1] mb-2">
                  Priority
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    {
                      value: "urgent",
                      label: "Urgent",
                      color: "#EF4444",
                      emoji: "🔴",
                    },
                    {
                      value: "high",
                      label: "High",
                      color: "#F59E0B",
                      emoji: "🟠",
                    },
                    {
                      value: "medium",
                      label: "Medium",
                      color: "#3B82F6",
                      emoji: "🔵",
                    },
                    {
                      value: "low",
                      label: "Low",
                      color: "#6B7280",
                      emoji: "⚪",
                    },
                  ].map((priority) => (
                    <button
                      key={priority.value}
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, priority: priority.value })
                      }
                      className={`flex items-center justify-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                        formData.priority === priority.value
                          ? "border-current text-white"
                          : "border-[#2d2d2d] text-[#a1a1a1] hover:border-[#3a3a3a] hover:text-white"
                      }`}
                      style={{
                        backgroundColor:
                          formData.priority === priority.value
                            ? `${priority.color}20`
                            : "transparent",
                        color:
                          formData.priority === priority.value
                            ? priority.color
                            : undefined,
                      }}
                    >
                      <span>{priority.emoji}</span>
                      <span>{priority.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewTask(false);
                    setFormData({ title: "", description: "", tags: [] });
                    setSelectedTagId("");
                  }}
                  className="px-4 py-2 text-[#a1a1a1] hover:bg-[#2a2a2a] border border-[#2d2d2d] rounded-lg transition-all duration-200 font-medium"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#1e1e1e] border border-[#2d2d2d] text-white rounded-lg hover:bg-[#2a2a2a] hover:border-[#3a3a3a] transition-all duration-200 flex items-center space-x-2 font-medium"
                  disabled={saving}
                >
                  {saving && <Loader className="w-4 h-4 animate-spin" />}
                  <span>
                    {saving
                      ? editingTask
                        ? "Updating..."
                        : "Creating..."
                      : editingTask
                      ? "Update Task"
                      : "Create Task"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tasks List */}
        <div className="space-y-4">
          {/* Info banner when integrated tasks are hidden */}
        

          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg">
              <div className="w-12 h-12 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg flex items-center justify-center mx-auto mb-4">
                <Plus className="w-6 h-6 text-[#a1a1a1]" />
              </div>
              <p className="text-white text-base font-medium">
                {tasks.length === 0 ? "No tasks yet" : "No manual tasks"}
              </p>
              <p className="text-[#666666] text-sm mt-1">
                {tasks.length === 0
                  ? "Create your first task to get started on your workflow"
                  : "Create a task or enable synced events filter to see more"}
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => startEditingTask(task)}
                className={`bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-4 hover:bg-[#1e1e1e] hover:border-[#3a3a3a] transition-all duration-200 cursor-pointer ${
                  task.completed ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-start space-x-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleComplete(task.id);
                        }}
                        className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                          task.completed
                            ? "bg-[#10b981] border-[#10b981]"
                            : "border-[#3a3a3a] hover:border-[#4a4a4a] hover:bg-[#2a2a2a]"
                        }`}
                      >
                        {task.completed && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          {/* Priority Indicator */}
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor:
                                {
                                  urgent: "#EF4444",
                                  high: "#F59E0B",
                                  medium: "#3B82F6",
                                  low: "#6B7280",
                                }[task.priority] || "#3B82F6",
                            }}
                            title={`Priority: ${task.priority || "medium"}`}
                          ></div>
                          <h3
                            className={`text-base font-medium text-white ${
                              task.completed ? "line-through opacity-60" : ""
                            }`}
                          >
                            {task.title}
                          </h3>
                          {/* Source Badge */}
                          {task.source && task.source !== "manual" && (
                            <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full font-medium flex items-center space-x-1">
                              <Mail className="w-3 h-3" />
                              <span>{task.source}</span>
                            </span>
                          )}
                          {/* Priority Badge */}
                          {task.priority === "urgent" && (
                            <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full font-medium">
                              URGENT
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-[#a1a1a1] mt-1 text-sm leading-relaxed">
                            {task.description}
                          </p>
                        )}
                        {/* Tags */}
                        {task.tags && task.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {task.tags.map((tagName, index) => {
                              const tagInfo = availableTags.find(
                                (t) => t.name === tagName
                              );
                              const bgColor = tagInfo?.color
                                ? `${tagInfo.color}25`
                                : "#8B5CF625";
                              const textColor = tagInfo?.color || "#8B5CF6";
                              return (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                                  style={{
                                    backgroundColor: bgColor,
                                    color: textColor,
                                    border: `1px solid ${textColor}50`,
                                  }}
                                >
                                  <Tag className="w-3 h-3 mr-1" />
                                  {tagName}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {/* Created date */}
                        <div className="flex items-center space-x-1.5 mt-2 text-xs text-[#666666]">
                          <Clock className="w-3 h-3" />
                          <span>
                            {new Date(task.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        showTaskTimeline(task);
                      }}
                      className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-all duration-200"
                      title="View task timeline"
                    >
                      <History className="w-4 h-4 text-[#a1a1a1] hover:text-blue-400" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTask(task.id);
                      }}
                      className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-all duration-200"
                    >
                      <Trash2 className="w-4 h-4 text-[#a1a1a1] hover:text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Task Timeline Modal */}
        {showTimeline && selectedTaskForTimeline && (
          <TaskTimeline
            task={selectedTaskForTimeline}
            timeline={taskTimeline}
            onClose={closeTimeline}
          />
        )}
      </div>
    </div>
  );
}

// Task Timeline Component (shared with Kanban)
function TaskTimeline({ task, timeline, onClose }) {
  const getStatusInfo = (status) => {
    const statusMap = {
      backlog: { name: "Backlog", color: "#666666" },
      todo: { name: "To Do", color: "#3B82F6" },
      in_progress: { name: "In Progress", color: "#F59E0B" },
      waiting: { name: "Waiting Answers", color: "#8B5CF6" },
      done: { name: "Done", color: "#10B981" },
    };
    return statusMap[status] || { name: status, color: "#666666" };
  };

  const formatDuration = (duration) => {
    if (!duration) return null;

    // Parse PostgreSQL interval format
    const regex = /(?:(\d+)\s*days?\s*)?(?:(\d{2}):(\d{2}):(\d{2}))?/;
    const match = duration.match(regex);

    if (match) {
      const days = parseInt(match[1]) || 0;
      const hours = parseInt(match[2]) || 0;
      const minutes = parseInt(match[3]) || 0;

      if (days > 0) return `${days}d ${hours}h`;
      if (hours > 0) return `${hours}h ${minutes}m`;
      return `${minutes}m`;
    }
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[#2d2d2d]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white mb-1">
                Task Timeline
              </h2>
              <h3 className="text-base text-[#a1a1a1] line-clamp-2">
                {task.title}
              </h3>
              <div className="flex items-center space-x-3 mt-2">
                <div className="flex items-center space-x-1 text-xs text-[#666666]">
                  <Clock className="w-3 h-3" />
                  <span>
                    Created: {new Date(task.created_at).toLocaleDateString()}
                  </span>
                </div>
                {task.tags && task.tags.length > 0 && (
                  <div className="flex items-center space-x-1">
                    {task.tags.slice(0, 2).map((tagName, index) => (
                      <span
                        key={index}
                        className="text-xs text-[#a1a1a1] bg-[#2a2a2a] px-2 py-0.5 rounded"
                      >
                        {tagName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-[#a1a1a1] hover:text-white" />
            </button>
          </div>
        </div>

        {/* Timeline */}
        <div className="p-6 overflow-y-auto max-h-96">
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-[#2d2d2d]"></div>

            <div className="space-y-6">
              {timeline.map((entry, index) => {
                const statusInfo = getStatusInfo(entry.to_status);
                const isLast = index === timeline.length - 1;
                const isFirst = index === 0;

                return (
                  <div
                    key={entry.id}
                    className="relative flex items-start space-x-4"
                  >
                    {/* Timeline Dot */}
                    <div
                      className={`relative z-10 w-4 h-4 rounded-full border-2 border-[#1a1a1a] ${
                        isFirst ? "ring-2 ring-opacity-50" : ""
                      }`}
                      style={{
                        backgroundColor: statusInfo.color,
                        ringColor: isFirst ? statusInfo.color : "transparent",
                      }}
                    >
                      {!isLast && (
                        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-0.5 h-6 bg-[#2d2d2d]"></div>
                      )}
                    </div>

                    {/* Timeline Content */}
                    <div className="flex-1 min-w-0 pb-2">
                      <div className="bg-[#0a0a0a] border border-[#2d2d2d] rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span
                              className="text-base font-semibold"
                              style={{ color: statusInfo.color }}
                            >
                              {statusInfo.name}
                            </span>
                            {entry.from_status && (
                              <div className="flex items-center space-x-1 text-xs text-[#666666]">
                                <span>from</span>
                                <span className="text-[#a1a1a1] font-medium">
                                  {getStatusInfo(entry.from_status).name}
                                </span>
                              </div>
                            )}
                            {isFirst && (
                              <span className="text-xs bg-[#2a2a2a] text-[#a1a1a1] px-2 py-0.5 rounded">
                                Initial Status
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#666666] text-right">
                            <div className="font-medium">
                              {new Date(entry.changed_at).toLocaleDateString()}
                            </div>
                            <div>
                              {new Date(entry.changed_at).toLocaleTimeString(
                                [],
                                { hour: "2-digit", minute: "2-digit" }
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Duration in previous status */}
                        {entry.duration_in_previous_status && (
                          <div className="text-sm text-[#a1a1a1] bg-[#1a1a1a] rounded px-3 py-1.5 mt-2">
                            <Clock className="w-3 h-3 inline mr-1" />
                            Time in previous status:{" "}
                            <span className="text-white font-medium">
                              {formatDuration(
                                entry.duration_in_previous_status
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {timeline.length === 0 && (
                <div className="text-center py-8 text-[#666666]">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No status changes tracked yet</p>
                  <p className="text-xs mt-1">
                    Move this task in the Kanban board to start tracking!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Stats */}
        {timeline.length > 0 && (
          <div className="p-4 border-t border-[#2d2d2d] bg-[#0a0a0a]">
            <div className="flex items-center justify-between text-sm">
              <div className="text-[#a1a1a1]">
                <span className="font-medium">{timeline.length}</span> status
                changes
              </div>
              <div className="text-[#a1a1a1]">
                Total journey:{" "}
                <span className="text-white font-medium">
                  {Math.round(
                    (new Date() - new Date(timeline[0].changed_at)) /
                      (1000 * 60 * 60 * 24)
                  )}{" "}
                  days
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
