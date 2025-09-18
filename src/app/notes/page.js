"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus,
  X,
  Search,
  Tag,
  Trash2,
  Edit3,
  Save,
  Paperclip,
  Link,
  Pin,
  PinOff,
  Image as ImageIcon,
  Bold,
  Italic,
  Underline,
  List,
  Quote,
  Loader,
  FileText,
  Calendar,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// Handle image paste from clipboard
const handleImagePaste = (event) => {
  return new Promise((resolve) => {
    const items = event.clipboardData?.items;

    if (!items) {
      resolve(null);
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        resolve(file);
        return;
      }
    }

    resolve(null);
  });
};

export default function NotesPage() {
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [showNewNote, setShowNewNote] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [showTaskLink, setShowTaskLink] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const contentEditableRef = useRef(null);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    title: "",
    content_html: "",
    content_text: "",
    tags: [],
    task_id: null,
    is_pinned: false,
  });

  // Fetch data on mount
  useEffect(() => {
    fetchNotes();
    fetchTasks();
    fetchAvailableTags();
  }, []);

  // Update content editor when formData changes
  useEffect(() => {
    if (contentEditableRef.current && (showNewNote || editingNote)) {
      const currentContent = contentEditableRef.current.innerHTML;
      const newContent = formData.content_html || "";

      // Only update if content actually changed to avoid cursor jumping
      if (currentContent !== newContent) {
        contentEditableRef.current.innerHTML = newContent;

        // If it's empty content, add initial setup for line breaks
        if (!newContent) {
          // Add a single br tag to ensure Enter key works from start
          contentEditableRef.current.innerHTML = "<br>";

          setTimeout(() => {
            if (contentEditableRef.current) {
              contentEditableRef.current.focus();
              const range = document.createRange();
              const selection = window.getSelection();
              range.setStart(contentEditableRef.current, 0);
              range.setEnd(contentEditableRef.current, 0);
              selection.removeAllRanges();
              selection.addRange(range);
            }
          }, 0);
        }
      }
    }
  }, [formData.content_html, showNewNote, editingNote]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("notes")
        .select(
          `
          *,
          tasks!notes_task_id_fkey (
            id,
            title
          )
        `
        )
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching notes:", error);
        setNotes([]);
      } else {
        setNotes(data || []);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, completed")
        .order("title", { ascending: true });

      if (error) {
        console.error("Error fetching tasks:", error);
        setTasks([]);
      } else {
        setTasks(data || []);
      }
    } catch (error) {
      console.error("Error:", error);
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
        setAvailableTags([
          { id: 1, name: "Work", color: "#EF4444" },
          { id: 2, name: "Personal", color: "#10B981" },
          { id: 3, name: "Ideas", color: "#F59E0B" },
          { id: 4, name: "Meeting", color: "#3B82F6" },
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
      const noteData = {
        title: formData.title.trim(),
        content_html: formData.content_html,
        content_text: formData.content_text.trim(),
        tags: formData.tags,
        task_id: formData.task_id || null,
        is_pinned: formData.is_pinned,
      };

      const { data, error } = await supabase
        .from("notes")
        .insert([noteData])
        .select(
          `
          *,
          tasks!notes_task_id_fkey (
            id,
            title
          )
        `
        )
        .single();

      if (error) {
        console.error("Error saving note:", error);
        alert("Failed to save note. Please try again.");
      } else {
        setNotes([data, ...notes]);
        resetForm();
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to save note. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateNote = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) return;

    setSaving(true);
    try {
      const noteData = {
        title: formData.title.trim(),
        content_html: formData.content_html,
        content_text: formData.content_text.trim(),
        tags: formData.tags,
        task_id: formData.task_id || null,
        is_pinned: formData.is_pinned,
      };

      const { data, error } = await supabase
        .from("notes")
        .update(noteData)
        .eq("id", editingNote.id)
        .select(
          `
          *,
          tasks!notes_task_id_fkey (
            id,
            title
          )
        `
        )
        .single();

      if (error) {
        console.error("Error updating note:", error);
        alert("Failed to update note. Please try again.");
      } else {
        const updatedNotes = notes.map((note) =>
          note.id === editingNote.id ? data : note
        );
        setNotes(updatedNotes);
        resetForm();
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to update note. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (id) => {
    if (!confirm("Are you sure you want to delete this note?")) return;

    try {
      const { error } = await supabase.from("notes").delete().eq("id", id);

      if (error) {
        console.error("Error deleting note:", error);
        alert("Failed to delete note. Please try again.");
      } else {
        setNotes(notes.filter((note) => note.id !== id));
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const togglePin = async (id) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;

    try {
      const { error } = await supabase
        .from("notes")
        .update({ is_pinned: !note.is_pinned })
        .eq("id", id);

      if (error) {
        console.error("Error toggling pin:", error);
      } else {
        const updatedNotes = notes.map((n) =>
          n.id === id ? { ...n, is_pinned: !n.is_pinned } : n
        );
        // Re-sort to put pinned notes at top
        updatedNotes.sort((a, b) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          return new Date(b.created_at) - new Date(a.created_at);
        });
        setNotes(updatedNotes);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const startEditingNote = async (note) => {
    setEditingNote(note);
    setFormData({
      title: note.title,
      content_html: note.content_html || "",
      content_text: note.content_text || "",
      tags: note.tags || [],
      task_id: note.task_id,
      is_pinned: note.is_pinned || false,
    });

    setShowNewNote(false);

    // Focus the editor after a short delay to ensure content is loaded
    setTimeout(() => {
      if (contentEditableRef.current) {
        contentEditableRef.current.focus();

        // Position cursor at the end of content
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(contentEditableRef.current);
        range.collapse(false); // Collapse to end
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }, 150);
  };

  const resetForm = () => {
    setFormData({
      title: "",
      content_html: "",
      content_text: "",
      tags: [],
      task_id: null,
      is_pinned: false,
    });
    setShowNewNote(false);
    setEditingNote(null);
    setShowTaskLink(false);
  };

  const addTag = (tagName) => {
    if (tagName && !formData.tags.includes(tagName)) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagName],
      });
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tag) => tag !== tagToRemove),
    });
  };

  // Format text in the content editable
  const formatText = (command, value = null) => {
    document.execCommand(command, false, value);
    if (contentEditableRef.current) {
      setFormData({
        ...formData,
        content_text: contentEditableRef.current.innerText,
      });
    }
  };

  // Handle content change in editable div
  const handleContentChange = () => {
    if (contentEditableRef.current) {
      setFormData({
        ...formData,
        content_html: contentEditableRef.current.innerHTML,
        content_text: contentEditableRef.current.innerText,
      });
    }
  };

  // Handle image file selection
  const handleImageSelect = async (files) => {
    if (!files || files.length === 0) return;

    for (let file of files) {
      if (file.type.startsWith("image/")) {
        await handleImageUpload(file);
      }
    }
  };

  // Handle image upload - embed as base64 directly in content
  const handleImageUpload = async (file) => {
    if (!file) return;

    setUploadingImage(true);
    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Data = e.target.result;

        // Insert image into content at cursor position
        if (contentEditableRef.current) {
          const img = `<img src="${base64Data}" alt="Uploaded image" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 8px; display: block;" />`;

          // Get current selection
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const imgElement = document.createElement("img");
            imgElement.src = base64Data;
            imgElement.alt = "Uploaded image";
            imgElement.style.cssText =
              "max-width: 100%; height: auto; margin: 10px 0; border-radius: 8px; display: block;";

            range.insertNode(imgElement);
            range.collapse(false);

            // Move cursor after the image
            range.setStartAfter(imgElement);
            range.setEndAfter(imgElement);
            selection.removeAllRanges();
            selection.addRange(range);
          } else {
            // If no selection, append to end
            contentEditableRef.current.innerHTML += `<br>${img}<br>`;
          }

          handleContentChange();
          setUploadingImage(false);
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error processing image:", error);
      alert("Failed to process image. Please try again.");
      setUploadingImage(false);
    }
  };

  // Handle paste event for images
  const handlePaste = async (event) => {
    const imageFile = await handleImagePaste(event);
    if (imageFile) {
      event.preventDefault();
      await handleImageUpload(imageFile);
    }
  };

  // Handle drag and drop
  const handleDrop = async (event) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    await handleImageSelect(files);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  // Filter notes based on search and tag
  const filteredNotes = notes.filter((note) => {
    const matchesSearch = searchQuery
      ? note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content_text?.toLowerCase().includes(searchQuery.toLowerCase())
      : true;

    const matchesTag = selectedTag ? note.tags?.includes(selectedTag) : true;

    return matchesSearch && matchesTag;
  });

  // Get all unique tags from notes
  const usedTags = [...new Set(notes.flatMap((note) => note.tags || []))];

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg flex items-center justify-center mx-auto mb-4">
            <Loader className="w-8 h-8 animate-spin text-[#a1a1a1]" />
          </div>
          <p className="text-white text-lg font-medium">
            Loading your notes...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Notes</h1>
            <p className="text-[#a1a1a1] mt-1 text-base">
              Capture your thoughts, link to tasks, and organize your knowledge
            </p>
          </div>
          <button
            onClick={() => {
              setEditingNote(null);
              resetForm();
              setShowNewNote(true);

              // Focus the editor after form is reset
              setTimeout(() => {
                if (contentEditableRef.current) {
                  contentEditableRef.current.focus();
                }
              }, 100);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-[#1e1e1e] border border-[#2d2d2d] text-white rounded-lg hover:bg-[#2a2a2a] hover:border-[#3a3a3a] transition-all duration-200 font-medium"
          >
            <Plus className="w-5 h-5" />
            <span>New Note</span>
          </button>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#666666]" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg text-white placeholder-[#666666] focus:border-[#3a3a3a] focus:outline-none transition-colors"
            />
          </div>
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="px-4 py-2 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg text-white focus:border-[#3a3a3a] focus:outline-none transition-colors"
          >
            <option value="">All tags</option>
            {usedTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>

        {/* Note Editor */}
        {(showNewNote || editingNote) && (
          <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">
                {editingNote ? "Edit Note" : "Create New Note"}
              </h2>
              <button
                onClick={resetForm}
                className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#a1a1a1] hover:text-white" />
              </button>
            </div>

            <form
              onSubmit={editingNote ? handleUpdateNote : handleSubmit}
              className="space-y-4"
            >
              {/* Title */}
              <div>
                <input
                  type="text"
                  placeholder="Note title..."
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-0 py-2 text-2xl font-bold bg-transparent border-none text-white placeholder-[#666666] focus:outline-none resize-none"
                  required
                  disabled={saving}
                />
              </div>

              {/* Rich Text Toolbar */}
              <div className="flex items-center space-x-2 p-2 bg-[#0a0a0a] border border-[#2d2d2d] rounded-lg">
                <button
                  type="button"
                  onClick={() => formatText("bold")}
                  className="p-2 hover:bg-[#2a2a2a] rounded transition-colors"
                  title="Bold"
                >
                  <Bold className="w-4 h-4 text-[#a1a1a1] hover:text-white" />
                </button>
                <button
                  type="button"
                  onClick={() => formatText("italic")}
                  className="p-2 hover:bg-[#2a2a2a] rounded transition-colors"
                  title="Italic"
                >
                  <Italic className="w-4 h-4 text-[#a1a1a1] hover:text-white" />
                </button>
                <button
                  type="button"
                  onClick={() => formatText("underline")}
                  className="p-2 hover:bg-[#2a2a2a] rounded transition-colors"
                  title="Underline"
                >
                  <Underline className="w-4 h-4 text-[#a1a1a1] hover:text-white" />
                </button>
                <div className="w-px h-6 bg-[#2d2d2d]"></div>
                <button
                  type="button"
                  onClick={() => formatText("insertUnorderedList")}
                  className="p-2 hover:bg-[#2a2a2a] rounded transition-colors"
                  title="Bullet List"
                >
                  <List className="w-4 h-4 text-[#a1a1a1] hover:text-white" />
                </button>
                <button
                  type="button"
                  onClick={() => formatText("formatBlock", "blockquote")}
                  className="p-2 hover:bg-[#2a2a2a] rounded transition-colors"
                  title="Quote"
                >
                  <Quote className="w-4 h-4 text-[#a1a1a1] hover:text-white" />
                </button>
                <div className="w-px h-6 bg-[#2d2d2d]"></div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="p-2 hover:bg-[#2a2a2a] rounded transition-colors disabled:opacity-50"
                  title="Add Image"
                >
                  {uploadingImage ? (
                    <Loader className="w-4 h-4 text-[#a1a1a1] animate-spin" />
                  ) : (
                    <ImageIcon className="w-4 h-4 text-[#a1a1a1] hover:text-white" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleImageSelect(e.target.files)}
                  className="hidden"
                />
              </div>

              {/* Content Editor */}
              <div
                ref={contentEditableRef}
                contentEditable={!saving && !uploadingImage}
                role="textbox"
                aria-multiline="true"
                spellCheck="true"
                onInput={handleContentChange}
                onKeyDown={(e) => {
                  // Allow default Enter key behavior for line breaks
                  if (e.key === "Enter") {
                    // Let the browser handle Enter naturally
                    setTimeout(() => {
                      handleContentChange();
                    }, 0);
                  }
                }}
                onPaste={handlePaste}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className={`min-h-[200px] p-4 bg-[#0a0a0a] border border-[#2d2d2d] rounded-lg text-white focus:outline-none focus:border-[#3a3a3a] prose prose-invert max-w-none transition-colors ${
                  uploadingImage ? "border-blue-500/50" : ""
                }`}
                data-placeholder="Start writing your note... (you can paste or drag images directly here)"
                style={{
                  caretColor: "#ffffff",
                  position: "relative",
                }}
                onFocus={(e) => {
                  // Clear placeholder when focused
                  e.target.style.setProperty("--placeholder-opacity", "0");
                }}
                onClick={(e) => {
                  // Ensure proper cursor positioning on click
                  const content = e.target.innerHTML;
                  if (
                    !content.trim() ||
                    content === "<br>" ||
                    content === "<br/>"
                  ) {
                    setTimeout(() => {
                      const range = document.createRange();
                      const selection = window.getSelection();
                      if (e.target.firstChild) {
                        range.setStart(e.target.firstChild, 0);
                        range.setEnd(e.target.firstChild, 0);
                      } else {
                        range.setStart(e.target, 0);
                        range.setEnd(e.target, 0);
                      }
                      selection.removeAllRanges();
                      selection.addRange(range);
                    }, 0);
                  }
                }}
                onBlur={(e) => {
                  const content = e.target.innerHTML;
                  if (
                    !content.trim() ||
                    content === "<br>" ||
                    content === "<br/>"
                  ) {
                    e.target.style.setProperty("--placeholder-opacity", "1");
                  }
                }}
                suppressContentEditableWarning={true}
              />

              {/* Attachments are now embedded inline in the content */}

              {/* Task Link */}
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={() => setShowTaskLink(!showTaskLink)}
                  className="flex items-center space-x-2 px-3 py-2 bg-[#0a0a0a] border border-[#2d2d2d] rounded-lg hover:bg-[#1a1a1a] transition-colors"
                >
                  <Link className="w-4 h-4 text-[#a1a1a1]" />
                  <span className="text-sm text-[#a1a1a1]">
                    {formData.task_id ? "Change Task" : "Link to Task"}
                  </span>
                </button>

                {formData.task_id && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-[#a1a1a1]">Linked to:</span>
                    <span className="text-sm text-white font-medium">
                      {tasks.find((t) => t.id === formData.task_id)?.title}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, task_id: null })
                      }
                      className="text-[#666666] hover:text-red-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Task Selection */}
              {showTaskLink && (
                <div>
                  <select
                    value={formData.task_id || ""}
                    onChange={(e) => {
                      const taskId = e.target.value
                        ? parseInt(e.target.value)
                        : null;
                      setFormData({ ...formData, task_id: taskId });
                      setShowTaskLink(false);
                    }}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2d2d2d] rounded-lg text-white focus:border-[#3a3a3a] focus:outline-none"
                  >
                    <option value="">Select a task to link...</option>
                    {tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.completed ? "✓ " : ""}
                        {task.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tags */}
              <div>
                <div className="flex items-center space-x-4 mb-3">
                  <select
                    onChange={(e) => {
                      addTag(e.target.value);
                      e.target.value = "";
                    }}
                    className="px-3 py-2 bg-[#0a0a0a] border border-[#2d2d2d] rounded-lg text-white focus:border-[#3a3a3a] focus:outline-none text-sm"
                    disabled={saving}
                  >
                    <option value="">Add a tag...</option>
                    {availableTags.map((tag) => (
                      <option
                        key={tag.id}
                        value={tag.name}
                        disabled={formData.tags.includes(tag.name)}
                      >
                        {tag.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        is_pinned: !formData.is_pinned,
                      })
                    }
                    className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition-colors ${
                      formData.is_pinned
                        ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                        : "bg-[#0a0a0a] border border-[#2d2d2d] text-[#a1a1a1] hover:bg-[#1a1a1a]"
                    }`}
                  >
                    {formData.is_pinned ? (
                      <>
                        <Pin className="w-4 h-4" />
                        <span className="text-sm">Pinned</span>
                      </>
                    ) : (
                      <>
                        <PinOff className="w-4 h-4" />
                        <span className="text-sm">Pin</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Display current tags */}
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
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
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                          style={{
                            backgroundColor: bgColor,
                            color: textColor,
                            border: `1px solid ${textColor}60`,
                          }}
                        >
                          <Tag className="w-3 h-3 mr-1" />
                          {tagName}
                          <button
                            type="button"
                            onClick={() => removeTag(tagName)}
                            className="ml-2 opacity-70 hover:opacity-100 transition-opacity"
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

              {/* Submit Button */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
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
                  <Save className="w-4 h-4" />
                  <span>
                    {saving
                      ? editingNote
                        ? "Updating..."
                        : "Saving..."
                      : editingNote
                      ? "Update Note"
                      : "Save Note"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Notes Grid */}
        <div className="space-y-4">
          {filteredNotes.length === 0 ? (
            <div className="text-center py-12 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg">
              <div className="w-12 h-12 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg flex items-center justify-center mx-auto mb-4">
                <FileText className="w-6 h-6 text-[#a1a1a1]" />
              </div>
              <p className="text-white text-base font-medium">
                {searchQuery || selectedTag ? "No notes found" : "No notes yet"}
              </p>
              <p className="text-[#666666] text-sm mt-1">
                {searchQuery || selectedTag
                  ? "Try adjusting your search or filter"
                  : "Create your first note to get started"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNotes.map((note) => (
                <div
                  key={note.id}
                  className={`bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-4 hover:bg-[#1e1e1e] hover:border-[#3a3a3a] transition-all duration-200 cursor-pointer relative ${
                    note.is_pinned ? "ring-1 ring-yellow-500/30" : ""
                  }`}
                  onClick={() => startEditingNote(note)}
                >
                  {/* Pin indicator */}
                  {note.is_pinned && (
                    <Pin className="absolute top-2 right-2 w-4 h-4 text-yellow-400" />
                  )}

                  <div className="space-y-3">
                    {/* Title and actions */}
                    <div className="flex items-start justify-between">
                      <h3 className="text-lg font-semibold text-white line-clamp-2 flex-1 pr-2">
                        {note.title}
                      </h3>
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePin(note.id);
                          }}
                          className="p-1 hover:bg-[#2a2a2a] rounded transition-colors"
                        >
                          {note.is_pinned ? (
                            <PinOff className="w-3 h-3 text-yellow-400" />
                          ) : (
                            <Pin className="w-3 h-3 text-[#a1a1a1] hover:text-yellow-400" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNote(note.id);
                          }}
                          className="p-1 hover:bg-[#2a2a2a] rounded transition-colors"
                        >
                          <Trash2 className="w-3 h-3 text-[#a1a1a1] hover:text-red-400" />
                        </button>
                      </div>
                    </div>

                    {/* Content preview */}
                    {note.content_text && (
                      <p className="text-[#a1a1a1] text-sm line-clamp-3 leading-relaxed">
                        {note.content_text}
                      </p>
                    )}

                    {/* Tags */}
                    {note.tags && note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {note.tags.slice(0, 3).map((tagName, index) => {
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
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                              style={{
                                backgroundColor: bgColor,
                                color: textColor,
                                border: `1px solid ${textColor}50`,
                              }}
                            >
                              <Tag className="w-2 h-2 mr-1" />
                              {tagName}
                            </span>
                          );
                        })}
                        {note.tags.length > 3 && (
                          <span className="text-xs text-[#666666] px-2 py-0.5">
                            +{note.tags.length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Task link */}
                    {note.tasks && (
                      <div className="flex items-center space-x-2 text-xs">
                        <Calendar className="w-3 h-3 text-blue-400" />
                        <span className="text-blue-400 font-medium">
                          {note.tasks.title}
                        </span>
                      </div>
                    )}

                    {/* Created date */}
                    <div className="text-xs text-[#666666]">
                      {new Date(note.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
