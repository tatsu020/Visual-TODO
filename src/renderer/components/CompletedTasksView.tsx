import React, { useMemo } from 'react';
import { Trophy, Calendar, MapPin, Clock, CheckCircle2, Sparkles } from 'lucide-react';
import { useTask } from '../contexts/TaskContext';
import { Task } from '../types';
import { useHoverImage } from '../contexts/HoverImageContext';

const CompletedTasksView: React.FC = () => {
  const { tasks } = useTask();
  const { showHoverImage, hideHoverImage } = useHoverImage();

  const completedTasks = useMemo(() => {
    return tasks
      .filter(task => task.status === 'completed')
      .sort((a, b) => {
        const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return dateB - dateA;
      });
  }, [tasks]);

  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    let todayCount = 0;
    let weekCount = 0;

    completedTasks.forEach(task => {
      if (task.completedAt) {
        const completedDate = new Date(task.completedAt);
        if (completedDate >= today) {
          todayCount++;
        }
        if (completedDate >= weekStart) {
          weekCount++;
        }
      }
    });

    return {
      total: completedTasks.length,
      today: todayCount,
      week: weekCount,
    };
  }, [completedTasks]);

  const formatCompletedDate = (dateStr?: string) => {
    if (!dateStr) return '--';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return '今日 ' + date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return '昨日 ' + date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
      return diffDays + '日前';
    } else {
      return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-br from-amber-50 via-white to-emerald-50 overflow-hidden font-sans">
      <div className="bg-white/80 backdrop-blur-sm px-8 py-6 border-b border-gray-100 flex-shrink-0">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-2 rounded-xl shadow-lg shadow-amber-200">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Success Gallery</h1>
                <p className="text-sm text-gray-500 mt-0.5">あなたが達成した成果のコレクション</p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-600">{stats.total}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">達成総数</div>
              </div>
              <div className="h-10 w-px bg-gray-200" />
              <div className="text-center">
                <div className="text-2xl font-semibold text-emerald-600">{stats.today}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">今日</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-blue-600">{stats.week}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">今週</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-8">
          {completedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-6">
                <Sparkles className="w-12 h-12 text-gray-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">まだ完了タスクがありません</h2>
              <p className="text-gray-500 text-center max-w-md">
                タスクを完了すると、ここにあなたの達成した成果がギャラリーとして表示されます。
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {completedTasks.map((task) => (
                <GalleryCard
                  key={task.id}
                  task={task}
                  formatCompletedDate={formatCompletedDate}
                  showHoverImage={showHoverImage}
                  hideHoverImage={hideHoverImage}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface GalleryCardProps {
  task: Task;
  formatCompletedDate: (dateStr?: string) => string;
  showHoverImage: (imageUrl: string, title: string, rect: DOMRect) => void;
  hideHoverImage: () => void;
}

const GalleryCard: React.FC<GalleryCardProps> = ({
  task,
  formatCompletedDate,
  showHoverImage,
  hideHoverImage,
}) => {
  return (
    <div className="group relative bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-amber-200">
      <div className="absolute top-3 right-3 z-10">
        <div className="bg-emerald-500 text-white p-1.5 rounded-full shadow-lg">
          <CheckCircle2 className="w-4 h-4" />
        </div>
      </div>
      <div
        className="aspect-square bg-gradient-to-br from-gray-100 to-gray-50 overflow-hidden cursor-pointer"
        onMouseEnter={(e) => {
          if (task.imageUrl) {
            showHoverImage(task.imageUrl, task.title, e.currentTarget.getBoundingClientRect());
          }
        }}
        onMouseLeave={hideHoverImage}
      >
        {task.imageUrl ? (
          <img
            src={task.imageUrl}
            alt={task.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <span className="text-5xl opacity-30">🎯</span>
              <p className="text-xs text-gray-400 mt-2">画像なし</p>
            </div>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 truncate mb-2 group-hover:text-amber-700 transition-colors">
          {task.title}
        </h3>
        <div className="space-y-1.5 text-xs text-gray-500">
          <div className="flex items-center">
            <Calendar className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
            <span>{formatCompletedDate(task.completedAt)}</span>
          </div>
          <div className="flex items-center gap-3">
            {(task.scheduledTime || task.scheduledTimeEnd) && (
              <div className="flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1 text-gray-400" />
                <span>
                  {task.scheduledTime || ''}
                  {task.scheduledTime && task.scheduledTimeEnd ? ' - ' : ''}
                  {task.scheduledTimeEnd || ''}
                </span>
              </div>
            )}
            {task.location && (
              <div className="flex items-center truncate">
                <MapPin className="w-3.5 h-3.5 mr-1 text-gray-400 flex-shrink-0" />
                <span className="truncate">{task.location}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="absolute inset-0 rounded-2xl ring-2 ring-amber-400 ring-opacity-0 group-hover:ring-opacity-30 transition-all duration-300 pointer-events-none" />
    </div>
  );
};

export default CompletedTasksView;

