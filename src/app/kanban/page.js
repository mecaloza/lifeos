"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  MoreHorizontal,
  Tag,
  Clock,
  X,
  History,
  ChevronRight,
  Mail,
  Eye,
  EyeOff,
  Search,
  Filter,
  Users,
  User,
  ChevronDown,
  Link,
  Unlink,
  Layers,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// Draggable Task Component
function KanbanTask({ task, availableTags, onShowTimeline, onHideTask }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-[#1a1a1a] border rounded-lg p-3 hover:bg-[#1e1e1e] transition-all duration-200 group ${
        isDragging
          ? "opacity-40 cursor-grabbing border-[#2d2d2d]"
          : "cursor-grab hover:shadow-lg"
      } ${
        task.is_group
          ? "border-[#8B5CF6]/40 hover:border-[#8B5CF6]/60"
          : "border-[#2d2d2d] hover:border-[#3a3a3a]"
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-white font-medium text-sm line-clamp-2 flex-1">
          {task.title}
        </h3>
        <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
          {/* Group Badge */}
          {task.is_group && (
            <span className="bg-[#8B5CF6]/20 text-[#8B5CF6] text-xs px-1.5 py-0.5 rounded flex items-center space-x-0.5" title={`Group: ${task.subtask_count || 0} subtasks`}>
              <Layers className="w-2.5 h-2.5" />
              <span className="font-medium">{task.subtask_count || 0}</span>
            </span>
          )}
          {/* Delegated Badge */}
          {task.is_delegated && (
            <span className="bg-orange-500/20 text-orange-400 text-xs px-1.5 py-0.5 rounded flex items-center" title={`Delegated to: ${task.delegated_to || 'Team'}`}>
              <Users className="w-2.5 h-2.5" />
            </span>
          )}
          {/* Source Badge */}
          {task.source && task.source !== "manual" && (
            <span className="bg-blue-500/20 text-blue-400 text-xs px-1.5 py-0.5 rounded flex items-center">
              <Mail className="w-2.5 h-2.5" />
            </span>
          )}
        </div>
      </div>

      {task.description && (
        <p className="text-[#a1a1a1] text-xs mb-3 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.tags.slice(0, 3).map((tagName, index) => {
            const tagInfo = availableTags.find((t) => t.name === tagName);
            const bgColor = tagInfo?.color ? `${tagInfo.color}20` : "#8B5CF620";
            const textColor = tagInfo?.color || "#8B5CF6";
            return (
              <span
                key={index}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: bgColor,
                  color: textColor,
                  border: `1px solid ${textColor}40`,
                }}
              >
                <Tag className="w-2.5 h-2.5 mr-1" />
                {tagName}
              </span>
            );
          })}
          {task.tags.length > 3 && (
            <span className="text-[#666666] text-xs">
              +{task.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Date */}
      <div className="flex items-center justify-between text-xs text-[#666666]">
        <div className="flex items-center space-x-1">
          <Clock className="w-3 h-3" />
          <span>{new Date(task.created_at).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onHideTask(task.id);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#2a2a2a] rounded transition-all"
            title="Hide task"
          >
            <EyeOff className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShowTimeline(task);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#2a2a2a] rounded transition-all"
            title="View task timeline"
          >
            <History className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Task Timeline Component
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

                return (
                  <div
                    key={entry.id}
                    className="relative flex items-start space-x-4"
                  >
                    {/* Timeline Dot */}
                    <div
                      className="relative z-10 w-3 h-3 rounded-full border-2 border-[#1a1a1a]"
                      style={{ backgroundColor: statusInfo.color }}
                    >
                      {!isLast && (
                        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 w-0.5 h-6 bg-[#2d2d2d]"></div>
                      )}
                    </div>

                    {/* Timeline Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span
                            className="text-sm font-medium"
                            style={{ color: statusInfo.color }}
                          >
                            {statusInfo.name}
                          </span>
                          {entry.from_status && (
                            <div className="flex items-center space-x-1 text-xs text-[#666666]">
                              <span>from</span>
                              <span className="text-[#a1a1a1]">
                                {getStatusInfo(entry.from_status).name}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-[#666666] text-right">
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

                      {/* Duration in previous status */}
                      {entry.duration_in_previous_status && (
                        <div className="mt-1 text-xs text-[#a1a1a1]">
                          Time in previous status:{" "}
                          <span className="text-white font-medium">
                            {formatDuration(entry.duration_in_previous_status)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {timeline.length === 0 && (
                <div className="text-center py-8 text-[#666666]">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No status changes tracked yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Kanban Column Component
function KanbanColumn({
  column,
  tasks,
  availableTags,
  onDeleteColumn,
  onShowTimeline,
  onAddTask,
  onHideTask,
  onUnhideTask,
  showHiddenTasks,
  mergeTarget,
  mergeReady,
  onUngroupTask,
  allTasks,
}) {
  const tasksInColumn = tasks
    .filter((task) => task.status === column.id)
    .sort((a, b) => (a.kanban_order ?? 999999) - (b.kanban_order ?? 999999));

  const { isOver, setNodeRef } = useDroppable({
    id: column.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`bg-[#0a0a0a] rounded-lg border flex flex-col h-full min-w-0 transition-all duration-200 ${
        isOver
          ? "border-[#4a4a4a] bg-[#1a1a1a] shadow-lg ring-2 ring-[#3a3a3a]/50"
          : "border-[#1a1a1a]"
      }`}
    >
      {/* Column Header */}
      <div className="p-3 border-b border-[#1a1a1a]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 min-w-0">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: column.color }}
            ></div>
            <h2 className="text-white font-semibold text-xs truncate">{column.name}</h2>
            <span className="bg-[#1a1a1a] text-[#a1a1a1] text-xs px-1.5 py-0.5 rounded-full flex-shrink-0">
              {tasksInColumn.length}
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => onAddTask(column.id)}
              className="p-1 hover:bg-[#2a2a2a] rounded transition-all"
              title={`Add task to ${column.name}`}
            >
              <Plus className="w-4 h-4 text-[#666666] hover:text-white" />
            </button>
            {column.id !== "backlog" && column.id !== "todo" && column.id !== "in_progress" && column.id !== "waiting" && column.id !== "done" && (
              <button
                onClick={() => onDeleteColumn(column.id)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#2a2a2a] rounded transition-all"
              >
                <X className="w-4 h-4 text-[#666666] hover:text-red-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Column Content - Drop Zone */}
      <div className="p-3 flex-1 min-h-0 overflow-y-auto">
        <SortableContext
          items={tasksInColumn.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2 min-h-full">
            {tasksInColumn.map((task) => {
              const isMergeTarget = mergeTarget === task.id;
              const childTasks = task.is_group ? allTasks.filter(t => t.parent_task_id === task.id) : [];
              
              return (
                <div key={task.id} className="relative">
                  {/* Merge indicator */}
                  {isMergeTarget && (
                    <div className={`absolute inset-0 z-20 rounded-lg border-2 border-dashed pointer-events-none transition-all duration-300 ${
                      mergeReady
                        ? "border-[#8B5CF6] bg-[#8B5CF6]/20 shadow-lg shadow-[#8B5CF6]/20"
                        : "border-[#8B5CF6]/40 bg-[#8B5CF6]/5"
                    }`}>
                      <div className={`absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap transition-all ${
                        mergeReady
                          ? "bg-[#8B5CF6] text-white"
                          : "bg-[#8B5CF6]/40 text-[#8B5CF6]"
                      }`}>
                        {mergeReady ? "🔗 Drop to merge!" : "Hold to merge..."}
                      </div>
                    </div>
                  )}
                  
                  {/* Hidden badge */}
                  {task.is_hidden_kanban && showHiddenTasks && (
                    <div className="absolute -top-1 -right-1 z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUnhideTask(task.id);
                        }}
                        className="bg-yellow-500 text-black text-xs px-1.5 py-0.5 rounded-full font-medium hover:bg-yellow-400 transition-colors flex items-center space-x-1"
                        title="Unhide task"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Show</span>
                      </button>
                    </div>
                  )}
                  
                  <div className={task.is_hidden_kanban && showHiddenTasks ? "opacity-50 border-dashed border-yellow-500/30" : ""}>
                    <KanbanTask
                      task={task}
                      availableTags={availableTags}
                      onShowTimeline={onShowTimeline}
                      onHideTask={onHideTask}
                    />
                    
                    {/* Group indicator - show subtasks */}
                    {task.is_group && childTasks.length > 0 && (
                      <div className="mt-1 ml-2 border-l-2 border-[#8B5CF6]/40 pl-2 space-y-1">
                        {childTasks.map((child) => (
                          <div
                            key={child.id}
                            className="bg-[#0a0a0a] border border-[#2d2d2d] rounded px-2 py-1 text-xs text-[#a1a1a1] flex items-center justify-between group/child"
                          >
                            <div className="flex items-center space-x-1.5 min-w-0">
                              <Link className="w-3 h-3 text-[#8B5CF6] flex-shrink-0" />
                              <span className="truncate">{child.title}</span>
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onUngroupTask(task);
                          }}
                          className="flex items-center space-x-1 text-xs text-[#666666] hover:text-red-400 transition-colors px-1 py-0.5"
                        >
                          <Unlink className="w-3 h-3" />
                          <span>Ungroup</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {tasksInColumn.length === 0 && (
              <div
                className={`text-center py-8 text-sm transition-all duration-200 ${
                  isOver
                    ? "text-[#a1a1a1] bg-[#2a2a2a]/20 border-2 border-dashed border-[#3a3a3a] rounded-lg"
                    : "text-[#666666]"
                }`}
              >
                {isOver ? "Drop here!" : (
                  <button
                    onClick={() => onAddTask(column.id)}
                    className="hover:text-white transition-colors"
                  >
                    + Add task
                  </button>
                )}
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

// Main Kanban Page
export default function KanbanPage() {
  const [tasks, setTasks] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [columns, setColumns] = useState([
    { id: "backlog", name: "Backlog", color: "#666666" },
    { id: "todo", name: "To Do", color: "#3B82F6" },
    { id: "in_progress", name: "In Progress", color: "#F59E0B" },
    { id: "waiting", name: "Waiting Answers", color: "#8B5CF6" },
    { id: "done", name: "Done", color: "#10B981" },
  ]);
  const [loading, setLoading] = useState(true);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [activeTask, setActiveTask] = useState(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [selectedTaskForTimeline, setSelectedTaskForTimeline] = useState(null);
  const [taskTimeline, setTaskTimeline] = useState([]);
  const [showIntegratedTasks, setShowIntegratedTasks] = useState(false);
  const [showHiddenTasks, setShowHiddenTasks] = useState(false);
  
  // Merge/group task states
  const [mergeTarget, setMergeTarget] = useState(null); // task ID being hovered over
  const [mergeReady, setMergeReady] = useState(false); // true when hold time reached
  const mergeTimerRef = useRef(null);
  const mergeHoverIdRef = useRef(null);
  const MERGE_HOLD_TIME = 1500; // 1.5 seconds hold to merge
  
  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTagFilter, setSelectedTagFilter] = useState(null);
  const [ownershipFilter, setOwnershipFilter] = useState("mine"); // "all", "mine", "delegated" - default to "mine"
  const [showFilters, setShowFilters] = useState(false);
  
  // Task creation modal states
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTaskColumn, setNewTaskColumn] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskTags, setNewTaskTags] = useState([]);
  const [savingTask, setSavingTask] = useState(false);

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

  // Fetch tasks and tags
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
        .order("kanban_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching tasks:", error);
        const savedTasks = localStorage.getItem("tasks");
        if (savedTasks) {
          const tasks = JSON.parse(savedTasks);
          // Add status field if not present
          const tasksWithStatus = tasks.map((task) => ({
            ...task,
            status: task.status || "backlog",
          }));
          setTasks(tasksWithStatus);
        }
      } else {
        // Add status field if not present
        const tasksWithStatus = (data || []).map((task) => ({
          ...task,
          status: task.status || "backlog",
        }));
        setTasks(tasksWithStatus);
        localStorage.setItem("tasks", JSON.stringify(tasksWithStatus));
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

  // Clear merge timer helper
  const clearMergeTimer = useCallback(() => {
    if (mergeTimerRef.current) {
      clearTimeout(mergeTimerRef.current);
      mergeTimerRef.current = null;
    }
    mergeHoverIdRef.current = null;
    setMergeTarget(null);
    setMergeReady(false);
  }, []);

  const handleDragStart = (event) => {
    const { active } = event;
    const task = tasks.find((task) => task.id === active.id);
    setActiveTask(task);
    clearMergeTimer();
  };

  // Track hover over tasks for merge detection
  const handleDragOver = useCallback((event) => {
    const { active, over } = event;
    if (!over || !active) {
      clearMergeTimer();
      return;
    }

    // Only trigger merge when hovering over a TASK (not a column)
    const isColumn = columns.some((col) => col.id === over.id);
    if (isColumn) {
      clearMergeTimer();
      return;
    }

    const overTask = tasks.find((t) => t.id === over.id);
    const activeTaskData = tasks.find((t) => t.id === active.id);
    if (!overTask || !activeTaskData) {
      clearMergeTimer();
      return;
    }

    // Must be in the SAME column to merge
    if (overTask.status !== activeTaskData.status) {
      clearMergeTimer();
      return;
    }

    // Don't merge with self
    if (overTask.id === activeTaskData.id) {
      clearMergeTimer();
      return;
    }

    // If still hovering over the same task, don't restart the timer
    if (mergeHoverIdRef.current === over.id) {
      return;
    }

    // New hover target - start a new timer
    clearMergeTimer();
    mergeHoverIdRef.current = over.id;
    setMergeTarget(over.id);

    mergeTimerRef.current = setTimeout(() => {
      setMergeReady(true);
      console.log(`🔗 Merge ready: drop now to merge tasks!`);
    }, MERGE_HOLD_TIME);
  }, [tasks, columns, clearMergeTimer]);

  // Merge tasks: create a group parent or add to existing group
  const mergeTasks = async (draggedTask, targetTask) => {
    try {
      console.log(`🔗 Merging "${draggedTask.title}" into "${targetTask.title}"`);

      // Check if target is already a group
      if (targetTask.is_group) {
        // Add dragged task to existing group
        const { error } = await supabase
          .from("tasks")
          .update({ parent_task_id: targetTask.id, is_hidden_kanban: true })
          .eq("id", draggedTask.id);

        if (error) {
          console.error("Error adding to group:", error);
          return;
        }

        // Update subtask count on parent
        const subtaskCount = tasks.filter(t => t.parent_task_id === targetTask.id).length + 1;
        await supabase
          .from("tasks")
          .update({ subtask_count: subtaskCount })
          .eq("id", targetTask.id);

        // Update local state
        setTasks(tasks.map(t => {
          if (t.id === draggedTask.id) return { ...t, parent_task_id: targetTask.id, is_hidden_kanban: true };
          if (t.id === targetTask.id) return { ...t, subtask_count: subtaskCount };
          return t;
        }));

        console.log(`✅ Added "${draggedTask.title}" to group "${targetTask.title}"`);
      } else {
        // Create a new group: target becomes group parent, dragged becomes child
        // Mark target as a group
        const { error: groupError } = await supabase
          .from("tasks")
          .update({ is_group: true, subtask_count: 1 })
          .eq("id", targetTask.id);

        if (groupError) {
          console.error("Error creating group:", groupError);
          return;
        }

        // Link dragged task to target as child
        const { error: childError } = await supabase
          .from("tasks")
          .update({ parent_task_id: targetTask.id, is_hidden_kanban: true })
          .eq("id", draggedTask.id);

        if (childError) {
          console.error("Error linking child task:", childError);
          return;
        }

        // Update local state
        setTasks(tasks.map(t => {
          if (t.id === targetTask.id) return { ...t, is_group: true, subtask_count: 1 };
          if (t.id === draggedTask.id) return { ...t, parent_task_id: targetTask.id, is_hidden_kanban: true };
          return t;
        }));

        console.log(`✅ Created group from "${targetTask.title}" + "${draggedTask.title}"`);
      }

      // Show notification
      const toast = document.createElement("div");
      toast.className = "fixed top-4 right-4 bg-[#8B5CF6] text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center space-x-2";
      toast.innerHTML = `<span>🔗 Tasks merged into "${targetTask.title}"</span>`;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transition = "opacity 0.3s";
        setTimeout(() => document.body.removeChild(toast), 300);
      }, 2500);

    } catch (error) {
      console.error("Error merging tasks:", error);
    }
  };

  // Ungroup: remove all children from a group
  const ungroupTask = async (groupTask) => {
    try {
      // Find all children
      const children = tasks.filter(t => t.parent_task_id === groupTask.id);

      if (children.length === 0) return;

      // Unlink all children
      const childIds = children.map(c => c.id);
      const { error: childError } = await supabase
        .from("tasks")
        .update({ parent_task_id: null, is_hidden_kanban: false })
        .in("id", childIds);

      if (childError) {
        console.error("Error unlinking children:", childError);
        return;
      }

      // Remove group flag from parent
      const { error: parentError } = await supabase
        .from("tasks")
        .update({ is_group: false, subtask_count: 0 })
        .eq("id", groupTask.id);

      if (parentError) {
        console.error("Error removing group:", parentError);
        return;
      }

      // Update local state
      setTasks(tasks.map(t => {
        if (t.id === groupTask.id) return { ...t, is_group: false, subtask_count: 0 };
        if (childIds.includes(t.id)) return { ...t, parent_task_id: null, is_hidden_kanban: false };
        return t;
      }));

      console.log(`✅ Ungrouped "${groupTask.title}" - ${children.length} tasks released`);
    } catch (error) {
      console.error("Error ungrouping:", error);
    }
  };

  // Remove a single task from a group
  const removeFromGroup = async (childTask) => {
    try {
      const parentId = childTask.parent_task_id;
      
      const { error } = await supabase
        .from("tasks")
        .update({ parent_task_id: null, is_hidden_kanban: false })
        .eq("id", childTask.id);

      if (error) {
        console.error("Error removing from group:", error);
        return;
      }

      // Update subtask count on parent
      const remainingChildren = tasks.filter(t => t.parent_task_id === parentId && t.id !== childTask.id).length;
      
      if (remainingChildren === 0) {
        // No more children, remove group flag
        await supabase
          .from("tasks")
          .update({ is_group: false, subtask_count: 0 })
          .eq("id", parentId);

        setTasks(tasks.map(t => {
          if (t.id === childTask.id) return { ...t, parent_task_id: null, is_hidden_kanban: false };
          if (t.id === parentId) return { ...t, is_group: false, subtask_count: 0 };
          return t;
        }));
      } else {
        await supabase
          .from("tasks")
          .update({ subtask_count: remainingChildren })
          .eq("id", parentId);

        setTasks(tasks.map(t => {
          if (t.id === childTask.id) return { ...t, parent_task_id: null, is_hidden_kanban: false };
          if (t.id === parentId) return { ...t, subtask_count: remainingChildren };
          return t;
        }));
      }

      console.log(`✅ Removed "${childTask.title}" from group`);
    } catch (error) {
      console.error("Error removing from group:", error);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    const wasMergeReady = mergeReady;
    const mergeTargetId = mergeTarget;
    clearMergeTimer();
    setActiveTask(null);

    if (!over) return;

    const activeTaskData = tasks.find((task) => task.id === active.id);
    if (!activeTaskData) return;

    // Check if this is a MERGE operation (held over a task long enough)
    if (wasMergeReady && mergeTargetId) {
      const targetTask = tasks.find((t) => t.id === mergeTargetId);
      if (targetTask && targetTask.id !== activeTaskData.id && targetTask.status === activeTaskData.status) {
        await mergeTasks(activeTaskData, targetTask);
        return; // Don't do normal drag/drop
      }
    }

    // Find target column
    let newStatus = activeTaskData.status;
    const targetColumn = columns.find((col) => col.id === over.id);
    if (targetColumn) {
      newStatus = targetColumn.id;
    } else {
      const targetTask = tasks.find((task) => task.id === over.id);
      if (targetTask) {
        newStatus = targetTask.status;
      }
    }

    const statusChanged = newStatus !== activeTaskData.status;

    // Get current tasks in the target column (sorted)
    const targetColumnTasks = tasks
      .filter((t) => t.status === newStatus && t.id !== activeTaskData.id)
      .sort((a, b) => (a.kanban_order ?? 999999) - (b.kanban_order ?? 999999));

    // Determine the drop position
    let dropIndex = targetColumnTasks.length; // default: end of column
    const overTask = tasks.find((t) => t.id === over.id);
    if (overTask && overTask.status === newStatus) {
      dropIndex = targetColumnTasks.findIndex((t) => t.id === over.id);
      if (dropIndex === -1) dropIndex = targetColumnTasks.length;
    }

    // Insert the active task at the drop position
    targetColumnTasks.splice(dropIndex, 0, activeTaskData);

    // Assign new order values for the entire target column
    const updates = targetColumnTasks.map((task, index) => ({
      id: task.id,
      kanban_order: index,
      status: newStatus,
    }));

    // If task moved to a different column, also reorder the source column
    let sourceUpdates = [];
    if (statusChanged) {
      const sourceColumnTasks = tasks
        .filter((t) => t.status === activeTaskData.status && t.id !== activeTaskData.id)
        .sort((a, b) => (a.kanban_order ?? 999999) - (b.kanban_order ?? 999999));

      sourceUpdates = sourceColumnTasks.map((task, index) => ({
        id: task.id,
        kanban_order: index,
        status: activeTaskData.status,
      }));
    }

    // Optimistic update: apply new orders to local state
    const allUpdates = [...updates, ...sourceUpdates];
    const updateMap = new Map(allUpdates.map((u) => [u.id, u]));

    const updatedTasks = tasks.map((task) => {
      const update = updateMap.get(task.id);
      if (update) {
        return { ...task, ...update };
      }
      return task;
    });

    setTasks(updatedTasks);

    // Persist to Supabase
    try {
      // Update all affected tasks in parallel
      const promises = allUpdates.map((update) =>
        supabase
          .from("tasks")
          .update({ kanban_order: update.kanban_order, status: update.status })
          .eq("id", update.id)
      );

      const results = await Promise.all(promises);
      const hasError = results.some((r) => r.error);

      if (hasError) {
        console.error("Error updating task order, reverting...");
        setTasks(tasks); // Revert
      } else {
        localStorage.setItem("tasks", JSON.stringify(updatedTasks));
        if (statusChanged) {
          console.log(`Task "${activeTaskData.title}" moved to ${newStatus} at position ${dropIndex}`);
        } else {
          console.log(`Task "${activeTaskData.title}" reordered to position ${dropIndex}`);
        }
      }
    } catch (error) {
      console.error("Error:", error);
      setTasks(tasks); // Revert
    }
  };

  const addColumn = () => {
    if (!newColumnName.trim()) return;

    const colors = [
      "#EF4444",
      "#F59E0B",
      "#10B981",
      "#3B82F6",
      "#8B5CF6",
      "#EC4899",
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newColumn = {
      id: newColumnName.toLowerCase().replace(/\s+/g, "_"),
      name: newColumnName,
      color: randomColor,
    };

    setColumns([...columns, newColumn]);
    setNewColumnName("");
    setShowAddColumn(false);
  };

  const deleteColumn = (columnId) => {
    // Move all tasks from this column back to backlog
    const updatedTasks = tasks.map((task) =>
      task.status === columnId ? { ...task, status: "backlog" } : task
    );
    setTasks(updatedTasks);

    // Remove the column
    setColumns(columns.filter((col) => col.id !== columnId));
  };

  // Task creation handlers
  const handleAddTaskToColumn = (columnId) => {
    setNewTaskColumn(columnId);
    setNewTaskTitle("");
    setNewTaskDescription("");
    setNewTaskTags([]);
    setShowTaskModal(true);
  };

  const handleSaveNewTask = async () => {
    if (!newTaskTitle.trim() || !newTaskColumn) return;
    
    setSavingTask(true);
    try {
      // Find the lowest order in the target column to place the new task at the top
      const columnTasks = tasks.filter(t => t.status === newTaskColumn);
      const minOrder = columnTasks.reduce((min, t) => Math.min(min, t.kanban_order ?? 999999), 999999);
      const newOrder = minOrder > 0 ? minOrder - 1 : -1;

      const newTask = {
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim() || null,
        tags: newTaskTags,
        status: newTaskColumn,
        completed: newTaskColumn === "done",
        is_scheduled: false,
        source: "manual",
        kanban_order: newOrder,
      };

      const { data, error } = await supabase
        .from("tasks")
        .insert([newTask])
        .select()
        .single();

      if (error) {
        console.error("Error creating task:", error);
        alert("Failed to create task. Please try again.");
      } else {
        // Add to local state
        setTasks([data, ...tasks]);
        localStorage.setItem("tasks", JSON.stringify([data, ...tasks]));
        
        // Close modal and reset
        setShowTaskModal(false);
        setNewTaskColumn(null);
        setNewTaskTitle("");
        setNewTaskDescription("");
        setNewTaskTags([]);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to create task. Please try again.");
    } finally {
      setSavingTask(false);
    }
  };

  const handleAddTagToNewTask = (tagName) => {
    if (!newTaskTags.includes(tagName)) {
      setNewTaskTags([...newTaskTags, tagName]);
    }
  };

  const handleRemoveTagFromNewTask = (tagName) => {
    setNewTaskTags(newTaskTags.filter((t) => t !== tagName));
  };

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

  // Hide a task in Kanban (persists to Supabase)
  const hideTask = async (taskId) => {
    try {
      // Optimistic update
      setTasks(tasks.map(t => t.id === taskId ? { ...t, is_hidden_kanban: true } : t));

      const { error } = await supabase
        .from("tasks")
        .update({ is_hidden_kanban: true })
        .eq("id", taskId);

      if (error) {
        console.error("Error hiding task:", error);
        // Revert on failure
        setTasks(tasks);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // Unhide a task in Kanban
  const unhideTask = async (taskId) => {
    try {
      setTasks(tasks.map(t => t.id === taskId ? { ...t, is_hidden_kanban: false } : t));

      const { error } = await supabase
        .from("tasks")
        .update({ is_hidden_kanban: false })
        .eq("id", taskId);

      if (error) {
        console.error("Error unhiding task:", error);
        setTasks(tasks);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // Unhide all tasks
  const unhideAllTasks = async () => {
    try {
      const hiddenIds = tasks.filter(t => t.is_hidden_kanban).map(t => t.id);
      if (hiddenIds.length === 0) return;

      setTasks(tasks.map(t => ({ ...t, is_hidden_kanban: false })));

      const { error } = await supabase
        .from("tasks")
        .update({ is_hidden_kanban: false })
        .in("id", hiddenIds);

      if (error) {
        console.error("Error unhiding all tasks:", error);
        fetchTasks();
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // Count hidden tasks (only manually hidden, NOT grouped children)
  const hiddenTasksCount = tasks.filter(t => t.is_hidden_kanban && !t.parent_task_id).length;

  // Filter tasks based on all criteria
  const filteredTasks = tasks.filter((task) => {
    // Always hide child tasks from columns - they show under their parent group
    if (task.parent_task_id) {
      return false;
    }
    
    // Hide manually hidden tasks unless toggle is on
    if (!showHiddenTasks && task.is_hidden_kanban && !task.parent_task_id) {
      return false;
    }
    
    // Hide integrated tasks if toggle is off
    const isIntegrated = task.source && task.source !== "manual";
    if (!showIntegratedTasks && isIntegrated) {
      return false;
    }
    
    // Search filter - search in title and description
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = task.title?.toLowerCase().includes(query);
      const matchesDescription = task.description?.toLowerCase().includes(query);
      if (!matchesTitle && !matchesDescription) {
        return false;
      }
    }
    
    // Tag filter
    if (selectedTagFilter) {
      const taskTags = task.tags || [];
      if (!taskTags.includes(selectedTagFilter)) {
        return false;
      }
    }
    
    // Ownership filter
    if (ownershipFilter === "mine" && task.is_delegated) {
      return false;
    }
    if (ownershipFilter === "delegated" && !task.is_delegated) {
      return false;
    }
    
    return true;
  });

  // Count integrated tasks
  const integratedTasksCount = tasks.filter(
    (task) => task.source && task.source !== "manual"
  ).length;
  
  // Count active filters (mine is default, so only count if changed to "all" or "delegated")
  const activeFiltersCount = [
    searchQuery.trim() ? 1 : 0,
    selectedTagFilter ? 1 : 0,
    ownershipFilter !== "mine" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);
  
  // Clear all filters (reset to defaults - "mine" is default)
  const clearFilters = () => {
    setSearchQuery("");
    setSelectedTagFilter(null);
    setOwnershipFilter("mine");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-2 border-[#a1a1a1] border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-white text-lg font-medium">Loading Kanban...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black overflow-hidden flex flex-col">
      <div className="p-4 flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-white">Kanban Board</h1>
            <p className="text-[#a1a1a1] text-sm">
              Drag and drop tasks between columns
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#666666]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className="w-48 pl-9 pr-3 py-2 rounded-lg border border-[#2d2d2d] bg-[#1a1a1a] text-white placeholder-[#666666] text-sm focus:border-[#3a3a3a] focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-0.5 hover:bg-[#2a2a2a] rounded"
                >
                  <X className="w-3 h-3 text-[#666666]" />
                </button>
              )}
            </div>

            {/* Filter Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center space-x-1.5 px-3 py-2 border rounded-lg transition-all duration-200 text-sm ${
                activeFiltersCount > 0
                  ? "bg-purple-500/20 border-purple-500/50 text-purple-400"
                  : "bg-[#1e1e1e] border-[#2d2d2d] text-[#a1a1a1] hover:bg-[#2a2a2a]"
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Toggle for hidden tasks */}
            {hiddenTasksCount > 0 && (
              <button
                onClick={() => setShowHiddenTasks(!showHiddenTasks)}
                className={`flex items-center space-x-1.5 px-3 py-2 border rounded-lg transition-all duration-200 text-sm ${
                  showHiddenTasks
                    ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-400"
                    : "bg-[#1e1e1e] border-[#2d2d2d] text-[#a1a1a1] hover:bg-[#2a2a2a]"
                }`}
                title={showHiddenTasks ? "Hide hidden tasks" : "Show hidden tasks"}
              >
                {showHiddenTasks ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span>Hidden ({hiddenTasksCount})</span>
              </button>
            )}

            {/* Toggle for integrated tasks */}
            <button
              onClick={() => setShowIntegratedTasks(!showIntegratedTasks)}
              className={`flex items-center space-x-1.5 px-3 py-2 border rounded-lg transition-all duration-200 text-sm ${
                showIntegratedTasks
                  ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                  : "bg-[#1e1e1e] border-[#2d2d2d] text-[#a1a1a1] hover:bg-[#2a2a2a]"
              }`}
              title={showIntegratedTasks ? "Hide calendar events" : "Show calendar events"}
            >
              {showIntegratedTasks ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <Mail className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowAddColumn(true)}
              className="flex items-center space-x-1.5 px-3 py-2 bg-[#1e1e1e] border border-[#2d2d2d] text-white rounded-lg hover:bg-[#2a2a2a] transition-all duration-200 text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Column</span>
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-3 mb-3 flex-shrink-0">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              {/* Tag Filter */}
              <div className="flex items-center space-x-2">
                <Tag className="w-4 h-4 text-[#666666]" />
                <span className="text-xs text-[#a1a1a1]">Tag:</span>
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    onClick={() => setSelectedTagFilter(null)}
                    className={`px-2 py-1 rounded text-xs transition-all ${
                      !selectedTagFilter
                        ? "bg-[#2a2a2a] text-white"
                        : "text-[#666666] hover:text-white"
                    }`}
                  >
                    All
                  </button>
                  {availableTags.slice(0, 6).map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => setSelectedTagFilter(selectedTagFilter === tag.name ? null : tag.name)}
                      className={`px-2 py-1 rounded text-xs transition-all ${
                        selectedTagFilter === tag.name
                          ? "ring-1 ring-offset-1 ring-offset-[#1a1a1a]"
                          : "opacity-70 hover:opacity-100"
                      }`}
                      style={{
                        backgroundColor: `${tag.color}20`,
                        color: tag.color,
                        borderColor: selectedTagFilter === tag.name ? tag.color : "transparent",
                      }}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ownership Filter */}
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-[#666666]" />
                <span className="text-xs text-[#a1a1a1]">Show:</span>
                <div className="flex items-center bg-[#0a0a0a] rounded-lg p-0.5">
                  <button
                    onClick={() => setOwnershipFilter("all")}
                    className={`px-2 py-1 rounded text-xs transition-all ${
                      ownershipFilter === "all"
                        ? "bg-[#2a2a2a] text-white"
                        : "text-[#666666] hover:text-white"
                    }`}
                  >
                    All Tasks
                  </button>
                  <button
                    onClick={() => setOwnershipFilter("mine")}
                    className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-all ${
                      ownershipFilter === "mine"
                        ? "bg-green-500/20 text-green-400"
                        : "text-[#666666] hover:text-white"
                    }`}
                  >
                    <User className="w-3 h-3" />
                    <span>Mine</span>
                  </button>
                  <button
                    onClick={() => setOwnershipFilter("delegated")}
                    className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-all ${
                      ownershipFilter === "delegated"
                        ? "bg-orange-500/20 text-orange-400"
                        : "text-[#666666] hover:text-white"
                    }`}
                  >
                    <Users className="w-3 h-3" />
                    <span>Delegated</span>
                  </button>
                </div>
              </div>

              {/* Clear Filters */}
              {activeFiltersCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="flex items-center space-x-1 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded transition-all"
                >
                  <X className="w-3 h-3" />
                  <span>Clear filters</span>
                </button>
              )}

              {/* Results Count */}
              <div className="text-xs text-[#666666] ml-auto">
                Showing {filteredTasks.length} of {tasks.length} tasks
              </div>
            </div>
          </div>
        )}

        {/* Add Column Modal */}
        {showAddColumn && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6 w-96">
              <h2 className="text-xl font-semibold text-white mb-4">
                Add New Column
              </h2>
              <input
                type="text"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="Enter column name..."
                className="w-full px-3 py-2 rounded-lg border border-[#2d2d2d] bg-[#0a0a0a] text-white placeholder-[#666666] focus:border-[#3a3a3a] focus:outline-none mb-4"
                onKeyPress={(e) => e.key === "Enter" && addColumn()}
              />
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowAddColumn(false);
                    setNewColumnName("");
                  }}
                  className="px-4 py-2 text-[#a1a1a1] hover:bg-[#2a2a2a] border border-[#2d2d2d] rounded-lg transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={addColumn}
                  className="px-4 py-2 bg-[#1e1e1e] border border-[#2d2d2d] text-white rounded-lg hover:bg-[#2a2a2a] hover:border-[#3a3a3a] transition-all duration-200"
                >
                  Add Column
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Task Modal */}
        {showTaskModal && newTaskColumn && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg w-full max-w-md">
              {/* Header */}
              <div className="p-4 border-b border-[#2d2d2d]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: columns.find(c => c.id === newTaskColumn)?.color || "#3B82F6" }}
                    ></div>
                    <h2 className="text-lg font-semibold text-white">
                      Add Task to {columns.find(c => c.id === newTaskColumn)?.name || "Column"}
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowTaskModal(false)}
                    className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-[#a1a1a1] hover:text-white" />
                  </button>
                </div>
              </div>

              {/* Form */}
              <div className="p-4 space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-[#a1a1a1] mb-2">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="What needs to be done?"
                    className="w-full px-3 py-2 rounded-lg border border-[#2d2d2d] bg-[#0a0a0a] text-white placeholder-[#666666] focus:border-[#3a3a3a] focus:outline-none"
                    autoFocus
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && newTaskTitle.trim()) {
                        handleSaveNewTask();
                      }
                    }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-[#a1a1a1] mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    placeholder="Add details..."
                    className="w-full px-3 py-2 rounded-lg border border-[#2d2d2d] bg-[#0a0a0a] text-white placeholder-[#666666] focus:border-[#3a3a3a] focus:outline-none resize-none"
                    rows="2"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-[#a1a1a1] mb-2">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          if (newTaskTags.includes(tag.name)) {
                            handleRemoveTagFromNewTask(tag.name);
                          } else {
                            handleAddTagToNewTask(tag.name);
                          }
                        }}
                        className={`px-2 py-1 rounded text-xs transition-all ${
                          newTaskTags.includes(tag.name)
                            ? "ring-2 ring-offset-1 ring-offset-[#1a1a1a]"
                            : "opacity-60 hover:opacity-100"
                        }`}
                        style={{
                          backgroundColor: `${tag.color}20`,
                          color: tag.color,
                          ringColor: newTaskTags.includes(tag.name) ? tag.color : "transparent",
                        }}
                      >
                        <Tag className="w-3 h-3 inline mr-1" />
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    onClick={() => setShowTaskModal(false)}
                    className="px-4 py-2 text-[#a1a1a1] hover:bg-[#2a2a2a] border border-[#2d2d2d] rounded-lg transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNewTask}
                    disabled={!newTaskTitle.trim() || savingTask}
                    className="px-4 py-2 bg-[#1e1e1e] border border-[#2d2d2d] text-white rounded-lg hover:bg-[#2a2a2a] hover:border-[#3a3a3a] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingTask ? "Adding..." : "Add Task"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}



        {/* Kanban Board */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => { clearMergeTimer(); setActiveTask(null); }}
        >
          <div className="flex space-x-3 flex-1 min-h-0">
            {columns.map((column) => (
              <div key={column.id} className="group flex-1 min-w-0 h-full">
                <KanbanColumn
                  column={column}
                  tasks={filteredTasks}
                  availableTags={availableTags}
                  onDeleteColumn={deleteColumn}
                  onShowTimeline={showTaskTimeline}
                  onAddTask={handleAddTaskToColumn}
                  onHideTask={hideTask}
                  onUnhideTask={unhideTask}
                  showHiddenTasks={showHiddenTasks}
                  mergeTarget={mergeTarget}
                  mergeReady={mergeReady}
                  onUngroupTask={ungroupTask}
                  allTasks={tasks}
                />
              </div>
            ))}
          </div>

          {/* Drag Overlay - Shows floating card while dragging */}
          <DragOverlay
            dropAnimation={{
              duration: 200,
              easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
            }}
          >
            {activeTask ? (
              <div className="bg-[#1a1a1a] border-2 border-[#4a4a4a] rounded-lg p-4 shadow-2xl transform rotate-2 scale-105 backdrop-blur-sm animate-pulse">
                <div className="absolute inset-0 bg-gradient-to-br from-[#3a3a3a]/30 to-transparent rounded-lg pointer-events-none"></div>
                <div className="relative z-10">
                  <h3 className="text-white font-medium text-sm mb-2 line-clamp-2">
                    {activeTask.title}
                  </h3>

                  {activeTask.description && (
                    <p className="text-[#a1a1a1] text-xs mb-3 line-clamp-2">
                      {activeTask.description}
                    </p>
                  )}

                  {/* Tags */}
                  {activeTask.tags && activeTask.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {activeTask.tags.slice(0, 3).map((tagName, index) => {
                        const tagInfo = availableTags.find(
                          (t) => t.name === tagName
                        );
                        const bgColor = tagInfo?.color
                          ? `${tagInfo.color}20`
                          : "#8B5CF620";
                        const textColor = tagInfo?.color || "#8B5CF6";
                        return (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                            style={{
                              backgroundColor: bgColor,
                              color: textColor,
                              border: `1px solid ${textColor}40`,
                            }}
                          >
                            <Tag className="w-2.5 h-2.5 mr-1" />
                            {tagName}
                          </span>
                        );
                      })}
                      {activeTask.tags.length > 3 && (
                        <span className="text-[#666666] text-xs">
                          +{activeTask.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Date */}
                  <div className="flex items-center justify-between text-xs text-[#666666]">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>
                        {new Date(activeTask.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

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
