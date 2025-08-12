import React from 'react';
import { CheckCircle, Clock, AlertCircle, PauseCircle } from 'lucide-react';
import { TaskStats as TaskStatsType } from '../types';

interface TaskStatsProps {
  stats: TaskStatsType;
  onCompletedClick?: () => void;
}

const TaskStats: React.FC<TaskStatsProps> = ({ stats, onCompletedClick }) => {
  const statItems = [
    {
      label: '完了',
      value: stats.completed,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      label: '進行中',
      value: stats.inProgress,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200'
    },
    {
      label: '未着手',
      value: stats.pending,
      icon: AlertCircle,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      label: '一時停止',
      value: stats.paused,
      icon: PauseCircle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
    }
  ];

  return (
    <div className="flex items-center space-x-4">
      {statItems.map((item) => {
        const Icon = item.icon;
        const isCompletedStat = item.label === '完了';
        const isClickable = isCompletedStat && onCompletedClick && item.value > 0;
        
        return (
          <div
            key={item.label}
            className={`flex items-center space-x-3 px-4 py-3 rounded-lg ${item.bgColor} border ${item.borderColor} ${
              isClickable ? 'cursor-pointer hover:shadow-md hover:scale-105 transition-all duration-200' : ''
            }`}
            data-testid={`stats-${item.label}`}
            onClick={isClickable ? onCompletedClick : undefined}
          >
            <Icon className={`w-6 h-6 ${item.color}`} />
            <div>
              <p className="text-sm font-medium text-secondary-600">{item.label}</p>
              <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
            </div>
            {isClickable && (
              <div className="text-xs text-secondary-500 ml-1">
                <span>→ 表示</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TaskStats;