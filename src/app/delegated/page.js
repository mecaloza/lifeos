"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Plus,
  X,
  Clock,
  CheckCircle2,
  Send,
  ArrowRight,
  Loader,
  Tag,
  MoreHorizontal,
  Trash2,
  Edit,
  User,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const DELEGATION_STATUSES = [
  {
    id: "to_deliver",
    label: "To Deliver",
    color: "#F59E0B",
    icon: Clock,
    description: "Waiting to be assigned",
  },
  {
    id: "delivered",
    label: "Delivered",
    color: "#3B82F6",
    icon: Send,
    description: "Assigned, waiting for completion",
  },
  {
    id: "done",
    label: "Done",
    color: "#10B981",
    icon: CheckCircle2,
    description: "Completed by team member",
  },
];

export default function DelegatedPage() {
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    delegated_to: "",
    delegation_notes: "",
    tags: [],
    priority: "medium",
  });
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [selectedTagFilter, setSelectedTagFilter] = useState(null);

  useEffect(() => {
    fetchDelegatedTasks();
    fetchTeamMembers();
    fetchTags();
  }, []);

  const fetchDelegatedTasks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("is_delegated", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching delegated tasks:", error);
      } else {
        setTasks(data || []);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("team_members")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching team members:", error);
      } else {
        setTeamMembers(data || []);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const fetchTags = async () => {
    try {
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .order("name", { ascending: true });

      if (!error) {
        setAvailableTags(data || []);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleAddMember = async () => {
    if (!newMemberName.trim()) return;

    try {
      const { data, error } = await supabase
        .from("team_members")
        .insert([{ name: newMemberName.trim() }])
        .select()
        .single();

      if (error) {
        console.error("Error adding team member:", error);
      } else {
        setTeamMembers([...teamMembers, data].sort((a, b) => a.name.localeCompare(b.name)));
        setNewMemberName("");
        setShowAddMember(false);
        // Auto-select the new member
        setFormData({ ...formData, delegated_to: data.name });
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const openNewTaskModal = () => {
    setEditingTask(null);
    setFormData({
      title: "",
      description: "",
      delegated_to: "",
      delegation_notes: "",
      tags: [],
      priority: "medium",
    });
    setShowModal(true);
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || "",
      delegated_to: task.delegated_to || "",
      delegation_notes: task.delegation_notes || "",
      tags: task.tags || [],
      priority: task.priority || "medium",
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setSaving(true);
    try {
      if (editingTask) {
        // Update existing task
        const { error } = await supabase
          .from("tasks")
          .update({
            title: formData.title,
            description: formData.description,
            delegated_to: formData.delegated_to,
            delegation_notes: formData.delegation_notes,
            tags: formData.tags,
            priority: formData.priority,
          })
          .eq("id", editingTask.id);

        if (error) {
          console.error("Error updating task:", error);
        } else {
          await fetchDelegatedTasks();
        }
      } else {
        // Create new delegated task
        const { error } = await supabase.from("tasks").insert([
          {
            title: formData.title,
            description: formData.description,
            delegated_to: formData.delegated_to,
            delegation_notes: formData.delegation_notes,
            tags: formData.tags,
            priority: formData.priority,
            is_delegated: true,
            delegation_status: "to_deliver",
            delegated_at: new Date().toISOString(),
            status: "todo",
            completed: false,
          },
        ]);

        if (error) {
          console.error("Error creating task:", error);
        } else {
          await fetchDelegatedTasks();
        }
      }

      setShowModal(false);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setSaving(false);
    }
  };

  const updateDelegationStatus = async (taskId, newStatus) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          delegation_status: newStatus,
          completed: newStatus === "done",
        })
        .eq("id", taskId);

      if (error) {
        console.error("Error updating status:", error);
      } else {
        setTasks(
          tasks.map((t) =>
            t.id === taskId
              ? { ...t, delegation_status: newStatus, completed: newStatus === "done" }
              : t
          )
        );
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const deleteTask = async (taskId) => {
    if (!confirm("Are you sure you want to delete this delegated task?")) return;

    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);

      if (error) {
        console.error("Error deleting task:", error);
      } else {
        setTasks(tasks.filter((t) => t.id !== taskId));
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const getTasksByStatus = (status) => {
    let filtered = tasks.filter((t) => t.delegation_status === status);
    if (selectedTagFilter) {
      filtered = filtered.filter((t) => t.tags && t.tags.includes(selectedTagFilter));
    }
    return filtered;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg flex items-center justify-center mx-auto mb-4">
            <Loader className="w-8 h-8 animate-spin text-[#a1a1a1]" />
          </div>
          <p className="text-white text-lg font-medium">Loading delegated tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center space-x-3">
              <Users className="w-8 h-8 text-[#8B5CF6]" />
              <span>Delegated Tasks</span>
            </h1>
            <p className="text-[#a1a1a1] mt-1">
              Track tasks assigned to your team members
            </p>
          </div>
          <button
            onClick={openNewTaskModal}
            className="flex items-center space-x-2 px-4 py-2 bg-[#8B5CF6] text-white rounded-lg hover:bg-[#7C3AED] transition-all duration-200 font-medium"
          >
            <Plus className="w-5 h-5" />
            <span>Delegate Task</span>
          </button>
        </div>

        {/* Tag Filter */}
        {availableTags.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center space-x-2 mb-3">
              <Tag className="w-4 h-4 text-[#a1a1a1]" />
              <span className="text-sm text-[#a1a1a1]">Filter by tag:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTagFilter(null)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                  !selectedTagFilter
                    ? "bg-white/10 border-white/30 text-white"
                    : "border-[#2d2d2d] text-[#a1a1a1] hover:border-[#3a3a3a]"
                }`}
              >
                All
              </button>
              {availableTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTagFilter(selectedTagFilter === tag.name ? null : tag.name)}
                  className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                    selectedTagFilter === tag.name
                      ? "border-current"
                      : "border-[#2d2d2d] hover:border-[#3a3a3a]"
                  }`}
                  style={{
                    backgroundColor: selectedTagFilter === tag.name ? `${tag.color}20` : "transparent",
                    color: selectedTagFilter === tag.name ? tag.color : "#a1a1a1",
                  }}
                >
                  <span>{tag.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {DELEGATION_STATUSES.map((status) => {
            const count = getTasksByStatus(status.id).length;
            const Icon = status.icon;
            return (
              <div
                key={status.id}
                className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `${status.color}20` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: status.color }} />
                    </div>
                    <div>
                      <p className="text-[#a1a1a1] text-sm">{status.label}</p>
                      <p className="text-2xl font-bold text-white">{count}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Kanban-style columns */}
        <div className="grid grid-cols-3 gap-6">
          {DELEGATION_STATUSES.map((status) => {
            const statusTasks = getTasksByStatus(status.id);
            const Icon = status.icon;

            return (
              <div key={status.id} className="space-y-4">
                {/* Column Header */}
                <div
                  className="flex items-center space-x-2 pb-3 border-b-2"
                  style={{ borderColor: status.color }}
                >
                  <Icon className="w-5 h-5" style={{ color: status.color }} />
                  <h2 className="text-lg font-semibold text-white">{status.label}</h2>
                  <span className="bg-[#2a2a2a] text-[#a1a1a1] text-sm px-2 py-0.5 rounded-full">
                    {statusTasks.length}
                  </span>
                </div>

                {/* Tasks */}
                <div className="space-y-3">
                  {statusTasks.length === 0 ? (
                    <div className="text-center py-8 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg border-dashed">
                      <p className="text-[#666666] text-sm">{status.description}</p>
                    </div>
                  ) : (
                    statusTasks.map((task) => (
                      <DelegatedTaskCard
                        key={task.id}
                        task={task}
                        status={status}
                        availableTags={availableTags}
                        onStatusChange={updateDelegationStatus}
                        onEdit={() => openEditModal(task)}
                        onDelete={() => deleteTask(task.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg w-full max-w-lg">
            <div className="p-6 border-b border-[#2d2d2d]">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">
                  {editingTask ? "Edit Delegated Task" : "Delegate New Task"}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-[#a1a1a1] hover:text-white" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Task Title */}
              <div>
                <label className="block text-sm font-medium text-[#a1a1a1] mb-2">
                  Task Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#2d2d2d] bg-[#0a0a0a] text-white placeholder-[#666666] focus:border-[#3a3a3a] focus:outline-none"
                  placeholder="What needs to be done?"
                  required
                />
              </div>

              {/* Assign To */}
              <div>
                <label className="block text-sm font-medium text-[#a1a1a1] mb-2">
                  Assign To
                </label>
                <div className="flex space-x-2">
                  <select
                    value={formData.delegated_to}
                    onChange={(e) =>
                      setFormData({ ...formData, delegated_to: e.target.value })
                    }
                    className="flex-1 px-3 py-2 rounded-lg border border-[#2d2d2d] bg-[#0a0a0a] text-white focus:border-[#3a3a3a] focus:outline-none"
                  >
                    <option value="">Select team member...</option>
                    {teamMembers.map((member) => (
                      <option key={member.id} value={member.name}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddMember(!showAddMember)}
                    className="px-3 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg hover:bg-[#3a3a3a] transition-colors"
                  >
                    <Plus className="w-5 h-5 text-[#a1a1a1]" />
                  </button>
                </div>

                {/* Add new member inline */}
                {showAddMember && (
                  <div className="mt-2 flex space-x-2">
                    <input
                      type="text"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      placeholder="New member name..."
                      className="flex-1 px-3 py-2 rounded-lg border border-[#2d2d2d] bg-[#0a0a0a] text-white placeholder-[#666666] focus:border-[#3a3a3a] focus:outline-none text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleAddMember}
                      className="px-3 py-2 bg-[#8B5CF6] text-white rounded-lg hover:bg-[#7C3AED] transition-colors text-sm"
                    >
                      Add
                    </button>
                  </div>
                )}
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
                  className="w-full px-3 py-2 rounded-lg border border-[#2d2d2d] bg-[#0a0a0a] text-white placeholder-[#666666] focus:border-[#3a3a3a] focus:outline-none resize-none"
                  placeholder="Task details..."
                  rows="3"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-[#a1a1a1] mb-2">
                  Delegation Notes
                </label>
                <textarea
                  value={formData.delegation_notes}
                  onChange={(e) =>
                    setFormData({ ...formData, delegation_notes: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[#2d2d2d] bg-[#0a0a0a] text-white placeholder-[#666666] focus:border-[#3a3a3a] focus:outline-none resize-none"
                  placeholder="Instructions or notes for the assignee..."
                  rows="2"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-[#a1a1a1] mb-2">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => {
                    const isSelected = formData.tags.includes(tag.name);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setFormData({
                              ...formData,
                              tags: formData.tags.filter((t) => t !== tag.name),
                            });
                          } else {
                            setFormData({
                              ...formData,
                              tags: [...formData.tags, tag.name],
                            });
                          }
                        }}
                        className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                          isSelected
                            ? "border-current"
                            : "border-[#2d2d2d] hover:border-[#3a3a3a]"
                        }`}
                        style={{
                          backgroundColor: isSelected ? `${tag.color}20` : "transparent",
                          color: isSelected ? tag.color : "#a1a1a1",
                        }}
                      >
                        <Tag className="w-3 h-3" />
                        <span>{tag.name}</span>
                      </button>
                    );
                  })}
                  {availableTags.length === 0 && (
                    <p className="text-[#666666] text-sm">
                      No tags available. Create tags in Settings.
                    </p>
                  )}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-[#a1a1a1] mb-2">
                  Priority
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: "urgent", label: "Urgent", color: "#EF4444", emoji: "🔴" },
                    { value: "high", label: "High", color: "#F59E0B", emoji: "🟠" },
                    { value: "medium", label: "Medium", color: "#3B82F6", emoji: "🔵" },
                    { value: "low", label: "Low", color: "#6B7280", emoji: "⚪" },
                  ].map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, priority: p.value })}
                      className={`flex items-center justify-center space-x-1 px-2 py-2 rounded-lg text-sm font-medium transition-all border ${
                        formData.priority === p.value
                          ? "border-current"
                          : "border-[#2d2d2d] text-[#a1a1a1] hover:border-[#3a3a3a]"
                      }`}
                      style={{
                        backgroundColor:
                          formData.priority === p.value ? `${p.color}20` : "transparent",
                        color: formData.priority === p.value ? p.color : undefined,
                      }}
                    >
                      <span>{p.emoji}</span>
                      <span className="hidden sm:inline">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-[#a1a1a1] hover:bg-[#2a2a2a] border border-[#2d2d2d] rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-[#8B5CF6] text-white rounded-lg hover:bg-[#7C3AED] transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  {saving && <Loader className="w-4 h-4 animate-spin" />}
                  <span>{editingTask ? "Update" : "Delegate"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Delegated Task Card Component
function DelegatedTaskCard({
  task,
  status,
  availableTags,
  onStatusChange,
  onEdit,
  onDelete,
}) {
  const [showMenu, setShowMenu] = useState(false);

  const nextStatus = {
    to_deliver: "delivered",
    delivered: "done",
    done: null,
  };

  const priorityColors = {
    urgent: "#EF4444",
    high: "#F59E0B",
    medium: "#3B82F6",
    low: "#6B7280",
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-4 hover:border-[#3a3a3a] transition-all group">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: priorityColors[task.priority] || priorityColors.medium }}
          />
          <h3 className="text-white font-medium text-sm line-clamp-2">{task.title}</h3>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-[#2a2a2a] rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="w-4 h-4 text-[#a1a1a1]" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-6 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
              <button
                onClick={() => {
                  onEdit();
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-white hover:bg-[#3a3a3a] flex items-center space-x-2"
              >
                <Edit className="w-3 h-3" />
                <span>Edit</span>
              </button>
              <button
                onClick={() => {
                  onDelete();
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-[#3a3a3a] flex items-center space-x-2"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Assigned To */}
      {task.delegated_to && (
        <div className="flex items-center space-x-2 mb-2">
          <User className="w-3 h-3 text-[#8B5CF6]" />
          <span className="text-[#8B5CF6] text-xs font-medium">{task.delegated_to}</span>
        </div>
      )}

      {/* Description */}
      {task.description && (
        <p className="text-[#a1a1a1] text-xs mb-2 line-clamp-2">{task.description}</p>
      )}

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.tags.slice(0, 2).map((tagName, index) => {
            const tagInfo = availableTags.find((t) => t.name === tagName);
            return (
              <span
                key={index}
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  backgroundColor: `${tagInfo?.color || "#8B5CF6"}20`,
                  color: tagInfo?.color || "#8B5CF6",
                }}
              >
                {tagName}
              </span>
            );
          })}
        </div>
      )}

      {/* Move to next status button */}
      {nextStatus[task.delegation_status] && (
        <button
          onClick={() => onStatusChange(task.id, nextStatus[task.delegation_status])}
          className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg text-sm text-white hover:bg-[#3a3a3a] transition-all"
        >
          <span>
            Move to{" "}
            {nextStatus[task.delegation_status] === "delivered" ? "Delivered" : "Done"}
          </span>
          <ArrowRight className="w-4 h-4" />
        </button>
      )}

      {/* Done indicator */}
      {task.delegation_status === "done" && (
        <div className="flex items-center justify-center space-x-2 px-3 py-2 bg-[#10B981]/20 rounded-lg text-sm text-[#10B981]">
          <CheckCircle2 className="w-4 h-4" />
          <span>Completed</span>
        </div>
      )}
    </div>
  );
}

