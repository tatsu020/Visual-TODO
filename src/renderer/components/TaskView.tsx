import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTask } from '../contexts/TaskContext';
import { Task } from '../types';
import TaskList from './TaskList';
import TaskForm from './TaskForm';
import NowCard from './NowCard';

const TaskView: React.FC = () => {
  const { tasks, loading, error, updateTask } = useTask();
  const [showForm, setShowForm] = useState(false);

  // "NOW" task state
  const [nowTaskId, setNowTaskId] = useState<number | null>(null);

  // Derive the current NOW task object
  const nowTask = tasks.find(t => t.id === nowTaskId) || null;

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
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Header / Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <h1 className="text-lg font-bold text-gray-800">Visual TODO</h1>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Main Content Area - Split View */}
      <div className="flex-1 flex flex-col min-h-0">

        {/* Top Area: NOW Card (Fixed height or flexible?) 
            Let's give it a substantial portion, e.g., 40-50% or fixed height.
        */}
        <div className="h-[45%] p-4 pb-2 min-h-[300px]">
          <NowCard
            task={nowTask}
            onComplete={handleCompleteNowTask}
          />
        </div>

        {/* Bottom Area: Task List */}
        <div className="flex-1 p-4 pt-2 min-h-0 flex flex-col">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Up Next</h3>
            <span className="text-xs text-gray-400">{listTasks.length} tasks</span>
          </div>
          <div className="flex-1 border border-gray-200 rounded-xl bg-gray-100/50 overflow-hidden">
            <TaskList
              tasks={listTasks}
              onTaskSelect={handleTaskSelect}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      {showForm && (
        <TaskForm
          onClose={() => setShowForm(false)}
          onSuccess={() => setShowForm(false)}
        />
      )}
    </div>
  );
};

export default TaskView;