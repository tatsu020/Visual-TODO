import React, { useState } from 'react';
import { TaskStep } from '../types';

interface StepFormProps {
  initialData?: {
    title: string;
    description: string;
    status: TaskStep['status'];
    order_index: number;
  };
  onSave: (stepData: Omit<TaskStep, 'id' | 'task_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onCancel: () => void;
}

export const StepForm: React.FC<StepFormProps> = ({ 
  initialData = {
    title: '',
    description: '',
    status: 'pending',
    order_index: 0
  },
  onSave,
  onCancel 
}) => {
  const [formData, setFormData] = useState(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // バリデーション
    if (!formData.title.trim()) {
      setValidationError('ステップのタイトルは必須です');
      return;
    }

    setIsSaving(true);
    setValidationError(null);

    try {
      await onSave({
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        status: formData.status,
        order_index: formData.order_index
      });
    } catch (error) {
      console.error('Error saving step:', error);
      setValidationError('ステップの保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (validationError) {
      setValidationError(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* タイトル入力 */}
      <div>
        <label htmlFor="step-title" className="block text-sm font-medium text-gray-700 mb-1">
          ステップタイトル *
        </label>
        <input
          id="step-title"
          type="text"
          value={formData.title}
          onChange={(e) => handleInputChange('title', e.target.value)}
          className={`
            w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500
            ${validationError ? 'border-red-300' : 'border-gray-300'}
          `}
          placeholder="例: 資料を収集する"
          maxLength={100}
          autoFocus
        />
        {validationError && (
          <p className="mt-1 text-sm text-red-600">{validationError}</p>
        )}
      </div>

      {/* 説明入力 */}
      <div>
        <label htmlFor="step-description" className="block text-sm font-medium text-gray-700 mb-1">
          詳細説明（任意）
        </label>
        <textarea
          id="step-description"
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          placeholder="ステップの詳細な手順や注意点を記入..."
          rows={3}
          maxLength={500}
        />
        <div className="mt-1 text-xs text-gray-500 text-right">
          {formData.description.length}/500
        </div>
      </div>

      {/* ステータス選択（編集時のみ） */}
      {initialData.title && (
        <div>
          <label htmlFor="step-status" className="block text-sm font-medium text-gray-700 mb-1">
            ステータス
          </label>
          <select
            id="step-status"
            value={formData.status}
            onChange={(e) => handleInputChange('status', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="pending">未着手</option>
            <option value="inProgress">進行中</option>
            <option value="completed">完了</option>
          </select>
        </div>
      )}

      {/* アクションボタン */}
      <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isSaving || !formData.title.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              保存中...
            </div>
          ) : (
            initialData.title ? '更新' : '追加'
          )}
        </button>
      </div>
    </form>
  );
};

export default StepForm;