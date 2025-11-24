import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Edit, Save } from 'lucide-react';
import { Task, TaskWithSteps, TaskStep } from '../types';
import { useTask } from '../contexts/TaskContext';
import { TaskStepsManager } from './TaskStepsManager';

interface TaskDetailViewProps {
  task: Task;
  onClose: () => void;
  onTaskUpdate?: (updatedTask: Task) => void;
}

export const TaskDetailView: React.FC<TaskDetailViewProps> = ({
  task,
  onClose,
  onTaskUpdate
}) => {
  const { updateTask } = useTask();
  const [taskWithSteps, setTaskWithSteps] = useState<TaskWithSteps | null>(null);
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState<Task>(task);
  const [isSaving, setIsSaving] = useState(false);

  const electronAPI = (window as any).electronAPI;

  // タスクとステップの詳細データを読み込み
  const loadTaskWithSteps = async () => {
    if (!task.id) return;

    setIsLoading(true);
    try {
      const result = await electronAPI.tasks.getWithSteps(task.id);
      if (result.success && result.task) {
        setTaskWithSteps(result.task);
        setSteps(result.task.steps || []);
      } else {
        console.error('Failed to load task with steps:', result.error);
        // フォールバック: 基本タスク情報のみ
        setTaskWithSteps({ ...task, steps: [] });
        setSteps([]);
      }
    } catch (error) {
      console.error('Error loading task with steps:', error);
      setTaskWithSteps({ ...task, steps: [] });
      setSteps([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 初期読み込み
  useEffect(() => {
    loadTaskWithSteps();
  }, [task.id]);

  // タスクの基本情報を更新
  const handleTaskUpdate = async () => {
    if (!task.id) return;

    setIsSaving(true);
    try {
      await updateTask(task.id, {
        title: editedTask.title,
        description: editedTask.description,
        type: editedTask.type,
        scheduledTime: editedTask.scheduledTime,
        estimatedDuration: editedTask.estimatedDuration,
        dueDate: editedTask.dueDate,
        recurringPattern: editedTask.recurringPattern
      });

      // 親コンポーネントに更新を通知
      onTaskUpdate?.(editedTask);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update task:', error);
      alert('タスクの更新に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  // ステップ変更時のコールバック
  const handleStepsChange = (updatedSteps: TaskStep[]) => {
    setSteps(updatedSteps);

    // タスクWithStepsの進捗情報を更新
    if (taskWithSteps) {
      const completedSteps = updatedSteps.filter(step => step.status === 'completed').length;
      const totalSteps = updatedSteps.length;
      const stepProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

      setTaskWithSteps({
        ...taskWithSteps,
        steps: updatedSteps,
        completedSteps,
        totalSteps,
        stepProgress
      });
    }
  };

  // 編集キャンセル
  const handleCancelEdit = () => {
    setEditedTask(task);
    setIsEditing(false);
  };

  // ステータス表示用のスタイル
  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'inProgress':
        return 'bg-blue-100 text-blue-800';
      case 'paused':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return '完了';
      case 'inProgress': return '進行中';
      case 'paused': return '一時停止';
      case 'pending': return '未着手';
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600">タスク詳細を読み込み中...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-gray-900">タスク詳細</h2>
            {taskWithSteps && (taskWithSteps.totalSteps || 0) > 0 && (
              <span className="text-sm text-gray-500">
                ({taskWithSteps.completedSteps}/{taskWithSteps.totalSteps || 0} ステップ完了)
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center space-x-1 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Edit className="w-4 h-4" />
                <span>編集</span>
              </button>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleTaskUpdate}
                  disabled={isSaving}
                  className="flex items-center space-x-1 px-3 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? '保存中...' : '保存'}</span>
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span>キャンセル</span>
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* タスク基本情報 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左カラム */}
            <div className="space-y-4">
              {/* タイトル */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  タスクタイトル
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedTask.title}
                    onChange={(e) => setEditedTask(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-lg font-medium text-gray-900">{task.title}</p>
                )}
              </div>

              {/* 説明 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  説明
                </label>
                {isEditing ? (
                  <textarea
                    value={editedTask.description || ''}
                    onChange={(e) => setEditedTask(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                  />
                ) : (
                  <p className="text-gray-700">{task.description || '説明なし'}</p>
                )}
              </div>

              {/* ステータス */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ステータス
                </label>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusStyles(task.status)}`}>
                  {getStatusLabel(task.status)}
                </span>
              </div>
            </div>

            {/* 右カラム */}
            <div className="space-y-4">
              {/* メタデータ */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h3 className="font-medium text-gray-900">タスク情報</h3>

                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>種類: {task.type === 'immediate' ? '即時タスク' : task.type === 'scheduled' ? '期限付きタスク' : '定期タスク'}</span>
                </div>

                {task.estimatedDuration && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>予定時間: {task.estimatedDuration}分</span>
                  </div>
                )}

                {task.dueDate && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>期限: {new Date(task.dueDate).toLocaleDateString('ja-JP')}</span>
                  </div>
                )}

                <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                  作成日: {new Date(task.createdAt).toLocaleDateString('ja-JP')}
                </div>
              </div>

              {/* 進捗表示 */}
              {taskWithSteps && (taskWithSteps.totalSteps || 0) > 0 && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 mb-3">ステップ進捗</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-700">完了率</span>
                      <span className="font-medium text-blue-900">{taskWithSteps.stepProgress}%</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${taskWithSteps.stepProgress}%` }}
                      />
                    </div>
                    <div className="text-xs text-blue-600">
                      {taskWithSteps.completedSteps} / {taskWithSteps.totalSteps || 0} ステップ完了
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ステップ管理セクション */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">タスクのステップ</h3>
            <TaskStepsManager
              taskId={task.id!}
              initialSteps={steps}
              onStepsChange={handleStepsChange}
              readOnly={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailView;