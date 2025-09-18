"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Tag,
  X,
  Calendar as CalendarIcon,
  Edit,
  Menu,
  List,
  GripVertical,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// Time utilities
const timeSlots = Array.from({ length: 24 }, (_, i) => ({
  hour: i,
  label: `${i.toString().padStart(2, "0")}:00`,
}));

const getWeekDates = (currentDate) => {
  const startOfWeek = new Date(currentDate);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day; // First day is Sunday
  startOfWeek.setDate(diff);

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    return date;
  });
};

// Draggable Task in Side Panel
function SidebarTask({ task, availableTags }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `sidebar-${task.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getTaskColor = () => {
    if (task.tags && task.tags.length > 0) {
      const firstTag = task.tags[0];
      const tagInfo = availableTags.find((tag) => tag.name === firstTag);
      return tagInfo?.color || "#3B82F6";
    }
    return "#3B82F6";
  };

  const taskColor = getTaskColor();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-[#0a0a0a] border border-[#2d2d2d] rounded-lg p-3 cursor-grab hover:bg-[#1e1e1e] hover:border-[#3a3a3a] transition-all duration-200 group ${
        isDragging ? "opacity-40 cursor-grabbing" : "hover:shadow-lg"
      }`}
    >
      <div className="flex items-start space-x-3">
        <div className="mt-1">
          <GripVertical className="w-4 h-4 text-[#666666] group-hover:text-[#a1a1a1]" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-medium text-sm line-clamp-1 mb-1">
            {task.title}
          </h4>
          {task.description && (
            <p className="text-[#a1a1a1] text-xs line-clamp-2 mb-2">
              {task.description}
            </p>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {task.tags && task.tags.length > 0 && (
                <div className="flex items-center space-x-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: taskColor }}
                  ></div>
                  <span className="text-xs text-[#666666]">{task.tags[0]}</span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-1 text-xs text-[#666666]">
              <Clock className="w-3 h-3" />
              <span>
                {Math.round(((task.duration_minutes || 60) / 60) * 10) / 10}h
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Side Panel Component
function TaskSidebar({ isOpen, onToggle, tasks, availableTags }) {
  const unscheduledTasks = tasks.filter((task) => !task.is_scheduled);

  return (
    <>
      {/* Toggle Tab - Always visible, attached to panel edge */}
      <button
        onClick={onToggle}
        className={`fixed left-16 top-20 w-10 h-20 bg-[#1a1a1a] border border-[#2d2d2d] border-l-0 rounded-r-xl hover:bg-[#2a2a2a] hover:border-[#3a3a3a] transition-all duration-200 flex flex-col items-center justify-center group z-40 ${
          isOpen
            ? "shadow-lg border-r-2 border-r-[#3B82F6] translate-x-80"
            : "shadow-md translate-x-0"
        }`}
      >
        <List className="w-4 h-4 text-[#a1a1a1] group-hover:text-white mb-1" />
        <div className="text-xs text-[#666666] group-hover:text-[#a1a1a1] transform -rotate-90 whitespace-nowrap">
          {isOpen ? "Hide" : "Tasks"}
        </div>
        {unscheduledTasks.length > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#3B82F6] rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">
              {unscheduledTasks.length}
            </span>
          </div>
        )}
      </button>

      {/* Side Panel */}
      <div
        className={`fixed left-16 top-0 h-full w-80 bg-[#0a0a0a] border-r border-[#1a1a1a] z-30 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-[#1a1a1a]">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-semibold text-white">
                  Unscheduled Tasks
                </h2>
                <span className="bg-[#2a2a2a] text-[#a1a1a1] text-xs px-2 py-1 rounded-full">
                  {unscheduledTasks.length}
                </span>
              </div>
              <button
                onClick={onToggle}
                className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-[#a1a1a1] hover:text-white" />
              </button>
            </div>
            <p className="text-[#666666] text-sm mt-1">
              Drag tasks to any day and time to schedule them
            </p>
            <div className="text-xs text-[#3B82F6] mt-2 bg-[#3B82F6]/10 px-2 py-1 rounded">
              💡 Drop on specific time slots to set exact schedule
            </div>
          </div>

          {/* Tasks List */}
          <div className="flex-1 overflow-y-auto p-4">
            <SortableContext
              items={unscheduledTasks.map((task) => `sidebar-${task.id}`)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {unscheduledTasks.map((task) => (
                  <SidebarTask
                    key={`sidebar-${task.id}`}
                    task={task}
                    availableTags={availableTags}
                  />
                ))}
                {unscheduledTasks.length === 0 && (
                  <div className="text-center py-8 text-[#666666]">
                    <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>All tasks are scheduled!</p>
                    <p className="text-xs mt-1">
                      Create new tasks to see them here
                    </p>
                  </div>
                )}
              </div>
            </SortableContext>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20"
          onClick={onToggle}
        ></div>
      )}
    </>
  );
}

// Droppable Day Column Component
function DayColumn({
  date,
  hour,
  tasks,
  availableTags,
  onTimeSlotClick,
  onTaskEdit,
}) {
  // Create slot ID without timezone conversion
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0"); // getMonth() is 0-11
  const day = date.getDate().toString().padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;
  const slotId = `${dateStr}-${hour}`;

  const { isOver, setNodeRef } = useDroppable({
    id: slotId,
  });

  const timeLabel = `${hour.toString().padStart(2, "0")}:00`;
  const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
  const dayDate = date.getDate();

  // Debug when this column is being hovered
  if (isOver) {
    console.log(`🎯 COLUMN ${dayName} ${dayDate} HOUR ${hour} IS ACTIVE:`, {
      dateObj: date.toLocaleDateString(),
      dateStr: dateStr,
      slotId: slotId,
      visualDay: `${dayName} ${dayDate}`,
      hour: hour,
      timeLabel: timeLabel,
      actualDateParts: { year, month, day },
    });
  }

  return (
    <div
      ref={setNodeRef}
      className={`relative border-l border-[#2d2d2d]/50 hover:bg-[#0a0a0a] transition-all duration-200 cursor-pointer min-h-[60px] ${
        isOver ? "bg-[#3B82F6]/15 border-l-4 border-l-[#3B82F6] shadow-lg" : ""
      }`}
      onClick={() => onTimeSlotClick(date, hour)}
    >
      {/* Existing tasks in this slot */}
      {tasks.map((task) => (
        <CalendarTask
          key={task.id}
          task={task}
          availableTags={availableTags}
          onEdit={onTaskEdit}
          onResize={() => {}} // TODO: Implement resize
        />
      ))}

      {/* Drop zone overlay */}
      {isOver && (
        <>
          {/* Console log the exact drop zone being targeted */}
          {console.log(`🎯 HOVERING DROP ZONE:`, {
            slotId: slotId,
            targetDate: dateStr,
            targetHour: hour,
            targetDay: dayName,
            targetDayDate: dayDate,
            fullDateString: date.toISOString(),
            localDateString: date.toLocaleDateString(),
          })}
          <div className="absolute inset-0 border-2 border-dashed border-[#3B82F6] rounded-lg bg-[#3B82F6]/15 flex flex-col items-center justify-center backdrop-blur-sm z-10 animate-pulse">
            <span className="text-[#3B82F6] text-sm font-bold">
              📅 Drop to Schedule
            </span>
            <span className="text-white text-xs mt-1 font-medium bg-[#3B82F6]/20 px-2 py-1 rounded">
              {dayName} {dayDate} at {timeLabel}
            </span>
            <span className="text-[#3B82F6] text-xs mt-1 opacity-75">
              Slot ID: {slotId}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// Calendar Task Component
function CalendarTask({ task, availableTags, onEdit, onResize }) {
  // Parse the stored time explicitly to avoid timezone conversion
  let startTime;

  if (task.start_time.includes(" ")) {
    // New format: "YYYY-MM-DD HH:MM:SS" - parse explicitly
    const [datePart, timePart] = task.start_time.split(" ");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute, second] = timePart.split(":").map(Number);
    startTime = new Date(year, month - 1, day, hour, minute, second);

    console.log(`🖼️ DISPLAYING TASK "${task.title}":`, {
      storedTime: task.start_time,
      parsedParts: { year, month, day, hour, minute, second },
      createdDate: startTime.toLocaleString(),
      displayHour: startTime.getHours(),
      expectedHour: hour,
      hourDifference: startTime.getHours() - hour,
    });
  } else {
    // Fallback for old format
    const timeStr = task.start_time.replace(/[Z+].*$/, "");
    startTime = new Date(timeStr);
    console.log(
      `🖼️ OLD FORMAT TASK "${
        task.title
      }": ${timeStr} → ${startTime.toLocaleString()}, Hour: ${startTime.getHours()}`
    );
  }

  const topPosition = (startTime.getHours() + startTime.getMinutes() / 60) * 60; // 60px per hour
  const height = Math.max(((task.duration_minutes || 60) / 60) * 60, 30); // Min 30px height

  // Debug CSS positioning
  console.log(`📐 CSS POSITIONING "${task.title}":`, {
    storedTime: task.start_time,
    parsedHour: startTime.getHours(),
    parsedMinutes: startTime.getMinutes(),
    calculatedTopPosition: topPosition,
    expectedVisualSlot: `${startTime
      .getHours()
      .toString()
      .padStart(2, "0")}:00`,
    shouldAppearAt: `${topPosition}px from top`,
  });

  const getTaskColor = () => {
    if (task.tags && task.tags.length > 0) {
      const firstTag = task.tags[0];
      const tagInfo = availableTags.find((tag) => tag.name === firstTag);
      return tagInfo?.color || "#3B82F6";
    }
    return "#3B82F6";
  };

  const taskColor = getTaskColor();

  return (
    <div
      className="absolute left-1 right-1 rounded-lg p-2 cursor-pointer group overflow-hidden"
      style={{
        top: `${topPosition}px`,
        height: `${height}px`,
        backgroundColor: `${taskColor}25`,
        borderLeft: `3px solid ${taskColor}`,
        border: `1px solid ${taskColor}40`,
      }}
      onClick={() => onEdit(task)}
    >
      <div className="flex flex-col h-full">
        <h4 className="text-white text-xs font-medium truncate">
          {task.title}
        </h4>
        <div className="flex items-center space-x-1 text-xs text-[#a1a1a1] mt-1">
          <Clock className="w-3 h-3" />
          <span>
            {Math.round(((task.duration_minutes || 60) / 60) * 10) / 10}h
          </span>
        </div>
        {task.tags && task.tags.length > 0 && (
          <div className="flex items-center space-x-1 mt-1">
            <Tag className="w-3 h-3 text-[#666666]" />
            <span className="text-xs text-[#666666] truncate">
              {task.tags.slice(0, 2).join(", ")}
            </span>
          </div>
        )}

        {/* Resize handle */}
        <div
          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 bg-gradient-to-t from-black/20 to-transparent"
          onMouseDown={(e) => onResize(e, task)}
        ></div>
      </div>
    </div>
  );
}

// Task Creation Modal
function TaskModal({
  isOpen,
  onClose,
  onSave,
  selectedSlot,
  availableTags,
  editingTask,
}) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    tags: [],
    duration_minutes: 60,
  });
  const [selectedTagId, setSelectedTagId] = useState("");

  useEffect(() => {
    if (editingTask) {
      setFormData({
        title: editingTask.title,
        description: editingTask.description || "",
        tags: editingTask.tags || [],
        duration_minutes: editingTask.duration_minutes || 60,
      });
    } else if (selectedSlot) {
      setFormData({
        title: "",
        description: "",
        tags: [],
        duration_minutes: 60,
      });
    }
  }, [editingTask, selectedSlot]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    const taskData = {
      ...formData,
      start_time: editingTask
        ? editingTask.start_time
        : selectedSlot.start_time,
      is_scheduled: true,
    };

    onSave(taskData);
    setFormData({ title: "", description: "", tags: [], duration_minutes: 60 });
    setSelectedTagId("");
  };

  const addTag = () => {
    if (selectedTagId && availableTags.length > 0) {
      const selectedTag = availableTags.find(
        (tag) => tag.id.toString() === selectedTagId
      );
      if (selectedTag && !formData.tags.includes(selectedTag.name)) {
        setFormData({
          ...formData,
          tags: [...formData.tags, selectedTag.name],
        });
        setSelectedTagId("");
      }
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tag) => tag !== tagToRemove),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg w-full max-w-md">
        {/* Header */}
        <div className="p-6 border-b border-[#2d2d2d]">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">
              {editingTask ? "Edit Task" : "Schedule Task"}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-[#a1a1a1] hover:text-white" />
            </button>
          </div>
          {selectedSlot && !editingTask && (
            <p className="text-[#a1a1a1] text-sm mt-2">
              {selectedSlot.date.toLocaleDateString()} at {selectedSlot.time}
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
              className="w-full px-3 py-2 rounded-lg border border-[#2d2d2d] bg-[#0a0a0a] text-white placeholder-[#666666] focus:border-[#3a3a3a] focus:outline-none"
              placeholder="What needs to be done?"
              required
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-[#a1a1a1] mb-2">
              Duration
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[30, 60, 90, 120].map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, duration_minutes: minutes })
                  }
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    formData.duration_minutes === minutes
                      ? "bg-[#3B82F6] text-white"
                      : "bg-[#2a2a2a] text-[#a1a1a1] hover:bg-[#3a3a3a]"
                  }`}
                >
                  {minutes === 30 ? "30m" : `${minutes / 60}h`}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={formData.duration_minutes}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  duration_minutes: parseInt(e.target.value) || 60,
                })
              }
              className="w-full px-3 py-2 rounded-lg border border-[#2d2d2d] bg-[#0a0a0a] text-white mt-2 focus:border-[#3a3a3a] focus:outline-none"
              placeholder="Custom duration in minutes"
              min="15"
              max="480"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#a1a1a1] mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-[#2d2d2d] bg-[#0a0a0a] text-white placeholder-[#666666] focus:border-[#3a3a3a] focus:outline-none resize-none"
              placeholder="Add details..."
              rows="3"
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
                  if (tagId) {
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
                className="flex-1 px-3 py-2 rounded-lg border border-[#2d2d2d] bg-[#0a0a0a] text-white focus:border-[#3a3a3a] focus:outline-none"
              >
                <option value="">Add a tag...</option>
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
            </div>

            {/* Display current tags */}
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tagName, index) => {
                  const tagInfo = availableTags.find((t) => t.name === tagName);
                  const bgColor = tagInfo?.color
                    ? `${tagInfo.color}30`
                    : "#8B5CF630";
                  const textColor = tagInfo?.color || "#8B5CF6";
                  return (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium"
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
                        className="ml-2 opacity-70 hover:opacity-100"
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
              onClick={onClose}
              className="px-4 py-2 text-[#a1a1a1] hover:bg-[#2a2a2a] border border-[#2d2d2d] rounded-lg transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-[#1e1e1e] border border-[#2d2d2d] text-white rounded-lg hover:bg-[#2a2a2a] hover:border-[#3a3a3a] transition-all duration-200 font-medium"
            >
              {editingTask ? "Update Task" : "Schedule Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Main Calendar Page
export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [allTasks, setAllTasks] = useState([]);
  const [activeTask, setActiveTask] = useState(null);

  const weekDates = getWeekDates(currentDate);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchTasks();
    fetchAllTasks();
    fetchAvailableTags();
  }, [currentDate]);

  const fetchTasks = async () => {
    try {
      setLoading(true);

      // Fetch ALL scheduled tasks, then filter on the frontend
      // This avoids timezone issues with database date filtering
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("is_scheduled", true)
        .order("start_time", { ascending: true });

      if (error) {
        console.error("Error fetching calendar tasks:", error);
        setTasks([]);
      } else {
        // Filter tasks for current week on frontend
        const weekTasks = (data || []).filter((task) => {
          if (!task.start_time) return false;

          // Parse stored time explicitly to avoid timezone conversion
          let taskDate;
          if (task.start_time.includes(" ")) {
            // New format: "YYYY-MM-DD HH:MM:SS" - parse explicitly
            const [datePart, timePart] = task.start_time.split(" ");
            const [year, month, day] = datePart.split("-").map(Number);
            const [hour, minute, second] = timePart.split(":").map(Number);
            taskDate = new Date(year, month - 1, day, hour, minute, second);
          } else {
            // Fallback for old format
            const timeStr = task.start_time.replace(/[Z+].*$/, "");
            taskDate = new Date(timeStr);
          }

          // Check if task falls within the current week
          const isInWeek = weekDates.some(
            (weekDate) => taskDate.toDateString() === weekDate.toDateString()
          );

          return isInWeek;
        });

        setTasks(weekTasks);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllTasks = async () => {
    try {
      // Fetch all tasks for sidebar (unscheduled ones)
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching all tasks:", error);
      } else {
        setAllTasks(data || []);
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

  const handleTimeSlotClick = (date, hour) => {
    // Create time in local timezone to avoid UTC conversion issues
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // getMonth() returns 0-11, we need 1-12
    const day = date.getDate();

    // Create a timestamp string without timezone
    const localTimeString = `${year}-${month.toString().padStart(2, "0")}-${day
      .toString()
      .padStart(2, "0")} ${hour.toString().padStart(2, "0")}:00:00`;

    setSelectedSlot({
      start_time: localTimeString,
      date: date,
      time: `${hour.toString().padStart(2, "0")}:00`,
    });
    setEditingTask(null);
    setShowTaskModal(true);
  };

  const handleTaskEdit = (task) => {
    setEditingTask(task);
    setSelectedSlot(null);
    setShowTaskModal(true);
  };

  const handleDragStart = (event) => {
    const { active } = event;

    // Check if dragging from sidebar
    if (active.id.toString().startsWith("sidebar-")) {
      const taskId = parseInt(active.id.toString().replace("sidebar-", ""));
      const task = allTasks.find((t) => t.id === taskId);
      setActiveTask(task);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    // Check if dragging from sidebar to calendar slot
    if (active.id.toString().startsWith("sidebar-")) {
      const taskId = parseInt(active.id.toString().replace("sidebar-", ""));
      const task = allTasks.find((t) => t.id === taskId);

      if (task && over.id.toString().includes("-")) {
        // Parse time slot ID (YYYY-MM-DD-hour)
        const parts = over.id.toString().split("-");
        const hour = parseInt(parts[parts.length - 1]); // Last part is the hour
        const dateStr = parts.slice(0, -1).join("-"); // Everything except last part is the date

        // Create the exact target date and time in local timezone
        // Parse the date string and add the time in local timezone
        const [year, month, day] = dateStr.split("-").map(Number);

        // Create a timestamp string that won't be timezone converted
        // Store as YYYY-MM-DD HH:MM:SS format (PostgreSQL timestamp without timezone)
        const localTimeString = `${year}-${month
          .toString()
          .padStart(2, "0")}-${day.toString().padStart(2, "0")} ${hour
          .toString()
          .padStart(2, "0")}:00:00`;

        // Calculate display info from parsed parts
        const targetDate = new Date(year, month - 1, day);
        const dayName = targetDate.toLocaleDateString("en-US", {
          weekday: "short",
        });

        console.log(`💾 SAVING TASK:`, {
          originalTask: task.title,
          dropZone: over.id,
          parsedParts: { year, month, day, hour },
          dateStr: dateStr,
          finalTimeString: localTimeString,
          whatShouldDisplay: `${dayName} ${day} at ${hour}:00`,
        });

        // Optimistic update - update UI immediately
        const updatedTask = {
          ...task,
          start_time: localTimeString,
          duration_minutes: task.duration_minutes || 60,
          is_scheduled: true,
        };

        // Update local state immediately (no refresh)
        setAllTasks((prevTasks) =>
          prevTasks.map((t) => (t.id === taskId ? updatedTask : t))
        );
        setTasks((prevTasks) => [...prevTasks, updatedTask]);

        // Schedule the task in database
        try {
          const updateData = {
            start_time: localTimeString,
            duration_minutes: task.duration_minutes || 60,
            is_scheduled: true,
          };

          const { error } = await supabase
            .from("tasks")
            .update(updateData)
            .eq("id", taskId);

          if (error) {
            console.error("❌ Error:", error.message);
            // Revert optimistic update on error
            setAllTasks((prevTasks) =>
              prevTasks.map((t) => (t.id === taskId ? task : t))
            );
            setTasks((prevTasks) => prevTasks.filter((t) => t.id !== taskId));
            alert("Failed to schedule task. Please try again.");
          } else {
            // Show success feedback without refresh
            const successDate = new Date(year, month - 1, day); // Create date from parsed parts
            const dayName = successDate.toLocaleDateString("en-US", {
              weekday: "short",
            });
            const toast = document.createElement("div");
            toast.className =
              "fixed top-4 right-4 bg-[#10B981] text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300";
            toast.innerHTML = `✅ "${
              task.title
            }" scheduled for ${dayName} ${hour.toString().padStart(2, "0")}:00`;
            document.body.appendChild(toast);

            console.log(`✅ TASK SCHEDULED SUCCESSFULLY:`, {
              taskTitle: task.title,
              savedTimeString: localTimeString,
              targetDay: dayName,
              targetHour: hour,
              shouldAppearAt: `${dayName} ${hour}:00`,
            });

            // Remove toast after 3 seconds
            setTimeout(() => {
              toast.style.opacity = "0";
              setTimeout(() => document.body.removeChild(toast), 300);
            }, 3000);
          }
        } catch (error) {
          console.error("❌ Exception:", error);
          // Revert optimistic update on error
          setAllTasks((prevTasks) =>
            prevTasks.map((t) => (t.id === taskId ? task : t))
          );
          setTasks((prevTasks) => prevTasks.filter((t) => t.id !== taskId));
          alert("Failed to schedule task. Please try again.");
        }
      }
    }
  };

  const handleTaskSave = async (taskData) => {
    setSaving(true);
    try {
      if (editingTask) {
        // Update existing task
        const updatedTask = { ...editingTask, ...taskData };

        // Optimistic update
        setTasks((prevTasks) =>
          prevTasks.map((t) => (t.id === editingTask.id ? updatedTask : t))
        );
        setAllTasks((prevTasks) =>
          prevTasks.map((t) => (t.id === editingTask.id ? updatedTask : t))
        );

        const { error } = await supabase
          .from("tasks")
          .update(taskData)
          .eq("id", editingTask.id);

        if (error) {
          console.error("Error updating task:", error);
          // Revert on error
          setTasks((prevTasks) =>
            prevTasks.map((t) => (t.id === editingTask.id ? editingTask : t))
          );
          setAllTasks((prevTasks) =>
            prevTasks.map((t) => (t.id === editingTask.id ? editingTask : t))
          );
        }
      } else {
        // Create new task
        const newTask = {
          ...taskData,
          status: "todo",
          completed: false,
          id: Date.now(), // Temporary ID for optimistic update
        };

        // Optimistic update
        if (taskData.is_scheduled) {
          setTasks((prevTasks) => [...prevTasks, newTask]);
        } else {
          setAllTasks((prevTasks) => [...prevTasks, newTask]);
        }

        const { data, error } = await supabase
          .from("tasks")
          .insert([{ ...taskData, status: "todo", completed: false }])
          .select()
          .single();

        if (error) {
          console.error("Error creating task:", error);
          // Revert optimistic update
          if (taskData.is_scheduled) {
            setTasks((prevTasks) =>
              prevTasks.filter((t) => t.id !== newTask.id)
            );
          } else {
            setAllTasks((prevTasks) =>
              prevTasks.filter((t) => t.id !== newTask.id)
            );
          }
        } else {
          // Replace temporary task with real one
          if (taskData.is_scheduled) {
            setTasks((prevTasks) =>
              prevTasks.map((t) => (t.id === newTask.id ? data : t))
            );
          } else {
            setAllTasks((prevTasks) =>
              prevTasks.map((t) => (t.id === newTask.id ? data : t))
            );
          }
        }
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setSaving(false);
      setShowTaskModal(false);
      setEditingTask(null);
      setSelectedSlot(null);
    }
  };

  const navigateWeek = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction * 7);
    setCurrentDate(newDate);
    // Only refresh when changing weeks
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    // Only refresh when going to today
  };

  const getTasksForDay = (date) => {
    return tasks.filter((task) => {
      if (!task.start_time) return false;

      // Parse stored time explicitly to avoid timezone conversion
      let taskDate;
      if (task.start_time.includes(" ")) {
        // New format: "YYYY-MM-DD HH:MM:SS" - parse explicitly
        const [datePart, timePart] = task.start_time.split(" ");
        const [year, month, day] = datePart.split("-").map(Number);
        const [hour, minute, second] = timePart.split(":").map(Number);
        taskDate = new Date(year, month - 1, day, hour, minute, second);
      } else {
        // Fallback for old format
        const timeStr = task.start_time.replace(/[Z+].*$/, "");
        taskDate = new Date(timeStr);
      }

      return taskDate.toDateString() === date.toDateString();
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-2 border-[#a1a1a1] border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-white text-lg font-medium">Loading Calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Wrap everything in DndContext */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Task Sidebar */}
        <TaskSidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          tasks={allTasks}
          availableTags={availableTags}
        />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <h1 className="text-3xl font-bold text-white">Calendar</h1>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => navigateWeek(-1)}
                  className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-[#a1a1a1] hover:text-white" />
                </button>
                <button
                  onClick={goToToday}
                  className="px-3 py-2 bg-[#1e1e1e] border border-[#2d2d2d] text-white rounded-lg hover:bg-[#2a2a2a] hover:border-[#3a3a3a] transition-all duration-200 text-sm font-medium"
                >
                  Today
                </button>
                <button
                  onClick={() => navigateWeek(1)}
                  className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-[#a1a1a1] hover:text-white" />
                </button>
              </div>
            </div>
            <div className="text-[#a1a1a1] text-lg">
              {weekDates[0].toLocaleDateString()} -{" "}
              {weekDates[6].toLocaleDateString()}
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg overflow-hidden">
            {/* Days Header */}
            <div className="grid grid-cols-8 border-b border-[#2d2d2d]">
              <div className="p-4 text-center text-[#a1a1a1] text-sm font-medium">
                Time
              </div>
              {weekDates.map((date, index) => {
                const isToday =
                  date.toDateString() === new Date().toDateString();
                const dayName = date.toLocaleDateString("en-US", {
                  weekday: "short",
                });
                const dayNumber = date.getDate();

                return (
                  <div
                    key={index}
                    className={`p-4 text-center border-l border-[#2d2d2d] transition-all duration-200 ${
                      isToday ? "bg-[#3B82F6]/10" : ""
                    }`}
                  >
                    <div className="text-[#a1a1a1] text-sm font-medium">
                      {dayName}
                    </div>
                    <div
                      className={`text-lg font-bold mt-1 ${
                        isToday ? "text-[#3B82F6]" : "text-white"
                      }`}
                    >
                      {dayNumber}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time Grid */}
            <div className="relative">
              {timeSlots.map((slot) => (
                <div
                  key={slot.hour}
                  className="grid grid-cols-8 border-b border-[#2d2d2d]/50 h-[60px]"
                >
                  {/* Time Label */}
                  <div className="p-2 text-center text-[#666666] text-xs font-medium border-r border-[#2d2d2d]">
                    {slot.label}
                  </div>

                  {/* Day Columns with Drop Zones */}
                  {weekDates.map((date, dayIndex) => {
                    const dayTasks = getTasksForDay(date);
                    const slotTasks = dayTasks.filter((task) => {
                      // Parse stored time explicitly to avoid timezone conversion
                      let taskStart;
                      if (task.start_time.includes(" ")) {
                        // New format: "YYYY-MM-DD HH:MM:SS" - parse explicitly
                        const [datePart, timePart] = task.start_time.split(" ");
                        const [year, month, day] = datePart
                          .split("-")
                          .map(Number);
                        const [hour, minute, second] = timePart
                          .split(":")
                          .map(Number);
                        taskStart = new Date(
                          year,
                          month - 1,
                          day,
                          hour,
                          minute,
                          second
                        );
                      } else {
                        // Fallback for old format
                        const timeStr = task.start_time.replace(/[Z+].*$/, "");
                        taskStart = new Date(timeStr);
                      }
                      return taskStart.getHours() === slot.hour;
                    });

                    return (
                      <DayColumn
                        key={`${dayIndex}-${slot.hour}`}
                        date={date}
                        hour={slot.hour}
                        tasks={slotTasks}
                        availableTags={availableTags}
                        onTimeSlotClick={handleTimeSlotClick}
                        onTaskEdit={handleTaskEdit}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Drag Overlay */}
          <DragOverlay
            dropAnimation={{
              duration: 200,
              easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
            }}
          >
            {activeTask ? (
              <div className="bg-[#1a1a1a] border-2 border-[#3B82F6] rounded-lg p-3 shadow-2xl transform rotate-1 scale-105 backdrop-blur-sm">
                <div className="absolute inset-0 bg-gradient-to-br from-[#3B82F6]/10 to-transparent rounded-lg pointer-events-none"></div>
                <div className="relative z-10">
                  <div className="flex items-start space-x-3">
                    <GripVertical className="w-4 h-4 text-[#3B82F6] mt-1" />
                    <div className="flex-1">
                      <h4 className="text-white font-medium text-sm line-clamp-1">
                        {activeTask.title}
                      </h4>
                      <div className="flex items-center space-x-2 mt-1">
                        {activeTask.tags && activeTask.tags.length > 0 && (
                          <div className="flex items-center space-x-1">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{
                                backgroundColor:
                                  availableTags.find(
                                    (tag) => tag.name === activeTask.tags[0]
                                  )?.color || "#3B82F6",
                              }}
                            ></div>
                            <span className="text-xs text-[#a1a1a1]">
                              {activeTask.tags[0]}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center space-x-1 text-xs text-[#a1a1a1]">
                          <Clock className="w-3 h-3" />
                          <span>
                            {Math.round(
                              ((activeTask.duration_minutes || 60) / 60) * 10
                            ) / 10}
                            h
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-[#3B82F6] font-medium mt-1">
                        📅 Drag to schedule
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>

          {/* Task Modal */}
          <TaskModal
            isOpen={showTaskModal}
            onClose={() => {
              setShowTaskModal(false);
              setEditingTask(null);
              setSelectedSlot(null);
            }}
            onSave={handleTaskSave}
            selectedSlot={selectedSlot}
            availableTags={availableTags}
            editingTask={editingTask}
          />
        </div>
      </DndContext>
    </div>
  );
}
