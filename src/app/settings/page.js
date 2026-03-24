"use client";

import { useState, useEffect } from "react";
import { Plus, X, Tag, Trash2, Loader, Check, Palette } from "lucide-react";
import { supabase } from "@/lib/supabase";

const PRESET_COLORS = [
  "#EF4444", // Red
  "#F97316", // Orange
  "#F59E0B", // Amber
  "#84CC16", // Lime
  "#10B981", // Emerald
  "#06B6D4", // Cyan
  "#3B82F6", // Blue
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#6B7280", // Gray
];

export default function SettingsPage() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNewTag, setShowNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3B82F6");
  const [editingTag, setEditingTag] = useState(null);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching tags:", error);
      } else {
        setTags(data || []);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async (e) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    setSaving(true);
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
          alert("Failed to create tag. Please try again.");
        }
      } else {
        setTags([...tags, data].sort((a, b) => a.name.localeCompare(b.name)));
        setNewTagName("");
        setNewTagColor("#3B82F6");
        setShowNewTag(false);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTag = async (tag) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("tags")
        .update({ name: tag.name, color: tag.color })
        .eq("id", tag.id);

      if (error) {
        console.error("Error updating tag:", error);
        alert("Failed to update tag. Please try again.");
      } else {
        setTags(tags.map((t) => (t.id === tag.id ? tag : t)));
        setEditingTag(null);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTag = async (id) => {
    if (!confirm("Are you sure you want to delete this tag? It will be removed from all tasks.")) {
      return;
    }

    try {
      const { error } = await supabase.from("tags").delete().eq("id", id);

      if (error) {
        console.error("Error deleting tag:", error);
        alert("Failed to delete tag. Please try again.");
      } else {
        setTags(tags.filter((t) => t.id !== id));
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-[#a1a1a1] mt-1">
            Manage your LifeOS preferences and configurations
          </p>
        </div>

        {/* Tags Management Section */}
        <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg overflow-hidden">
          <div className="p-6 border-b border-[#2d2d2d]">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg">
                  <Tag className="w-5 h-5 text-[#8B5CF6]" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Tags</h2>
                  <p className="text-sm text-[#a1a1a1]">
                    Manage tags for organizing your tasks
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowNewTag(true);
                  setEditingTag(null);
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-[#2a2a2a] border border-[#3a3a3a] text-white rounded-lg hover:bg-[#3a3a3a] transition-all duration-200 font-medium"
              >
                <Plus className="w-4 h-4" />
                <span>New Tag</span>
              </button>
            </div>
          </div>

          {/* New Tag Form */}
          {showNewTag && (
            <div className="p-6 bg-[#0a0a0a] border-b border-[#2d2d2d]">
              <form onSubmit={handleCreateTag} className="space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-[#a1a1a1] mb-2">
                      Tag Name
                    </label>
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#2d2d2d] bg-[#1a1a1a] text-white placeholder-[#666666] focus:border-[#3a3a3a] focus:outline-none transition-colors duration-200"
                      placeholder="Enter tag name..."
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#a1a1a1] mb-2">
                      Color
                    </label>
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-10 h-10 rounded-lg border-2 border-[#3a3a3a] cursor-pointer"
                        style={{ backgroundColor: newTagColor }}
                      />
                    </div>
                  </div>
                </div>

                {/* Color Picker */}
                <div>
                  <label className="block text-sm font-medium text-[#a1a1a1] mb-2">
                    Choose Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewTagColor(color)}
                        className={`w-8 h-8 rounded-lg transition-all duration-200 ${
                          newTagColor === color
                            ? "ring-2 ring-white ring-offset-2 ring-offset-[#0a0a0a]"
                            : "hover:scale-110"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div>
                  <label className="block text-sm font-medium text-[#a1a1a1] mb-2">
                    Preview
                  </label>
                  <span
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium"
                    style={{
                      backgroundColor: `${newTagColor}25`,
                      color: newTagColor,
                      border: `1px solid ${newTagColor}50`,
                    }}
                  >
                    <Tag className="w-3 h-3 mr-1.5" />
                    {newTagName || "Tag Name"}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewTag(false);
                      setNewTagName("");
                      setNewTagColor("#3B82F6");
                    }}
                    className="px-4 py-2 text-[#a1a1a1] hover:bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !newTagName.trim()}
                    className="px-4 py-2 bg-[#8B5CF6] text-white rounded-lg hover:bg-[#7C3AED] transition-all duration-200 flex items-center space-x-2 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>Create Tag</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tags List */}
          <div className="divide-y divide-[#2d2d2d]">
            {loading ? (
              <div className="p-8 text-center">
                <Loader className="w-6 h-6 animate-spin text-[#a1a1a1] mx-auto mb-2" />
                <p className="text-[#a1a1a1]">Loading tags...</p>
              </div>
            ) : tags.length === 0 ? (
              <div className="p-8 text-center">
                <Tag className="w-8 h-8 text-[#666666] mx-auto mb-2" />
                <p className="text-[#a1a1a1]">No tags yet</p>
                <p className="text-sm text-[#666666]">
                  Create your first tag to get started
                </p>
              </div>
            ) : (
              tags.map((tag) => (
                <div
                  key={tag.id}
                  className="p-4 hover:bg-[#0a0a0a] transition-colors duration-200"
                >
                  {editingTag?.id === tag.id ? (
                    // Edit Mode
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <input
                          type="text"
                          value={editingTag.name}
                          onChange={(e) =>
                            setEditingTag({ ...editingTag, name: e.target.value })
                          }
                          className="flex-1 px-3 py-2 rounded-lg border border-[#2d2d2d] bg-[#1a1a1a] text-white focus:border-[#3a3a3a] focus:outline-none"
                        />
                        <div className="flex items-center space-x-2">
                          {PRESET_COLORS.slice(0, 5).map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() =>
                                setEditingTag({ ...editingTag, color })
                              }
                              className={`w-6 h-6 rounded-md ${
                                editingTag.color === color
                                  ? "ring-2 ring-white"
                                  : ""
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => setEditingTag(null)}
                          className="px-3 py-1 text-sm text-[#a1a1a1] hover:bg-[#2a2a2a] rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleUpdateTag(editingTag)}
                          disabled={saving}
                          className="px-3 py-1 text-sm bg-[#8B5CF6] text-white rounded-lg hover:bg-[#7C3AED] transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span
                          className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium"
                          style={{
                            backgroundColor: `${tag.color}25`,
                            color: tag.color,
                            border: `1px solid ${tag.color}50`,
                          }}
                        >
                          {tag.name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setEditingTag(tag)}
                          className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
                          title="Edit tag"
                        >
                          <Palette className="w-4 h-4 text-[#a1a1a1] hover:text-white" />
                        </button>
                        <button
                          onClick={() => handleDeleteTag(tag.id)}
                          className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
                          title="Delete tag"
                        >
                          <Trash2 className="w-4 h-4 text-[#a1a1a1] hover:text-red-400" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Database Connection Section */}
        <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg">
              <div className="w-5 h-5 rounded-full bg-[#10b981]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Database</h2>
              <p className="text-sm text-[#a1a1a1]">Supabase connection status</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-sm text-[#10b981]">
            <Check className="w-4 h-4" />
            <span>Connected to Supabase</span>
          </div>
        </div>

        {/* App Info */}
        <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">About</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#a1a1a1]">App Name</span>
              <span className="text-white">LifeOS</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#a1a1a1]">Version</span>
              <span className="text-white">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#a1a1a1]">Framework</span>
              <span className="text-white">Next.js 14</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
