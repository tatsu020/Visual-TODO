import React, { useState } from 'react';
import { Plus, Search, Filter, Settings } from 'lucide-react';
import { useTask } from '../contexts/TaskContext';
import { useCategory } from '../contexts/CategoryContext';
import { Task } from '../types';
import TaskList from './TaskList';
import TaskForm from './TaskForm';
import TaskStats from './TaskStats';
import TrashBin from './TrashBin';
import CrumpleOverlay from './CrumpleOverlay';
import CategoryManager from './CategoryManager';
import { TaskDetailView } from './TaskDetailView';

const TaskView: React.FC = () => {
  const { tasks, stats, loading, error, updateTask, deleteTask } = useTask();
  const { categories, createCategory, updateCategory, deleteCategory } = useCategory();
  const [showForm, setShowForm] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [crumplingTask, setCrumplingTask] = useState<Task | null>(null);
  const [isCrumpleActive, setIsCrumpleActive] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Handle status filter
    let matchesStatus = true;
    if (statusFilter === 'active') {
      matchesStatus = task.status !== 'completed';
    } else if (statusFilter !== 'all') {
      matchesStatus = task.status === statusFilter;
    }
    
    const matchesCategory = categoryFilter === 'all' || task.category === categoryFilter;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });


  const handleTrashCrumple = (taskId: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setCrumplingTask(task);
      setIsCrumpleActive(true);
    }
  };

  const handleTrashComplete = async (taskId: number) => {
    try {
      await updateTask(taskId, { status: 'completed' });
    } catch (error) {
      console.error('Failed to complete task via trash:', error);
    }
  };

  const handleTrashDelete = async (taskId: number) => {
    try {
      await deleteTask(taskId);
    } catch (error) {
      console.error('Failed to delete task via trash:', error);
    }
  };

  const handleCrumpleComplete = () => {
    setIsCrumpleActive(false);
    setCrumplingTask(null);
  };

  const handleCompletedStatsClick = () => {
    if (statusFilter === 'completed') {
      // If already showing completed tasks, toggle back to active tasks
      setStatusFilter('active');
    } else {
      // Show completed tasks
      setStatusFilter('completed');
    }
  };

  const handleTaskDetailClick = (task: Task) => {
    setSelectedTask(task);
  };

  const handleCloseTaskDetail = () => {
    setSelectedTask(null);
  };

  const handleTaskUpdate = (_updatedTask: Task) => {
    // TaskContextが自動的に更新を反映するため、特別な処理は不要
    // 必要に応じてローカル状態の更新処理を追加
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-secondary-600">タスクを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">エラーが発生しました</p>
          <p className="text-secondary-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-secondary-200 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-secondary-900">タスク管理</h2>
            <span className="text-secondary-500 text-sm">
              ({stats.total}個のタスク, 完了率: {stats.completionRate}%)
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowCategoryManager(true)}
              className="btn btn-secondary flex items-center space-x-2"
              title="カテゴリ管理"
            >
              <Settings className="w-4 h-4" />
              <span>カテゴリ</span>
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="btn btn-primary flex items-center space-x-2"
              data-testid="new-task-button"
            >
              <Plus className="w-4 h-4" />
              <span>新しいタスク</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <TaskStats stats={stats} onCompletedClick={handleCompletedStatsClick} />

        {/* Search and Filters */}
        <div className="flex items-center space-x-4 mt-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary-400" />
            <input
              type="text"
              placeholder="タスクを検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10 py-2 text-sm"
              data-testid="search-input"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-secondary-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select py-2 text-sm"
              data-testid="status-filter"
            >
              <option value="active">実行中タスク</option>
              <option value="all">すべての状態</option>
              <option value="pending">未着手</option>
              <option value="inProgress">進行中</option>
              <option value="completed">完了</option>
              <option value="paused">一時停止</option>
            </select>
            
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="select py-2 text-sm"
              data-testid="category-filter"
            >
              <option value="all">すべてのカテゴリ</option>
              {categories.map(category => (
                <option key={category.name} value={category.name}>{category.label}</option>
              ))}
            </select>
            
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 min-h-0">
        <TaskList tasks={filteredTasks} showCompletedOnly={statusFilter === 'completed'} onTaskDetailClick={handleTaskDetailClick} />
      </div>

      {/* Task Form Modal */}
      {showForm && (
        <TaskForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
          }}
        />
      )}

      {/* Category Manager Modal */}
      {showCategoryManager && (
        <CategoryManager
          categories={categories}
          onCategoryCreate={createCategory}
          onCategoryUpdate={updateCategory}
          onCategoryDelete={deleteCategory}
          onClose={() => setShowCategoryManager(false)}
        />
      )}

      {/* Trash Bin */}
      <TrashBin onComplete={handleTrashComplete} onDelete={handleTrashDelete} onCrumple={handleTrashCrumple} />

      {/* Crumple Overlay */}
      <CrumpleOverlay 
        task={crumplingTask}
        isActive={isCrumpleActive}
        onComplete={handleCrumpleComplete}
      />

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailView
          task={selectedTask}
          onClose={handleCloseTaskDetail}
          onTaskUpdate={handleTaskUpdate}
        />
      )}
    </div>
  );
};

export default TaskView;