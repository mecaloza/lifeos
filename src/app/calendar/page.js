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
  Users,
  Eye,
  EyeOff,
  Check,
  CheckCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import PersonalOutlookSync from "@/components/PersonalOutlookSync";
import GoogleCalendarSync from "@/components/GoogleCalendarSync";
import { autoSyncManager } from "@/lib/autoSync";

// Time utilities - Start from 4:00 AM (hide late night hours)
const timeSlots = Array.from({ length: 20 }, (_, i) => ({
  hour: i + 4, // Start from hour 4: 04:00-23:00
  label: `${(i + 4).toString().padStart(2, "0")}:00`,
}));

const getWeekDates = (currentDate) => {
  const startOfWeek = new Date(currentDate);
  const day = startOfWeek.getDay();
  // Calculate Monday as start of week (Monday = 1, so subtract (day-1) to get to Monday)
  // If day is 0 (Sunday), we need to go back 6 days to get to Monday
  const diff = day === 0 ? -6 : -(day - 1);
  startOfWeek.setDate(startOfWeek.getDate() + diff);

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
    const tags = task.tags || [];

    // Per-account distinct colors
    const emailTag = tags.find((t) => t.startsWith("Google: ") || t.startsWith("Outlook: "));
    if (emailTag) {
      const email = emailTag.split(": ")[1]?.toLowerCase() || "";
      if (email.includes("lozadagiraldo")) return "#E85D04";  // Orange
      if (email.includes("iot4a"))         return "#34A853";  // Green
      if (email.includes("actionblack"))   return "#0078D4";  // Blue
      // Any other account — purple
      return "#8B5CF6";
    }

    // Fallback: source-level colors
    if (tags.includes("Outlook")) return "#0078D4";
    if (tags.includes("Google Calendar")) return "#34A853";

    // Tag-based color
    if (tags.length > 0) {
      const firstTag = tags[0];
      const tagInfo = availableTags.find((tag) => tag.name === firstTag);
      return tagInfo?.color || "#3B82F6";
    }
    return "#3B82F6"; // Default blue for manual tasks
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
          <div className="flex items-center space-x-1.5 mb-1">
            <h4 className="text-white font-medium text-sm line-clamp-1 flex-1">
              {task.title}
            </h4>
            {task.is_group && (
              <span className="bg-[#8B5CF6]/30 text-[#8B5CF6] text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                {(task.subtask_count || 0) + 1}
              </span>
            )}
          </div>
          {task.description && (
            <p className="text-[#a1a1a1] text-xs line-clamp-2 mb-2">
              {task.description}
            </p>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {/* Status badge */}
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                task.status === "in_progress"
                  ? "bg-[#F59E0B]/20 text-[#F59E0B]"
                  : task.status === "waiting"
                  ? "bg-[#8B5CF6]/20 text-[#8B5CF6]"
                  : "bg-[#3B82F6]/20 text-[#3B82F6]"
              }`}>
                {task.status === "in_progress" ? "In Progress" : task.status === "waiting" ? "Waiting" : "To Do"}
              </span>
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
  const [hideDelegated, setHideDelegated] = useState(true);
  
  // Statuses that can be scheduled on the calendar
  const schedulableStatuses = ["todo", "in_progress", "waiting"];

  // Filter unscheduled tasks: todo + in_progress + waiting, not already scheduled
  // EXCLUDE Outlook/Google events, child tasks, and completed/backlog
  const unscheduledTasks = tasks.filter((task) => {
    // Must be unscheduled
    if (task.is_scheduled) return false;
    // SKIP child tasks - they belong to a group
    if (task.parent_task_id) return false;
    // SKIP calendar events (Outlook/Google) - they are meetings, not tasks
    if (task.source && task.source !== "manual") return false;
    // Hide delegated tasks by default
    if (hideDelegated && task.is_delegated) return false;
    // Show tasks in todo, in_progress, or waiting statuses
    if (!schedulableStatuses.includes(task.status)) return false;
    return true;
  });

  // Count delegated unscheduled tasks (exclude Outlook and child tasks)
  const delegatedCount = tasks.filter(
    (task) => !task.is_scheduled && task.is_delegated && schedulableStatuses.includes(task.status) && (!task.source || task.source === "manual") && !task.parent_task_id
  ).length;
  
  // Count tasks in other statuses like backlog (for info, exclude Outlook and child tasks)
  const otherStatusCount = tasks.filter(
    (task) => !task.is_scheduled && !task.is_delegated && !schedulableStatuses.includes(task.status) && task.status !== "done" && (!task.source || task.source === "manual") && !task.parent_task_id
  ).length;

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
                  Tasks
                </h2>
                <span className="bg-[#3B82F6]/20 text-[#3B82F6] text-xs px-2 py-1 rounded-full font-medium">
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
            
            <p className="text-[#666666] text-xs mt-2">
              To Do, In Progress & Waiting • Not scheduled
            </p>
            
            {/* Delegated Tasks Filter */}
            {delegatedCount > 0 && (
              <button
                onClick={() => setHideDelegated(!hideDelegated)}
                className={`mt-3 w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-sm ${
                  hideDelegated
                    ? "bg-[#1a1a1a] border-[#2d2d2d] text-[#a1a1a1] hover:border-[#3a3a3a]"
                    : "bg-orange-500/20 border-orange-500/50 text-orange-400"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4" />
                  <span>+ Delegated</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="bg-[#2a2a2a] px-2 py-0.5 rounded text-xs">
                    {delegatedCount}
                  </span>
                  {hideDelegated ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </div>
              </button>
            )}
            
            {/* Info about other tasks */}
            {otherStatusCount > 0 && (
              <div className="mt-2 text-xs text-[#666666] bg-[#1a1a1a] px-2 py-1 rounded">
                {otherStatusCount} tasks in other statuses (backlog, in progress, etc.)
              </div>
            )}
            
            <div className="text-xs text-[#3B82F6] mt-3 bg-[#3B82F6]/10 px-2 py-1 rounded">
              💡 Drag to schedule on calendar
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
                    <p>No &quot;To Do&quot; tasks to schedule</p>
                    <p className="text-xs mt-1">
                      Move tasks to &quot;To Do&quot; status in Kanban
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
  onTaskResize,
  onMarkDone,
  allTasks,
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

  return (
    <div
      ref={setNodeRef}
      className={`relative border-l border-[#2d2d2d]/50 transition-all duration-200 cursor-pointer min-h-[60px] ${
        isOver ? "bg-[#3B82F6]/15 border-l-4 border-l-[#3B82F6] shadow-lg" : ""
      } ${tasks.length > 0 ? "" : "hover:bg-[#0a0a0a]"}`}
      onClick={() => onTimeSlotClick(date, hour)}
    >
      {/* Existing tasks in this slot - side by side layout */}
      {tasks.map((task, index) => {
        const childTasks = task.is_group && allTasks
          ? allTasks.filter(t => t.parent_task_id === task.id)
          : [];
        return (
          <CalendarTask
            key={task.id}
            task={task}
            availableTags={availableTags}
            onEdit={onTaskEdit}
            onTaskResize={onTaskResize}
            onMarkDone={onMarkDone}
            taskIndex={index}
            totalTasks={tasks.length}
            childTasks={childTasks}
          />
        );
      })}

      {/* Drop zone overlay */}
      {isOver && (
        <div className="absolute inset-0 border-2 border-dashed border-[#3B82F6] rounded-lg bg-[#3B82F6]/15 flex flex-col items-center justify-center backdrop-blur-sm z-10 animate-pulse">
          <span className="text-[#3B82F6] text-sm font-bold">
            📅 Drop to Schedule
          </span>
          <span className="text-white text-xs mt-1 font-medium bg-[#3B82F6]/20 px-2 py-1 rounded">
            {dayName} {dayDate} at {timeLabel}
          </span>
        </div>
      )}
    </div>
  );
}

// Calendar Task Component
function CalendarTask({
  task,
  availableTags,
  onEdit,
  onTaskResize,
  onMarkDone,
  taskIndex = 0,
  totalTasks = 1,
  childTasks = [],
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `calendar-${task.id}` });
  // Parse the stored time explicitly to avoid timezone conversion
  let startTime;

  if (task.start_time.includes(" ")) {
    // New format: "YYYY-MM-DD HH:MM:SS" - parse explicitly
    const [datePart, timePart] = task.start_time.split(" ");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute, second] = timePart.split(":").map(Number);
    startTime = new Date(year, month - 1, day, hour, minute, second);
  } else {
    // Fallback for old format
    const timeStr = task.start_time.replace(/[Z+].*$/, "");
    startTime = new Date(timeStr);
  }

  // Position within the hour slot: minutes offset (0-59px in a 60px slot)
  const topPosition = startTime.getMinutes();

  // Height calculation - 60px per hour, allow short events
  const rawHeight = ((task.duration_minutes || 60) / 60) * 60; // 60px per hour
  const height = Math.max(rawHeight, 18); // Min 18px for very short events (e.g. 15min = 15px)

  const getTaskColor = () => {
    const tags = task.tags || [];

    // Per-account distinct colors
    const emailTag = tags.find((t) => t.startsWith("Google: ") || t.startsWith("Outlook: "));
    if (emailTag) {
      const email = emailTag.split(": ")[1]?.toLowerCase() || "";
      if (email.includes("lozadagiraldo")) return "#E85D04";  // Orange
      if (email.includes("iot4a"))         return "#34A853";  // Green
      if (email.includes("actionblack"))   return "#0078D4";  // Blue
      // Any other account — purple
      return "#8B5CF6";
    }

    // Fallback: source-level colors
    if (tags.includes("Outlook")) return "#0078D4";
    if (tags.includes("Google Calendar")) return "#34A853";

    // Tag-based color
    if (tags.length > 0) {
      const firstTag = tags[0];
      const tagInfo = availableTags.find((tag) => tag.name === firstTag);
      return tagInfo?.color || "#3B82F6";
    }
    return "#3B82F6"; // Default blue for manual tasks
  };

  const taskColor = getTaskColor();

  // Calculate side-by-side positioning for multiple events
  const taskWidth = totalTasks > 1 ? 98 / totalTasks : 96; // 98% total to leave margins
  const leftPosition = totalTasks > 1 ? 1 + taskIndex * (98 / totalTasks) : 2; // Start at 1% + spacing

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCompleted = task.status === "done" || task.completed;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        top: `${topPosition}px`,
        height: `${height}px`,
        left: `${leftPosition}%`,
        width: `${taskWidth}%`,
        backgroundColor: isCompleted ? `${taskColor}15` : task.is_group ? `${taskColor}20` : `${taskColor}25`,
        borderLeft: `3px solid ${isCompleted ? "#10B981" : task.is_group ? "#8B5CF6" : taskColor}`,
        border: `1px solid ${isCompleted ? "#10B98140" : task.is_group ? "#8B5CF640" : `${taskColor}40`}`,
      }}
      className={`absolute rounded-lg group overflow-hidden ${
        totalTasks > 1 ? "p-1" : "p-2"
      } ${
        isDragging
          ? "opacity-40 cursor-grabbing z-50"
          : "z-10 hover:shadow-lg cursor-pointer"
      } ${isCompleted ? "opacity-60" : ""}`}
      {...attributes}
    >
      {/* Drag handle area - click to edit */}
      <div
        className={`absolute inset-0 ${height >= 40 ? "bottom-4" : ""}`}
        {...listeners}
        onClick={(e) => {
          e.stopPropagation();
          if (!isDragging) {
            onEdit(task);
          }
        }}
      ></div>

      {/* Action Buttons - Top Right Corner */}
      <div className={`absolute top-0 right-0 flex items-center space-x-0.5 transition-all duration-200 z-30 ${
        height < 30 ? "opacity-100 p-0.5" : "opacity-0 group-hover:opacity-100 p-1"
      }`}>
        {/* Mark Done Button */}
        <button
          className={`p-1 rounded transition-all duration-200 ${
            task.status === "done" || task.completed
              ? "bg-green-500/80 hover:bg-green-600"
              : "bg-black/60 hover:bg-green-500/80"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onMarkDone(task);
          }}
          title={task.status === "done" || task.completed ? "Completed" : "Mark as done"}
        >
          {task.status === "done" || task.completed ? (
            <CheckCircle className="w-3 h-3 text-white" />
          ) : (
            <Check className="w-3 h-3 text-white" />
          )}
        </button>
        
        {/* Edit Button */}
        <button
          className="p-1 bg-black/60 hover:bg-black/80 rounded transition-all duration-200"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(task);
          }}
          title="Edit task"
        >
          <Edit className="w-3 h-3 text-white" />
        </button>
      </div>

      <div className="flex flex-col h-full justify-start">
        {/* Priority indicator and title */}
        <div className="flex items-center space-x-1 mb-0.5">
          {/* Completed checkmark or priority indicator */}
          {isCompleted ? (
            <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
          ) : (
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{
                backgroundColor:
                  {
                    urgent: "#EF4444",
                    high: "#F59E0B",
                    medium: "#3B82F6",
                    low: "#6B7280",
                  }[task.priority] || "#3B82F6",
              }}
            ></div>
          )}
          <h4
            className={`font-semibold truncate leading-tight flex-1 ${
              totalTasks > 1 ? "text-xs" : "text-xs"
            } ${isCompleted ? "line-through text-[#a1a1a1]" : "text-white"}`}
            style={{
              textShadow: "0 1px 2px rgba(0,0,0,0.8)",
              fontSize: totalTasks > 2 ? "10px" : "11px",
            }}
          >
            {task.title}
          </h4>
          {/* Group badge */}
          {task.is_group && childTasks.length > 0 && (
            <div className="bg-[#8B5CF6]/80 text-white text-xs px-1 py-0.5 rounded font-bold flex items-center space-x-0.5" title={`Group: ${childTasks.length} subtasks`}>
              <span>{childTasks.length + 1}</span>
            </div>
          )}
          {/* Urgent badge for high visibility */}
          {task.priority === "urgent" && totalTasks === 1 && (
            <div className="bg-red-500 text-white text-xs px-1 py-0.5 rounded font-bold">
              !
            </div>
          )}
        </div>

        {/* Show duration only if there's space */}
        {height > 30 && (
          <div className="flex items-center space-x-1 text-xs text-[#a1a1a1]">
            <Clock className="w-2.5 h-2.5" />
            <span className="text-xs">
              {(task.duration_minutes || 60) < 60
                ? `${task.duration_minutes}m`
                : `${Math.round(((task.duration_minutes || 60) / 60) * 10) / 10}h`}
            </span>
          </div>
        )}

        {/* Show subtasks if this is a group and there's space */}
        {task.is_group && childTasks.length > 0 && height > 45 && totalTasks === 1 && (
          <div className="mt-0.5 space-y-0.5">
            {childTasks.slice(0, height > 80 ? 3 : 1).map((child) => (
              <div key={child.id} className="flex items-center space-x-1">
                <div className="w-1 h-1 rounded-full bg-[#8B5CF6] flex-shrink-0"></div>
                <span className="text-xs text-[#a1a1a1] truncate" style={{ fontSize: "9px" }}>
                  {child.title}
                </span>
              </div>
            ))}
            {childTasks.length > (height > 80 ? 3 : 1) && (
              <span className="text-xs text-[#666666]" style={{ fontSize: "9px" }}>
                +{childTasks.length - (height > 80 ? 3 : 1)} more
              </span>
            )}
          </div>
        )}

        {/* Show tags only if there's lots of space, not crowded, and not a group */}
        {task.tags &&
          task.tags.length > 0 &&
          height > 50 &&
          totalTasks === 1 &&
          !task.is_group && (
            <div className="flex items-center space-x-1 mt-1">
              <Tag className="w-2.5 h-2.5 text-[#666666]" />
              <span className="text-xs text-[#666666] truncate">
                {task.tags.slice(0, 1).join(", ")}
              </span>
            </div>
          )}

        {/* Show task count indicator for multiple tasks */}
        {totalTasks > 1 && (
          <div className="absolute bottom-1 right-1 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">
              {taskIndex + 1}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Resize Handle - only show on tasks tall enough */}
      {height >= 40 && (
        <div
          className="absolute bottom-0 left-0 right-0 h-5 cursor-ns-resize opacity-0 group-hover:opacity-100 bg-gradient-to-t from-[#3B82F6]/60 to-transparent hover:opacity-100 transition-opacity z-50"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onTaskResize(e, task, "bottom");
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Resize indicator */}
          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-white/60 rounded-full"></div>
        </div>
      )}
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
    priority: "medium",
    start_hour: 9,
    start_minute: 0,
  });
  const [selectedTagId, setSelectedTagId] = useState("");

  useEffect(() => {
    if (editingTask) {
      // Parse hour and minute from editingTask.start_time
      // Handles "YYYY-MM-DD HH:MM:SS", "YYYY-MM-DDTHH:MM:SS", and ISO formats
      let hour = 9, minute = 0;
      if (editingTask.start_time) {
        const normalized = editingTask.start_time.replace("T", " ").replace(/[Z+].*$/, "");
        const timePart = normalized.split(" ")[1]; // "HH:MM:SS"
        if (timePart) {
          const [h, m] = timePart.split(":");
          hour = parseInt(h, 10);
          minute = parseInt(m, 10);
        }
      }
      setFormData({
        title: editingTask.title,
        description: editingTask.description || "",
        tags: editingTask.tags || [],
        duration_minutes: editingTask.duration_minutes || 60,
        priority: editingTask.priority || "medium",
        start_hour: hour,
        start_minute: minute,
      });
    } else if (selectedSlot) {
      // Parse hour from selectedSlot.time (format: "HH:00")
      let hour = 9;
      if (selectedSlot.time) {
        hour = parseInt(selectedSlot.time.split(":")[0], 10);
      }
      setFormData({
        title: "",
        description: "",
        tags: [],
        duration_minutes: 60,
        priority: "medium",
        start_hour: hour,
        start_minute: 0,
      });
    }
  }, [editingTask, selectedSlot]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    // Build start_time from date + form hour/minute
    let baseDate;
    if (editingTask && editingTask.start_time) {
      // Extract the date part - handle both "YYYY-MM-DD HH:MM:SS" and "YYYY-MM-DDTHH:MM:SS"
      baseDate = editingTask.start_time.replace("T", " ").split(" ")[0]; // "YYYY-MM-DD"
    } else if (selectedSlot && selectedSlot.start_time) {
      baseDate = selectedSlot.start_time.replace("T", " ").split(" ")[0];
    } else if (selectedSlot && selectedSlot.date) {
      const d = selectedSlot.date;
      baseDate = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
    }

    const newStartTime = `${baseDate} ${formData.start_hour.toString().padStart(2, "0")}:${formData.start_minute.toString().padStart(2, "0")}:00`;

    const { start_hour, start_minute, ...restFormData } = formData;
    const taskData = {
      ...restFormData,
      start_time: newStartTime,
      is_scheduled: true,
    };

    onSave(taskData);
    setFormData({
      title: "",
      description: "",
      tags: [],
      duration_minutes: 60,
      priority: "medium",
      start_hour: 9,
      start_minute: 0,
    });
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
      <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header - Fixed */}
        <div className="p-4 border-b border-[#2d2d2d] flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              {editingTask ? "Edit Task" : "Schedule Task"}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-[#a1a1a1] hover:text-white" />
            </button>
          </div>
          {/* Readable time summary */}
          {(() => {
            const h = formData.start_hour;
            const m = formData.start_minute;
            const dur = formData.duration_minutes;
            const endTotalMin = h * 60 + m + dur;
            const endH = Math.floor(endTotalMin / 60) % 24;
            const endM = endTotalMin % 60;
            const fmt = (hr, mn) => {
              const ampm = hr >= 12 ? "PM" : "AM";
              const h12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
              return `${h12}:${mn.toString().padStart(2, "0")} ${ampm}`;
            };
            // Get the date
            let dateStr = "";
            if (editingTask && editingTask.start_time) {
              const [datePart] = editingTask.start_time.replace("T", " ").split(" ");
              const [y, mo, d] = datePart.split("-").map(Number);
              const dateObj = new Date(y, mo - 1, d);
              dateStr = dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
            } else if (selectedSlot && selectedSlot.date) {
              dateStr = selectedSlot.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
            }
            return (
              <div className="mt-2 flex items-center space-x-2 bg-[#0a0a0a] rounded-lg px-3 py-2 border border-[#2d2d2d]">
                <CalendarIcon className="w-4 h-4 text-[#3B82F6] flex-shrink-0" />
                <div className="text-sm">
                  <span className="text-[#a1a1a1]">{dateStr}</span>
                  <span className="text-[#a1a1a1] mx-1.5">·</span>
                  <span className="text-white font-medium">{fmt(h, m)}</span>
                  <span className="text-[#a1a1a1] mx-1.5">→</span>
                  <span className="text-white font-medium">{fmt(endH, endM)}</span>
                  <span className="text-[#666] ml-2 text-xs">({dur < 60 ? `${dur}min` : dur % 60 === 0 ? `${dur / 60}h` : `${Math.floor(dur / 60)}h ${dur % 60}m`})</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Form - Scrollable */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto flex-1">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-[#a1a1a1] mb-1">
              Task Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-[#2d2d2d] bg-[#0a0a0a] text-white placeholder-[#666666] focus:border-[#3a3a3a] focus:outline-none text-sm"
              placeholder="What needs to be done?"
              required
            />
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-xs font-medium text-[#a1a1a1] mb-1">
              Starts at
            </label>
            <div className="flex items-center space-x-2">
              <select
                value={formData.start_hour}
                onChange={(e) =>
                  setFormData({ ...formData, start_hour: parseInt(e.target.value, 10) })
                }
                className="px-2 py-2 rounded-lg border border-[#2d2d2d] bg-[#0a0a0a] text-white focus:border-[#3a3a3a] focus:outline-none text-sm"
              >
                {Array.from({ length: 24 }, (_, i) => {
                  const ampm = i >= 12 ? "PM" : "AM";
                  const h12 = i === 0 ? 12 : i > 12 ? i - 12 : i;
                  return (
                    <option key={i} value={i}>
                      {h12}:00 {ampm}
                    </option>
                  );
                })}
              </select>
              <span className="text-white text-lg font-bold">:</span>
              <select
                value={formData.start_minute}
                onChange={(e) =>
                  setFormData({ ...formData, start_minute: parseInt(e.target.value, 10) })
                }
                className="px-2 py-2 rounded-lg border border-[#2d2d2d] bg-[#0a0a0a] text-white focus:border-[#3a3a3a] focus:outline-none text-sm"
              >
                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                  <option key={m} value={m}>
                    {m.toString().padStart(2, "0")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-xs font-medium text-[#a1a1a1] mb-1">
              Duration
            </label>
            <div className="grid grid-cols-5 gap-1.5 mb-1.5">
              {[15, 20, 30, 45, 60].map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, duration_minutes: minutes })
                  }
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    formData.duration_minutes === minutes
                      ? "bg-[#3B82F6] text-white"
                      : "bg-[#2a2a2a] text-[#a1a1a1] hover:bg-[#3a3a3a]"
                  }`}
                >
                  {minutes < 60 ? `${minutes}m` : "1h"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-1.5 mb-1.5">
              {[90, 120, 180, 240, 300].map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, duration_minutes: minutes })
                  }
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    formData.duration_minutes === minutes
                      ? "bg-[#3B82F6] text-white"
                      : "bg-[#2a2a2a] text-[#a1a1a1] hover:bg-[#3a3a3a]"
                  }`}
                >
                  {minutes === 90 ? "1.5h" : `${minutes / 60}h`}
                </button>
              ))}
            </div>
            {/* Custom duration input */}
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="5"
                max="480"
                value={formData.duration_minutes}
                onChange={(e) =>
                  setFormData({ ...formData, duration_minutes: Math.max(5, parseInt(e.target.value, 10) || 5) })
                }
                className="w-20 px-2 py-1.5 rounded-lg border border-[#2d2d2d] bg-[#0a0a0a] text-white focus:border-[#3a3a3a] focus:outline-none text-xs"
              />
              <span className="text-[#a1a1a1] text-xs">min</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-[#a1a1a1] mb-1">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-[#2d2d2d] bg-[#0a0a0a] text-white placeholder-[#666666] focus:border-[#3a3a3a] focus:outline-none resize-none text-sm"
              placeholder="Add details..."
              rows="2"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-[#a1a1a1] mb-1">
              Tags
            </label>
            <div className="flex flex-wrap gap-1.5">
              {availableTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    if (formData.tags.includes(tag.name)) {
                      removeTag(tag.name);
                    } else {
                      setFormData({
                        ...formData,
                        tags: [...formData.tags, tag.name],
                      });
                    }
                  }}
                  className={`px-2 py-1 rounded text-xs transition-all ${
                    formData.tags.includes(tag.name)
                      ? "ring-1 ring-offset-1 ring-offset-[#1a1a1a]"
                      : "opacity-60 hover:opacity-100"
                  }`}
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                    ringColor: formData.tags.includes(tag.name) ? tag.color : "transparent",
                  }}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-medium text-[#a1a1a1] mb-1">
              Priority
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { value: "urgent", label: "Urgent", color: "#EF4444" },
                { value: "high", label: "High", color: "#F59E0B" },
                { value: "medium", label: "Medium", color: "#3B82F6" },
                { value: "low", label: "Low", color: "#6B7280" },
              ].map((priority) => (
                <button
                  key={priority.value}
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, priority: priority.value })
                  }
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    formData.priority === priority.value
                      ? "border-current"
                      : "border-[#2d2d2d] text-[#a1a1a1] hover:border-[#3a3a3a]"
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
                  {priority.label}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-[#a1a1a1] hover:bg-[#2a2a2a] border border-[#2d2d2d] rounded-lg transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-sm bg-[#3B82F6] text-white rounded-lg hover:bg-[#2563EB] transition-all font-medium"
            >
              {editingTask ? "Update" : "Schedule"}
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
  const [currentTime, setCurrentTime] = useState(new Date());
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");

  const weekDates = getWeekDates(currentDate);

  // Update current time every minute for the time indicator
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    
    return () => clearInterval(timer);
  }, []);

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

  // Fix any calendar events (Outlook/Google) that were mistakenly unscheduled
  const fixCalendarEvents = async () => {
    try {
      // Find Outlook or Google events that are unscheduled (they should always be scheduled)
      const { data: calendarEvents, error } = await supabase
        .from("tasks")
        .select("*")
        .in("source", ["outlook", "google"])
        .eq("is_scheduled", false);

      if (error || !calendarEvents || calendarEvents.length === 0) {
        return;
      }

      console.log(`🔧 Fixing ${calendarEvents.length} calendar events that were mistakenly unscheduled`);

      // Re-schedule them
      const eventIds = calendarEvents.map(e => e.id);
      await supabase
        .from("tasks")
        .update({ is_scheduled: true })
        .in("id", eventIds);

      console.log(`✅ Fixed ${calendarEvents.length} calendar events`);
    } catch (error) {
      console.error("Error fixing calendar events:", error);
    }
  };

  // Reset past uncompleted scheduled tasks back to "To Do"
  const resetPastUncompletedTasks = async () => {
    try {
      // Get start of current week (Monday)
      const startOfWeek = new Date(weekDates[0]);
      startOfWeek.setHours(0, 0, 0, 0);
      
      console.log("🔄 Checking for past uncompleted MANUAL tasks (not Outlook meetings) before:", startOfWeek.toLocaleDateString());

      // Fetch all scheduled, uncompleted tasks
      const { data: scheduledTasks, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("is_scheduled", true)
        .eq("completed", false)
        .not("start_time", "is", null);

      if (error) {
        console.error("Error fetching scheduled tasks:", error);
        return;
      }

      // Filter tasks that are before the current week AND are manual tasks (not from Outlook)
      const pastTasks = (scheduledTasks || []).filter((task) => {
        if (!task.start_time) return false;
        
        // SKIP calendar events (Outlook/Google) - they are meetings, not tasks
        // Only reset manually created tasks (source is null, undefined, or "manual")
        if (task.source && task.source !== "manual") {
          return false;
        }
        
        // Parse the task date
        let taskDate;
        if (task.start_time.includes(" ")) {
          const [datePart] = task.start_time.split(" ");
          const [year, month, day] = datePart.split("-").map(Number);
          taskDate = new Date(year, month - 1, day);
        } else {
          const timeStr = task.start_time.replace(/[Z+].*$/, "");
          taskDate = new Date(timeStr);
        }
        
        // Check if task is before the current week
        return taskDate < startOfWeek;
      });

      if (pastTasks.length === 0) {
        console.log("✅ No past uncompleted manual tasks to reset (Outlook meetings are kept)");
        return;
      }

      console.log(`📋 Found ${pastTasks.length} past uncompleted tasks to reset:`, 
        pastTasks.map(t => t.title).slice(0, 5));

      // Update all past uncompleted tasks - unschedule them and put back in todo
      const taskIds = pastTasks.map(t => t.id);
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ 
          is_scheduled: false, 
          start_time: null,
          status: "todo"
        })
        .in("id", taskIds);

      if (updateError) {
        console.error("Error resetting past tasks:", updateError);
        return;
      }

      console.log(`✅ Reset ${pastTasks.length} past tasks back to To Do`);

      // Show notification
      const toast = document.createElement("div");
      toast.className =
        "fixed top-4 right-4 bg-[#F59E0B] text-black px-4 py-2 rounded-lg shadow-lg z-50";
      toast.innerHTML = `📋 ${pastTasks.length} uncompleted task${pastTasks.length > 1 ? 's' : ''} from past weeks moved back to To Do`;
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => document.body.removeChild(toast), 300);
      }, 4000);

    } catch (error) {
      console.error("Error in resetPastUncompletedTasks:", error);
    }
  };

  // Fetch connected accounts from server
  const fetchConnectedAccounts = async () => {
    try {
      const res = await fetch("/api/calendar/accounts");
      const data = await res.json();
      setConnectedAccounts(data.accounts || []);
    } catch (error) {
      console.error("Error fetching connected accounts:", error);
    }
  };

  // Server-side sync all connected accounts
  const handleSyncNow = async () => {
    try {
      setSyncing(true);
      setSyncStatus("Sincronizando...");

      const res = await fetch("/api/calendar/sync", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Sync failed");
      }

      const { imported, updated, synced } = data;
      if (imported > 0 || updated > 0) {
        const parts = [];
        if (imported > 0) parts.push(`${imported} nuevos`);
        if (updated > 0) parts.push(`${updated} actualizados`);
        setSyncStatus(`${parts.join(", ")} eventos sincronizados`);
      } else {
        setSyncStatus("Todo sincronizado - no hay eventos nuevos");
      }

      fetchTasks();
      fetchAllTasks();
      fetchConnectedAccounts();

      setTimeout(() => setSyncStatus(""), 5000);
    } catch (error) {
      console.error("Sync error:", error);
      setSyncStatus(`Error: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // Disconnect an account
  const handleDisconnectAccount = async (provider, email) => {
    try {
      await fetch("/api/calendar/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, email }),
      });
      fetchConnectedAccounts();
      setSyncStatus(`Desconectado: ${email}`);
      setTimeout(() => setSyncStatus(""), 3000);
    } catch (error) {
      console.error("Error disconnecting:", error);
    }
  };

  useEffect(() => {
    // First, fix any calendar events (Outlook/Google) that were mistakenly unscheduled
    // Then reset past uncompleted manual tasks, then fetch
    fixCalendarEvents().then(() => {
      return resetPastUncompletedTasks();
    }).then(() => {
      fetchTasks();
      fetchAllTasks();
    });
    fetchAvailableTags();
    fetchConnectedAccounts();

    // Handle OAuth callback URL params
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const connectedProvider = params.get("connected");
      const connectedEmail = params.get("email") || params.get("outlook_connected");
      const error = params.get("error");

      if (connectedProvider || connectedEmail) {
        const label = connectedEmail
          ? `${connectedProvider || "Outlook"}: ${connectedEmail}`
          : connectedProvider;
        setSyncStatus(`Cuenta conectada: ${label}`);
        // Clean URL
        window.history.replaceState({}, "", window.location.pathname);
        fetchConnectedAccounts();
        // Auto-sync after connecting
        setTimeout(() => handleSyncNow(), 500);
        setTimeout(() => setSyncStatus(""), 5000);
      } else if (error) {
        setSyncStatus(`Error: ${decodeURIComponent(error)}`);
        window.history.replaceState({}, "", window.location.pathname);
        setTimeout(() => setSyncStatus(""), 8000);
      }
    }

    // Server-side auto-sync every 15 minutes
    const autoSyncInterval = setInterval(async () => {
      try {
        const res = await fetch("/api/calendar/sync", { method: "POST" });
        const data = await res.json();
        if (data.imported > 0 || data.updated > 0) {
          console.log(`Auto-sync: ${data.imported} new, ${data.updated} updated`);
          fetchTasks();
          fetchAllTasks();
        }
      } catch (err) {
        console.error("Auto-sync error:", err);
      }
    }, 15 * 60 * 1000); // 15 minutes

    // Cleanup on unmount
    return () => {
      clearInterval(autoSyncInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

        // Deduplicate: same title + same start hour = duplicate
        const seen = new Set();
        const uniqueTasks = weekTasks.filter((task) => {
          const title = (task.title || "").trim().toLowerCase();
          const startTime = task.start_time || "";
          const key = `${title}|${startTime}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setTasks(uniqueTasks);
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

  const handleMarkDone = async (task) => {
    const isCurrentlyDone = task.status === "done" || task.completed;
    const newStatus = isCurrentlyDone ? "todo" : "done";
    const newCompleted = !isCurrentlyDone;

    // Optimistic update
    const updatedTask = {
      ...task,
      status: newStatus,
      completed: newCompleted,
    };

    setTasks((prevTasks) =>
      prevTasks.map((t) => (t.id === task.id ? updatedTask : t))
    );
    setAllTasks((prevTasks) =>
      prevTasks.map((t) => (t.id === task.id ? updatedTask : t))
    );

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus, completed: newCompleted })
        .eq("id", task.id);

      if (error) {
        console.error("Error updating task status:", error);
        // Revert on error
        setTasks((prevTasks) =>
          prevTasks.map((t) => (t.id === task.id ? task : t))
        );
        setAllTasks((prevTasks) =>
          prevTasks.map((t) => (t.id === task.id ? task : t))
        );
      } else {
        // Show success toast
        const toast = document.createElement("div");
        toast.className = `fixed top-4 right-4 ${
          newCompleted ? "bg-green-500" : "bg-blue-500"
        } text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300`;
        toast.innerHTML = newCompleted
          ? `✅ "${task.title}" marked as done`
          : `↩️ "${task.title}" marked as to do`;
        document.body.appendChild(toast);

        setTimeout(() => {
          toast.style.opacity = "0";
          setTimeout(() => document.body.removeChild(toast), 300);
        }, 2500);
      }
    } catch (error) {
      console.error("Error:", error);
      // Revert on error
      setTasks((prevTasks) =>
        prevTasks.map((t) => (t.id === task.id ? task : t))
      );
      setAllTasks((prevTasks) =>
        prevTasks.map((t) => (t.id === task.id ? task : t))
      );
    }
  };

  const handleTaskResize = async (e, task, direction) => {
    e.preventDefault();
    e.stopPropagation();

    const startY = e.clientY;
    const startDuration = task.duration_minutes || 60;
    let hasStartedDragging = false;
    let currentDuration = startDuration;

    // Helper function to snap duration to 30-minute intervals
    const snapDuration = (duration) => {
      // Snap to nearest 30 minutes, min 30 min, no max limit
      return Math.max(30, Math.round(duration / 30) * 30);
    };

    const handleMouseMove = (e) => {
      const deltaY = e.clientY - startY;
      const dragDistance = Math.abs(deltaY);

      // Only start resizing if dragged more than 5px (prevents accidental clicks)
      if (dragDistance < 5) return;

      if (!hasStartedDragging) {
        hasStartedDragging = true;
      }

      // Convert pixel movement to time: 30px = 30 minutes
      const deltaMinutes = Math.round(deltaY / 30) * 30;

      // Calculate new duration (bottom resize only)
      let rawDuration = startDuration + deltaMinutes;
      const snappedDuration = snapDuration(Math.max(30, rawDuration));

      // Only update if actually dragging and duration changed
      if (snappedDuration !== currentDuration) {
        currentDuration = snappedDuration;

        // Update task visually with snapped duration
        setTasks((prevTasks) =>
          prevTasks.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  duration_minutes: snappedDuration,
                }
              : t
          )
        );
      }
    };

    const handleMouseUp = async () => {
      // Only save if we actually started dragging
      if (hasStartedDragging) {
        // Get final values from current task state
        const currentTask = tasks.find((t) => t.id === task.id);
        if (currentTask && currentTask.duration_minutes !== startDuration) {
          // Save to database only if duration actually changed
          try {
            const { error } = await supabase
              .from("tasks")
              .update({
                duration_minutes: currentTask.duration_minutes,
              })
              .eq("id", currentTask.id);

            if (error) {
              console.error("Error updating task duration:", error);
              // Revert on error
              setTasks((prevTasks) =>
                prevTasks.map((t) =>
                  t.id === task.id
                    ? { ...t, duration_minutes: startDuration }
                    : t
                )
              );
            }
          } catch (error) {
            console.error("Error:", error);
            // Revert on error
            setTasks((prevTasks) =>
              prevTasks.map((t) =>
                t.id === task.id ? { ...t, duration_minutes: startDuration } : t
              )
            );
          }
        }
      }

      // Remove event listeners
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    // Add event listeners for this specific resize operation
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleDragStart = (event) => {
    const { active } = event;

    // Check if dragging from sidebar
    if (active.id.toString().startsWith("sidebar-")) {
      const taskId = parseInt(active.id.toString().replace("sidebar-", ""));
      const task = allTasks.find((t) => t.id === taskId);
      setActiveTask(task);
    }
    // Check if dragging from calendar
    else if (active.id.toString().startsWith("calendar-")) {
      const taskId = parseInt(active.id.toString().replace("calendar-", ""));
      const task = tasks.find((t) => t.id === taskId);
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
        
        // Must have at least 4 parts: year, month, day, hour
        if (parts.length < 4) {
          console.log("Invalid drop target format:", over.id);
          return;
        }
        
        const hour = parseInt(parts[parts.length - 1]); // Last part is the hour
        const dateStr = parts.slice(0, -1).join("-"); // Everything except last part is the date
        const dateParts = dateStr.split("-").map(Number);
        
        // Validate we have year, month, day
        if (dateParts.length < 3 || dateParts.some(isNaN)) {
          console.log("Invalid date format:", dateStr);
          return;
        }

        // Create the exact target date and time in local timezone
        // Parse the date string and add the time in local timezone
        const [year, month, day] = dateParts;

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
    // Check if moving existing calendar task to new slot
    else if (active.id.toString().startsWith("calendar-")) {
      const taskId = parseInt(active.id.toString().replace("calendar-", ""));
      const task = tasks.find((t) => t.id === taskId);

      if (task && over.id.toString().includes("-")) {
        // Parse new time slot ID (format: YYYY-MM-DD-hour)
        const parts = over.id.toString().split("-");
        
        // Must have at least 4 parts: year, month, day, hour
        if (parts.length < 4) {
          console.log("Invalid drop target format:", over.id);
          return;
        }
        
        const hour = parseInt(parts[parts.length - 1]);
        const dateStr = parts.slice(0, -1).join("-");
        const dateParts = dateStr.split("-").map(Number);
        
        // Validate we have year, month, day
        if (dateParts.length < 3 || dateParts.some(isNaN)) {
          console.log("Invalid date format:", dateStr);
          return;
        }
        
        const [year, month, day] = dateParts;

        // Create new timestamp
        const newTimeString = `${year}-${month
          .toString()
          .padStart(2, "0")}-${day.toString().padStart(2, "0")} ${hour
          .toString()
          .padStart(2, "0")}:00:00`;

        // Update task time
        const updatedTask = {
          ...task,
          start_time: newTimeString,
        };

        // Optimistic update
        setTasks((prevTasks) =>
          prevTasks.map((t) => (t.id === taskId ? updatedTask : t))
        );

        // Save to database
        try {
          const { error } = await supabase
            .from("tasks")
            .update({ start_time: newTimeString })
            .eq("id", taskId);

          if (error) {
            console.error("Error moving task:", error);
            // Revert on error
            setTasks((prevTasks) =>
              prevTasks.map((t) => (t.id === taskId ? task : t))
            );
          } else {
            const dayName = new Date(year, month - 1, day).toLocaleDateString(
              "en-US",
              {
                weekday: "short",
              }
            );

            // Success feedback
            const toast = document.createElement("div");
            toast.className =
              "fixed top-4 right-4 bg-[#10B981] text-white px-4 py-2 rounded-lg shadow-lg z-50";
            toast.innerHTML = `✅ "${task.title}" moved to ${dayName} ${hour
              .toString()
              .padStart(2, "0")}:00`;
            document.body.appendChild(toast);

            setTimeout(() => {
              toast.style.opacity = "0";
              setTimeout(() => document.body.removeChild(toast), 300);
            }, 3000);
          }
        } catch (error) {
          console.error("Error:", error);
          setTasks((prevTasks) =>
            prevTasks.map((t) => (t.id === taskId ? task : t))
          );
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
          <SortableContext
            items={[
              ...allTasks
                .filter((t) => !t.is_scheduled)
                .map((task) => `sidebar-${task.id}`),
              ...tasks.map((task) => `calendar-${task.id}`),
            ]}
            strategy={verticalListSortingStrategy}
          >
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
                {/* Current Time Indicator */}
                {(() => {
                  const now = currentTime;
                  const currentHour = now.getHours();
                  const currentMinutes = now.getMinutes();
                  
                  // Only show if current hour is within our visible range (4:00 - 23:00)
                  if (currentHour < 4 || currentHour > 23) return null;
                  
                  // Find which day column is today
                  const todayIndex = weekDates.findIndex(
                    (date) => date.toDateString() === now.toDateString()
                  );
                  
                  // Only show if today is in the current week view
                  if (todayIndex === -1) return null;
                  
                  // Calculate vertical position: (hour - 4) * 60px + (minutes/60) * 60px
                  const topPosition = (currentHour - 4) * 60 + (currentMinutes / 60) * 60;
                  
                  // Calculate horizontal position: time column is 1/8, each day is 1/8
                  // todayIndex 0 = Monday, which is column 2 (after time column)
                  const leftPercent = ((todayIndex + 1) / 8) * 100;
                  const widthPercent = (1 / 8) * 100;
                  
                  return (
                    <div
                      className="absolute z-20 pointer-events-none"
                      style={{
                        top: `${topPosition}px`,
                        left: `${leftPercent}%`,
                        width: `${widthPercent}%`,
                      }}
                    >
                      {/* Red dot at the start */}
                      <div className="absolute -left-1.5 -top-1.5 w-3 h-3 bg-red-500 rounded-full shadow-lg shadow-red-500/50"></div>
                      {/* Red line */}
                      <div className="h-0.5 bg-red-500 shadow-lg shadow-red-500/30"></div>
                    </div>
                  );
                })()}

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
                          const [datePart, timePart] =
                            task.start_time.split(" ");
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
                          const timeStr = task.start_time.replace(
                            /[Z+].*$/,
                            ""
                          );
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
                          onTaskResize={handleTaskResize}
                          onMarkDone={handleMarkDone}
                          allTasks={allTasks}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </SortableContext>

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
                        {activeTask.is_scheduled
                          ? "📅 Move to new time"
                          : "📅 Drag to schedule"}
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

          {/* Calendar Integrations - collapsible */}
          <details className="mt-8">
            <summary className="text-lg font-semibold text-white cursor-pointer hover:text-[#a1a1a1] transition-colors select-none flex items-center gap-2">
              <span>Sincronizar Calendarios</span>
              <span className="text-xs text-[#666] font-normal">
                ({connectedAccounts.length} cuenta{connectedAccounts.length !== 1 ? "s" : ""} conectada{connectedAccounts.length !== 1 ? "s" : ""})
              </span>
            </summary>
            <div className="mt-4 space-y-4">
              {/* Connected Accounts Overview */}
              {connectedAccounts.length > 0 && (
                <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-4">
                  <h3 className="text-white font-semibold text-sm mb-3">Cuentas conectadas</h3>
                  <div className="space-y-2 mb-4">
                    {connectedAccounts.map((account) => (
                      <div
                        key={`${account.provider}-${account.email}`}
                        className="flex items-center justify-between p-3 bg-[#0a0a0a] border border-[#2d2d2d] rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              account.connected ? "bg-[#10B981]" : "bg-[#EF4444]"
                            }`}
                          />
                          <div>
                            <p className="text-white text-sm font-medium">{account.email}</p>
                            <p className="text-[#666] text-xs">
                              {account.provider === "google" ? "Google Calendar" : "Outlook"}
                              {account.has_refresh_token ? " - Conectado permanentemente" : ""}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDisconnectAccount(account.provider, account.email)}
                          className="text-[#a1a1a1] hover:text-[#EF4444] transition-colors text-xs px-2 py-1 hover:bg-[#EF4444]/10 rounded"
                          title="Desconectar"
                        >
                          Desconectar
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Sync Now Button */}
                  <button
                    onClick={handleSyncNow}
                    disabled={syncing}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-[#3B82F6] text-white rounded-lg hover:bg-[#2563EB] transition-all duration-200 disabled:opacity-50 font-medium text-sm"
                  >
                    {syncing ? (
                      <>
                        <CalendarIcon className="w-4 h-4 animate-spin" />
                        <span>Sincronizando...</span>
                      </>
                    ) : (
                      <>
                        <CalendarIcon className="w-4 h-4" />
                        <span>Sincronizar Todo Ahora</span>
                      </>
                    )}
                  </button>

                  {/* Sync Status */}
                  {syncStatus && (
                    <div className="mt-3 p-2 bg-[#0a0a0a] border border-[#2d2d2d] rounded-lg">
                      <p className="text-sm text-[#a1a1a1]">{syncStatus}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Connect New Accounts */}
              <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-4">
                <h3 className="text-white font-semibold text-sm mb-3">Conectar calendarios</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <a
                    href="/api/auth/google"
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-[#4285F4]/20 border border-[#4285F4]/30 text-[#4285F4] rounded-lg hover:bg-[#4285F4]/30 transition-all duration-200 font-medium text-sm"
                  >
                    <CalendarIcon className="w-4 h-4" />
                    <span>Conectar Google</span>
                  </a>
                  <a
                    href="/api/auth/outlook"
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-[#0078d4]/20 border border-[#0078d4]/30 text-[#0078d4] rounded-lg hover:bg-[#0078d4]/30 transition-all duration-200 font-medium text-sm"
                  >
                    <CalendarIcon className="w-4 h-4" />
                    <span>Conectar Outlook</span>
                  </a>
                </div>
              </div>

              {/* Legacy Sync Components (keep for backward compat) */}
              <PersonalOutlookSync
                onImportComplete={() => {
                  fetchTasks();
                  fetchAllTasks();
                  fetchConnectedAccounts();
                }}
              />

              <GoogleCalendarSync
                onImportComplete={() => {
                  fetchTasks();
                  fetchAllTasks();
                  fetchConnectedAccounts();
                }}
              />
            </div>
          </details>
        </div>
      </DndContext>
    </div>
  );
}
