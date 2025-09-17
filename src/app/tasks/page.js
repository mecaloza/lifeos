"use client";

import { useState, useEffect } from "react";
import { Plus, X, Tag, Trash2, Clock, Loader } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [showNewTask, setShowNewTask] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    tags: [],
  });
  const [currentTag, setCurrentTag] = useState("");

  // Fetch tasks from Supabase on mount
  useEffect(() => {
    fetchTasks();
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) return;

    setSaving(true);
    try {
      const newTask = {
        title: formData.title,
        description: formData.description,
        tags: formData.tags,
        completed: false,
        created_at: new Date().toISOString(),
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
      });
      setCurrentTag("");
      setShowNewTask(false);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    if (currentTag.trim() && !formData.tags.includes(currentTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, currentTag.trim()],
      });
      setCurrentTag("");
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tag) => tag !== tagToRemove),
    });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Tasks
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your tasks with tags (Supabase connected)
          </p>
        </div>
        <button
          onClick={() => setShowNewTask(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>New Task</span>
        </button>
      </div>

      {/* Task Creation Form */}
      {showNewTask && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Create New Task
            </h2>
            <button
              onClick={() => {
                setShowNewTask(false);
                setFormData({ title: "", description: "", tags: [] });
                setCurrentTag("");
              }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter task title..."
                required
                disabled={saving}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Enter task description..."
                rows="3"
                disabled={saving}
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tags
              </label>
              <div className="flex space-x-2 mb-2">
                <input
                  type="text"
                  value={currentTag}
                  onChange={(e) => setCurrentTag(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add a tag and press Enter..."
                  disabled={saving}
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  disabled={saving}
                >
                  Add Tag
                </button>
              </div>
              {/* Display current tags */}
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-2 hover:text-blue-900 dark:hover:text-blue-100"
                        disabled={saving}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowNewTask(false);
                  setFormData({ title: "", description: "", tags: [] });
                  setCurrentTag("");
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-colors flex items-center space-x-2"
                disabled={saving}
              >
                {saving && <Loader className="w-4 h-4 animate-spin" />}
                <span>{saving ? "Creating..." : "Create Task"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* All Tags Display */}
      {allTags.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Filter by Tags:
          </h3>
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <button
                key={tag}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <Tag className="w-3 h-3 mr-1" />
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tasks List */}
      <div className="space-y-4">
        {tasks.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl">
            <p className="text-gray-500 dark:text-gray-400">No tasks yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Create your first task to get started
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={`bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow ${
                task.completed ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-start space-x-3">
                    <button
                      onClick={() => toggleComplete(task.id)}
                      className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        task.completed
                          ? "bg-green-500 border-green-500"
                          : "border-gray-300 dark:border-gray-600 hover:border-blue-500"
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
                      <h3
                        className={`text-lg font-semibold text-gray-900 dark:text-white ${
                          task.completed ? "line-through" : ""
                        }`}
                      >
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                          {task.description}
                        </p>
                      )}
                      {/* Tags */}
                      {task.tags && task.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {task.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            >
                              <Tag className="w-3 h-3 mr-1" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Created date */}
                      <div className="flex items-center space-x-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>
                          {new Date(task.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
