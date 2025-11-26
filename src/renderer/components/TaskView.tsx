import React, { useState, useEffect, useCallback } from 'react';
import { Plus, CheckSquare } from 'lucide-react';
import { useTask } from '../contexts/TaskContext';
import { Task } from '../types';
import TaskList from './TaskList';
import TaskForm from './TaskForm';
import NowCard from './NowCard';

const NOW_TASK_ID_KEY = 'nowTaskId';

const TaskView: React.FC = () => {
  const { tasks, loading, error, updateTask, deleteTask } = useTask();
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // "NOW" task state - persisted to settings
  const [nowTaskId, setNowTaskIdState] = useState<number | null>(null);
  const [nowTaskIdLoaded, setNowTaskIdLoaded] = useState(false);

  // Load nowTaskId from settings on mount
  useEffect(() => {
    const loadNowTaskId = async () => {
      try {
        const result = await window.electronAPI.settings.getMany([NOW_TASK_ID_KEY]);
        if (result.success && result.values) {
          const savedId = result.values[NOW_TASK_ID_KEY];
          if (savedId) {
            const parsedId = parseInt(savedId, 10);
            if (!isNaN(parsedId)) {
              setNowTaskIdState(parsedId);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load nowTaskId from settings:', err);
      } finally {
        setNowTaskIdLoaded(true);
      }
    };
    loadNowTaskId();
  }, []);

  // Persist nowTaskId to settings when it changes (with broadcast to widget)
  const setNowTaskId = useCallback(async (id: number | null) => {
    setNowTaskIdState(id);
    try {
      // 新しいIPCを使用してnowTaskIdを設定し、ウィジェットに通知
      await window.electronAPI.nowTask.setNowTaskId(id);
    } catch (err) {
      console.error('Failed to save nowTaskId to settings:', err);
      // フォールバック: 直接settings APIを使用
      try {
        if (id === null) {
          await window.electronAPI.settings.setMany({ [NOW_TASK_ID_KEY]: '' });
        } else {
          await window.electronAPI.settings.setMany({ [NOW_TASK_ID_KEY]: String(id) });
        }
      } catch (fallbackErr) {
        console.error('Fallback also failed:', fallbackErr);
      }
    }
  }, []);

  // Derive the current NOW task object
  const nowTask = tasks.find(t => t.id === nowTaskId) || null;

  // Clear nowTaskId if the task no longer exists or is completed
  useEffect(() => {
    if (!nowTaskIdLoaded || !tasks.length) return;
    
    if (nowTaskId !== null) {
      const task = tasks.find(t => t.id === nowTaskId);
      // If task doesn't exist or is already completed, clear the nowTaskId
      if (!task || task.status === 'completed') {
        setNowTaskId(null);
      }
    }
  }, [nowTaskId, tasks, nowTaskIdLoaded, setNowTaskId]);

  // Filter out the NOW task and completed tasks from the list
  const listTasks = tasks.filter(t => t.id !== nowTaskId && t.status !== 'completed');

  const handleTaskSelect = (task: Task) => {
    if (task.id) {
      setNowTaskId(task.id);
    }
  };

  const handleCompleteNowTask = async (taskId: number) => {
    try {
      await updateTask(taskId, { status: 'completed' });
      setNowTaskId(null);
    } catch (err) {
      console.error('Failed to complete task:', err);
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setShowForm(true);
  };

  const handleDeleteTask = async (task: Task) => {
    if (task.id && window.confirm(`「${task.title}」を削除しますか？`)) {
      try {
        await deleteTask(task.id);
      } catch (err) {
        console.error('Failed to delete task:', err);
      }
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingTask(null);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-600">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden font-sans">
      {/* Header / Toolbar */}
      <div className="bg-white px-8 py-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-1.5 rounded text-blue-600">
            <CheckSquare className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Visual TODO</h1>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-all shadow-sm hover:shadow-md font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Main Content Area - Single Scrollable View */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 pb-12">

          {/* NOW Card Section */}
          <div className="mb-12">
            <div className="text-sm font-medium text-gray-500 mb-4 pl-1">NOW Card</div>
            <div className="h-[450px] w-full">
              <NowCard
                task={nowTask}
                onComplete={handleCompleteNowTask}
                onTaskDrop={(taskId) => setNowTaskId(taskId)}
              />
            </div>
          </div>

          {/* NEXT TASKS Section */}
          <div>
            <div className="mb-6 border-b border-gray-100 pb-4">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">NEXT TASKS</h3>
            </div>
            <div>
              <TaskList
                tasks={listTasks}
                onTaskSelect={handleTaskSelect}
                onTaskEdit={handleEditTask}
                onTaskDelete={handleDeleteTask}
              />
            </div>
          </div>

        </div>
      </div>

      {/* Modals */}
      {showForm && (
        <TaskForm
          onClose={handleCloseForm}
          onSuccess={handleCloseForm}
          initialData={editingTask || undefined}
          taskId={editingTask?.id}
        />
      )}
    </div>
  );
};

export default TaskView;