import React, { useMemo } from 'react';
import { Task } from '../types';
import SmallTaskCard from './SmallTaskCard';

interface TaskListProps {
  tasks: Task[];
  onTaskSelect: (task: Task) => void;
  onTaskEdit: (task: Task) => void;
}

const TaskList: React.FC<TaskListProps> = ({ tasks, onTaskSelect, onTaskEdit }) => {
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      // 1. Priority
      const priorityOrder = { high: 3, medium: 2, low: 1, undefined: 0 };
      const pA = priorityOrder[a.priority || 'medium'];
      const pB = priorityOrder[b.priority || 'medium'];
      if (pA !== pB) return pB - pA; // Higher priority first

      // 2. Scheduled Time (Earliest first)
      const timeA = a.scheduledTime ? new Date(a.scheduledTime).getTime() : NaN;
      const timeB = b.scheduledTime ? new Date(b.scheduledTime).getTime() : NaN;

      if (!isNaN(timeA) && !isNaN(timeB)) {
        return timeA - timeB;
      }
      if (!isNaN(timeA)) return -1;
      if (!isNaN(timeB)) return 1;

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
    <div className="flex flex-col w-full">
      {sortedTasks.map(task => (
        <SmallTaskCard
          key={task.id}
          task={task}
          onSelect={onTaskSelect}
          onEdit={onTaskEdit}
        />
      ))}
    </div>
  );
};

export default TaskList;