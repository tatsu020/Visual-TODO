import React, { useState } from 'react';
import { X, Calendar, MapPin, AlertCircle, AlignLeft } from 'lucide-react';
import { useTask } from '../contexts/TaskContext';
import { TaskFormData } from '../types';

interface TaskFormProps {
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Partial<TaskFormData>;
}

const TaskForm: React.FC<TaskFormProps> = ({ onClose, onSuccess, initialData }) => {
  const { createTask } = useTask();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<TaskFormData>({
    title: initialData?.title || '',
    location: initialData?.location || '',
    scheduledTime: initialData?.scheduledTime || '',
    scheduledTimeEnd: initialData?.scheduledTimeEnd || '',
    priority: initialData?.priority || 'medium',
    description: initialData?.description || '',
    // Default values for hidden fields

    type: 'scheduled', // Default to scheduled to enable time fields logic if needed backend side
    estimatedDuration: 30,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('タイトルを入力してください。');
      return;
    }

    try {
      setIsSubmitting(true);
      await createTask(formData);
      onSuccess();
    } catch (error) {
      console.error('Failed to create task:', error);
      alert('タスクの作成に失敗しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof TaskFormData, value: any) => {
    setFormData((prev: TaskFormData) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
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
          {/* 1. What (Title) */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              What (何を) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="例: プレゼン資料を作成する"
              className="input text-lg"
              required
              autoFocus
            />
          </div>

          {/* 2. Where (Location) */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Where (どこで)
            </label>
            <input
              type="text"
              value={formData.location || ''}
              onChange={(e) => handleChange('location', e.target.value)}
              placeholder="例: オフィスの会議室、自宅のデスク"
              className="input"
            />
          </div>

          {/* 3. When (Time) */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              When (いつ)
            </label>
            <input
              type="datetime-local"
              value={formData.scheduledTime || ''}
              onChange={(e) => handleChange('scheduledTime', e.target.value)}
              className="input"
            />
          </div>

          {/* 4. Priority */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              重要度
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="priority"
                  value="high"
                  checked={formData.priority === 'high'}
                  onChange={(e) => handleChange('priority', e.target.value)}
                  className="text-red-500 focus:ring-red-500"
                />
                <span className="text-secondary-700">🔴 High</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="priority"
                  value="medium"
                  checked={formData.priority === 'medium'}
                  onChange={(e) => handleChange('priority', e.target.value)}
                  className="text-orange-500 focus:ring-orange-500"
                />
                <span className="text-secondary-700">🟠 Medium</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="priority"
                  value="low"
                  checked={formData.priority === 'low'}
                  onChange={(e) => handleChange('priority', e.target.value)}
                  className="text-gray-500 focus:ring-gray-500"
                />
                <span className="text-secondary-700">⚪ Low</span>
              </label>
            </div>
          </div>

          {/* 5. Memo (Description) - Optional, at bottom */}
          <div>
            <label className="block text-sm font-medium text-secondary-500 mb-2">
              <AlignLeft className="w-4 h-4 inline mr-1" />
              メモ (任意)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="補足事項があれば入力..."
              rows={2}
              className="textarea text-sm"
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex space-x-3 pt-4 border-t border-secondary-100 mt-6">
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