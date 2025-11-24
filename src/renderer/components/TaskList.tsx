import React, { useMemo } from 'react';
import { Task } from '../types';
import SmallTaskCard from './SmallTaskCard';

interface TaskListProps {
  tasks: Task[];
  onTaskSelect: (task: Task) => void;
}

const TaskList: React.FC<TaskListProps> = ({ tasks, onTaskSelect }) => {
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      // 1. Priority
      const priorityOrder = { high: 3, medium: 2, low: 1, undefined: 0 };
      const pA = priorityOrder[a.priority || 'medium'];
      const pB = priorityOrder[b.priority || 'medium'];
      if (pA !== pB) return pB - pA; // Higher priority first

      // 2. Scheduled Time (Earliest first)
      if (a.scheduledTime && b.scheduledTime) {
        return new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime();
      }
      if (a.scheduledTime) return -1;
      if (b.scheduledTime) return 1;

      // 3. Creation Date (Newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-gray-400">
        <div className="text-center">
          <p>No tasks found.</p>
          <p className="text-sm">Create a new task to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 overflow-y-auto h-full content-start">
      {sortedTasks.map(task => (
        <SmallTaskCard
          key={task.id}
          task={task}
          onSelect={onTaskSelect}
        />
      ))}
    </div>
  );
};

export default TaskList;