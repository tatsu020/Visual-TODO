import React, { useCallback, useMemo, useRef, useState } from 'react';
import { X, Calendar, Clock, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import { useTask } from '../contexts/TaskContext';
import { useCategory } from '../contexts/CategoryContext';
import { TaskFormData, TaskType, TaskStep } from '../types';
import { StepCreationForm } from './StepCreationForm';

interface TaskFormProps {
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Partial<TaskFormData>;
}

const TaskForm: React.FC<TaskFormProps> = ({ onClose, onSuccess, initialData }) => {
  const { createTask } = useTask();
  const { categories } = useCategory();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  type TempStep = TaskStep & { _uid: string };
  const [tempSteps, setTempSteps] = useState<TempStep[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<TaskFormData>({
    title: initialData?.title || '',
    description: initialData?.description || '',
    category: initialData?.category || 'general',
    type: initialData?.type || 'immediate',
    scheduledTime: initialData?.scheduledTime || '',
    estimatedDuration: initialData?.estimatedDuration || undefined,
    recurringPattern: initialData?.recurringPattern || '',
    dueDate: initialData?.dueDate || '',
  });



  const types: { value: TaskType; label: string }[] = [
    { value: 'immediate', label: '即時タスク' },
    { value: 'scheduled', label: '期限付きタスク' },
    { value: 'recurring', label: '定期タスク' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      alert('タイトルを入力してください。');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // タスクを作成
      const createdTask = await createTask(formData);
      
      // ステップがある場合は保存
      if (tempSteps.length > 0 && createdTask && createdTask.id) {
        const electronAPI = (window as any).electronAPI;
        if (!electronAPI || !electronAPI.taskSteps) {
          throw new Error('Electron API not available');
        }
        
        for (let i = 0; i < tempSteps.length; i++) {
          const step = tempSteps[i];
          const result = await electronAPI.taskSteps.create({
            task_id: createdTask.id,
            title: step.title,
            description: step.description || '',
            order_index: i,
            status: 'pending'
          });
          
          if (!result.success) {
            throw new Error(`ステップ ${i + 1} の作成に失敗: ${result.error}`);
          }
        }
      }
      
      onSuccess();
    } catch (error) {
      console.error('Failed to create task:', error);
      alert('タスクの作成に失敗しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof TaskFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const existingTitles = useMemo(() => tempSteps.map(s => s.title), [tempSteps]);

  const moveStep = useCallback((from: number, to: number) => {
    setTempSteps(prev => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      const reindexed = next.map((s, i) => ({ ...s, order_index: i }));
      return reindexed;
    });
    // 編集行のインデックスを正しく更新
    setEditingIndex(prevIdx => {
      if (prevIdx == null) return null;
      if (prevIdx === from) return to;
      if (from < to && prevIdx > from && prevIdx <= to) return prevIdx - 1;
      if (from > to && prevIdx >= to && prevIdx < from) return prevIdx + 1;
      return prevIdx;
    });
  }, []);

  const deleteStepAt = useCallback((index: number) => {
    setTempSteps(prev => prev.filter((_, i) => i !== index).map((s, i2) => ({ ...s, order_index: i2 })));
    setEditingIndex(prevIdx => {
      if (prevIdx == null) return null;
      if (prevIdx === index) return null;
      if (prevIdx > index) return prevIdx - 1;
      return prevIdx;
    });
  }, []);

  const startEdit = useCallback((index: number) => {
    setEditingIndex(index);
    setEditingTitle(tempSteps[index]?.title || '');
  }, [tempSteps]);

  const saveEdit = useCallback(() => {
    if (editingIndex === null) return;
    const title = editingTitle.trim();
    if (!title) {
      deleteStepAt(editingIndex);
      return;
    }
    setTempSteps(prev => prev.map((s, i) => i === editingIndex ? { ...s, title } : s));
    setEditingIndex(null);
  }, [editingIndex, editingTitle, deleteStepAt]);

  const cancelEdit = useCallback(() => {
    setEditingIndex(null);
    setEditingTitle('');
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-secondary-200">
          <h2 className="text-xl font-bold text-secondary-900">新しいタスク</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              タイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="タスクのタイトルを入力..."
              className="input"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              説明
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="タスクの詳細を入力..."
              rows={3}
              className="textarea"
            />
          </div>

          {/* Category and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                <Tag className="w-4 h-4 inline mr-1" />
                カテゴリ
              </label>
              <select
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                className="select"
              >
                {categories.map(category => (
                  <option key={category.name} value={category.name}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* Task Type */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              タスクの種類
            </label>
            <select
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value)}
              className="select"
            >
              {types.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Scheduled Time */}
          {(formData.type === 'scheduled' || formData.type === 'recurring') && (
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                実行予定時刻
              </label>
              <input
                type="datetime-local"
                value={formData.scheduledTime}
                onChange={(e) => handleChange('scheduledTime', e.target.value)}
                className="input"
              />
            </div>
          )}

          {/* Due Date */}
          {formData.type === 'scheduled' && (
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                締切日
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => handleChange('dueDate', e.target.value)}
                className="input"
              />
            </div>
          )}

          {/* Recurring Pattern */}
          {formData.type === 'recurring' && (
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                繰り返しパターン
              </label>
              <select
                value={formData.recurringPattern}
                onChange={(e) => handleChange('recurringPattern', e.target.value)}
                className="select"
              >
                <option value="">選択してください</option>
                <option value="daily">毎日</option>
                <option value="weekly">毎週</option>
                <option value="monthly">毎月</option>
                <option value="weekdays">平日のみ</option>
                <option value="weekends">週末のみ</option>
              </select>
            </div>
          )}

          {/* Estimated Duration */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              予想所要時間（分）
            </label>
            <input
              type="number"
              value={formData.estimatedDuration || ''}
              onChange={(e) => handleChange('estimatedDuration', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="30"
              min="1"
              className="input"
            />
          </div>

          {/* Steps Section */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowSteps(!showSteps)}
              className="flex items-center justify-between w-full p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <div className="text-left">
                  <div className="font-medium text-gray-700">詳細な手順を追加</div>
                  <div className="text-sm text-gray-500">
                    {tempSteps.length > 0 
                      ? `${tempSteps.length}個のステップが設定されています`
                      : 'タスクを詳細なステップに分けて管理しましょう'
                    }
                  </div>
                </div>
              </div>
              {showSteps ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {showSteps && (
              <div
                className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                onKeyDown={(e) => {
                  if (e.ctrlKey && e.key === 'Enter') {
                    e.preventDefault();
                    setShowSteps(false);
                  }
                }}
              >
                <div className="mb-3">
                  <h4 className="font-medium text-gray-700 mb-1">タスクのステップ</h4>
                  <p className="text-sm text-gray-500">
                    タスクを完了するための詳細な手順を追加できます。作成後にも編集可能です。
                  </p>
                </div>
                
                {/* 仮のステップ管理（タスク作成前なので簡易版） */}
                <div className="space-y-2" ref={listRef}>
                  {tempSteps.map((step, index) => {
                    const isDragging = draggingIndex === index;
                    const isDragOver = dragOverIndex === index;
                    return (
                      <div
                        key={step._uid}
                        className={`flex items-center space-x-3 p-2 bg-white rounded border group transition-shadow ${
                          isDragging ? 'opacity-70 ring-2 ring-blue-300' : ''
                        } ${isDragOver ? 'border-blue-400 bg-blue-50' : ''}`}
                        tabIndex={0}
                        draggable
                        onDragStart={() => setDraggingIndex(index)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragOverIndex !== index) setDragOverIndex(index);
                        }}
                        onDragLeave={() => {
                          if (dragOverIndex === index) setDragOverIndex(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggingIndex !== null && draggingIndex !== index) {
                            moveStep(draggingIndex, index);
                          }
                          setDraggingIndex(null);
                          setDragOverIndex(null);
                        }}
                        onDragEnd={() => {
                          setDraggingIndex(null);
                          setDragOverIndex(null);
                        }}
                        onKeyDown={(e) => {
                        // Alt+↑/↓ 並び替え
                        if (e.altKey && e.key === 'ArrowUp') {
                          e.preventDefault();
                            moveStep(index, index - 1);
                        }
                        if (e.altKey && e.key === 'ArrowDown') {
                          e.preventDefault();
                            moveStep(index, index + 1);
                        }
                        // Delete で削除
                        if (e.key === 'Delete') {
                          e.preventDefault();
                            deleteStepAt(index);
                        }
                        // Backspace 空欄時に削除（編集中に処理）→行側では無視
                        }}
                      >
                        <span className="text-sm text-gray-500 select-none w-6 text-right">{index + 1}.</span>
                        {editingIndex === index ? (
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                saveEdit();
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelEdit();
                              } else if (e.key === 'Backspace' && editingTitle.trim().length === 0) {
                                e.preventDefault();
                                deleteStepAt(index);
                              }
                            }}
                            className="flex-1 text-sm px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            autoFocus
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(index)}
                            className="flex-1 text-left text-sm px-2 py-1 rounded hover:bg-gray-50"
                            title="クリックして編集"
                          >
                            {step.title}
                          </button>
                        )}
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => moveStep(index, index - 1)}
                            className="text-gray-400 hover:text-gray-600 px-1"
                            aria-label="move up"
                            title="Alt+↑"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveStep(index, index + 1)}
                            className="text-gray-400 hover:text-gray-600 px-1"
                            aria-label="move down"
                            title="Alt+↓"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteStepAt(index)}
                            className="text-red-500 hover:bg-red-100 p-1 rounded"
                            aria-label="delete"
                            title="Delete"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  <StepCreationForm 
                    existingTitles={existingTitles}
                    onRequestCollapse={() => setShowSteps(false)}
                    onAdd={(stepTitle) => {
                      try {
                        const uid = (window.crypto && 'randomUUID' in window.crypto)
                          ? (window.crypto as any).randomUUID()
                          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
                        setTempSteps(prev => [...prev, {
                          _uid: uid,
                          task_id: 0, // 仮の値
                          title: stepTitle,
                          description: '', // 必須フィールド
                          order_index: prev.length,
                          status: 'pending',
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString()
                        }]);
                      } catch (error) {
                        console.error('Error adding temp step:', error);
                        alert('ステップの追加に失敗しました。');
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn btn-secondary"
              disabled={isSubmitting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="flex-1 btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? '作成中...' : 'タスクを作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskForm;