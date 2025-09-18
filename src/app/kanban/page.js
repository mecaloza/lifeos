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
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// Draggable Task Component
function KanbanTask({ task, availableTags, onShowTimeline }) {
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
      className={`bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-4 hover:bg-[#1e1e1e] hover:border-[#3a3a3a] transition-all duration-200 group ${
        isDragging
          ? "opacity-40 cursor-grabbing"
          : "cursor-grab hover:shadow-lg"
      }`}
    >
      <h3 className="text-white font-medium text-sm mb-2 line-clamp-2">
        {task.title}
      </h3>

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
}) {
  const tasksInColumn = tasks.filter((task) => task.status === column.id);

  const { isOver, setNodeRef } = useDroppable({
    id: column.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`bg-[#0a0a0a] rounded-lg border flex flex-col min-h-[600px] w-72 flex-shrink-0 transition-all duration-200 ${
        isOver
          ? "border-[#4a4a4a] bg-[#1a1a1a] shadow-lg ring-2 ring-[#3a3a3a]/50"
          : "border-[#1a1a1a]"
      }`}
    >
      {/* Column Header */}
      <div className="p-4 border-b border-[#1a1a1a]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: column.color }}
            ></div>
            <h2 className="text-white font-semibold text-sm">{column.name}</h2>
            <span className="bg-[#1a1a1a] text-[#a1a1a1] text-xs px-2 py-0.5 rounded-full">
              {tasksInColumn.length}
            </span>
          </div>
          {column.id !== "backlog" && (
            <button
              onClick={() => onDeleteColumn(column.id)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#2a2a2a] rounded transition-all"
            >
              <X className="w-4 h-4 text-[#666666] hover:text-red-400" />
            </button>
          )}
        </div>
      </div>

      {/* Column Content - Drop Zone */}
      <div className="p-4 flex-1 min-h-0">
        <SortableContext
          items={tasksInColumn.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3 min-h-full">
            {tasksInColumn.map((task) => (
              <KanbanTask
                key={task.id}
                task={task}
                availableTags={availableTags}
                onShowTimeline={onShowTimeline}
              />
            ))}
            {tasksInColumn.length === 0 && (
              <div
                className={`text-center py-12 text-sm transition-all duration-200 ${
                  isOver
                    ? "text-[#a1a1a1] bg-[#2a2a2a]/20 border-2 border-dashed border-[#3a3a3a] rounded-lg"
                    : "text-[#666666]"
                }`}
              >
                {isOver ? "Drop here!" : "Drop tasks here"}
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

  const handleDragStart = (event) => {
    const { active } = event;
    const task = tasks.find((task) => task.id === active.id);
    setActiveTask(task);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeTaskData = tasks.find((task) => task.id === active.id);
    if (!activeTaskData) return;

    // Find which column the task was dropped on
    let newStatus = activeTaskData.status;

    // Check if dropped directly on a column
    const targetColumn = columns.find((col) => col.id === over.id);
    if (targetColumn) {
      newStatus = targetColumn.id;
    } else {
      // If dropped on another task, find that task's column
      const targetTask = tasks.find((task) => task.id === over.id);
      if (targetTask) {
        newStatus = targetTask.status;
      }
    }

    if (newStatus !== activeTaskData.status) {
      // Update task status
      const updatedTasks = tasks.map((task) =>
        task.id === activeTaskData.id ? { ...task, status: newStatus } : task
      );
      setTasks(updatedTasks);

      // Update in Supabase (this will trigger the status history tracking automatically)
      try {
        const { error } = await supabase
          .from("tasks")
          .update({ status: newStatus })
          .eq("id", activeTaskData.id);

        if (error) {
          console.error("Error updating task status:", error);
          // Revert the optimistic update if it failed
          setTasks(tasks);
        } else {
          localStorage.setItem("tasks", JSON.stringify(updatedTasks));
          // Show success feedback
          console.log(`Task "${activeTaskData.title}" moved to ${newStatus}`);
        }
      } catch (error) {
        console.error("Error:", error);
        // Revert the optimistic update if it failed
        setTasks(tasks);
      }
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
            <div className="w-8 h-8 border-2 border-[#a1a1a1] border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-white text-lg font-medium">Loading Kanban...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Kanban Board</h1>
            <p className="text-[#a1a1a1] mt-1 text-base">
              Drag and drop your tasks between columns
            </p>
          </div>
          <button
            onClick={() => setShowAddColumn(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-[#1e1e1e] border border-[#2d2d2d] text-white rounded-lg hover:bg-[#2a2a2a] hover:border-[#3a3a3a] transition-all duration-200 font-medium"
          >
            <Plus className="w-5 h-5" />
            <span>Add Column</span>
          </button>
        </div>

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

        {/* Kanban Board */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex space-x-6 overflow-x-auto pb-6">
            {columns.map((column) => (
              <div key={column.id} className="group">
                <KanbanColumn
                  column={column}
                  tasks={tasks}
                  availableTags={availableTags}
                  onDeleteColumn={deleteColumn}
                  onShowTimeline={showTaskTimeline}
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
