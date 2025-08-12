import React, { useState } from 'react';
import { TaskStep } from '../types';
import { StepForm } from './StepForm';

interface StepItemProps {
  step: TaskStep;
  index: number;
  isEditing: boolean;
  readOnly: boolean;
  onUpdate: (updates: Partial<TaskStep>) => void;
  onDelete: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragging: boolean;
}

export const StepItem: React.FC<StepItemProps> = ({
  step,
  index,
  isEditing,
  readOnly,
  onUpdate,
  onDelete,
  onEdit,
  onCancelEdit,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging
}) => {
  const [isUpdating, setIsUpdating] = useState(false);

  // ステータス変更
  const handleStatusChange = async (newStatus: TaskStep['status']) => {
    setIsUpdating(true);
    try {
      const updates: Partial<TaskStep> = { 
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : undefined
      };
      await onUpdate(updates);
    } finally {
      setIsUpdating(false);
    }
  };

  // ステップ編集保存
  const handleSave = async (stepData: Omit<TaskStep, 'id' | 'task_id' | 'created_at' | 'updated_at'>) => {
    await onUpdate(stepData);
  };

  // ステータス表示用のスタイル
  const getStatusStyles = (status: TaskStep['status']) => {
    switch (status) {
      case 'completed':
        return {
          checkbox: 'bg-green-500 border-green-500',
          container: 'bg-green-50 border-green-200',
          text: 'text-green-800 line-through'
        };
      case 'inProgress':
        return {
          checkbox: 'bg-blue-500 border-blue-500',
          container: 'bg-blue-50 border-blue-200',
          text: 'text-blue-800'
        };
      default:
        return {
          checkbox: 'bg-white border-gray-300',
          container: 'bg-white border-gray-200',
          text: 'text-gray-800'
        };
    }
  };

  const statusStyles = getStatusStyles(step.status);

  if (isEditing && !readOnly) {
    return (
      <div className="border border-blue-300 rounded-lg p-3 bg-blue-50">
        <StepForm
          initialData={{
            title: step.title,
            description: step.description || '',
            status: step.status,
            order_index: step.order_index
          }}
          onSave={handleSave}
          onCancel={onCancelEdit}
        />
      </div>
    );
  }

  return (
    <div
      className={`
        border rounded-lg p-3 transition-all duration-200 group
        ${statusStyles.container}
        ${isDragging ? 'opacity-50 transform rotate-2' : ''}
        ${!readOnly ? 'hover:shadow-sm cursor-move' : ''}
      `}
      draggable={!readOnly}
      onDragStart={!readOnly ? onDragStart : undefined}
      onDragOver={!readOnly ? onDragOver : undefined}
      onDrop={!readOnly ? onDrop : undefined}
    >
      <div className="flex items-start space-x-3">
        {/* ドラッグハンドル */}
        {!readOnly && (
          <div className="flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="text-gray-400 cursor-move">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 2a2 2 0 1 1 .001 4.001A2 2 0 0 1 7 2zM7 8a2 2 0 1 1 .001 4.001A2 2 0 0 1 7 8zM7 14a2 2 0 1 1 .001 4.001A2 2 0 0 1 7 14zM13 2a2 2 0 1 1 .001 4.001A2 2 0 0 1 13 2zM13 8a2 2 0 1 1 .001 4.001A2 2 0 0 1 13 8zM13 14a2 2 0 1 1 .001 4.001A2 2 0 0 1 13 14z"></path>
              </svg>
            </div>
          </div>
        )}

        {/* ステップ番号 */}
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
          {index + 1}
        </div>

        {/* チェックボックス */}
        <div className="flex-shrink-0 mt-1">
          <button
            onClick={() => {
              if (readOnly || isUpdating) return;
              const newStatus = step.status === 'completed' ? 'pending' : 'completed';
              handleStatusChange(newStatus);
            }}
            disabled={readOnly || isUpdating}
            className={`
              w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
              ${statusStyles.checkbox}
              ${!readOnly && !isUpdating ? 'hover:opacity-80' : ''}
              ${isUpdating ? 'opacity-50' : ''}
            `}
          >
            {step.status === 'completed' && (
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
            {step.status === 'inProgress' && (
              <div className="w-2 h-2 bg-white rounded-full"></div>
            )}
          </button>
        </div>

        {/* ステップ内容 */}
        <div className="flex-1 min-w-0">
          <h4 className={`font-medium ${statusStyles.text}`}>
            {step.title}
          </h4>
          {step.description && (
            <p className={`text-sm mt-1 ${statusStyles.text.replace('line-through', '')}`}>
              {step.description}
            </p>
          )}
          
          {/* ステータス表示 */}
          <div className="flex items-center space-x-2 mt-2">
            <span className={`
              inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
              ${step.status === 'completed' ? 'bg-green-100 text-green-800' : ''}
              ${step.status === 'inProgress' ? 'bg-blue-100 text-blue-800' : ''}
              ${step.status === 'pending' ? 'bg-gray-100 text-gray-800' : ''}
            `}>
              {step.status === 'completed' && '✓ 完了'}
              {step.status === 'inProgress' && '⏳ 進行中'}
              {step.status === 'pending' && '⏸ 未着手'}
            </span>
            
            {step.completed_at && (
              <span className="text-xs text-gray-500">
                {new Date(step.completed_at).toLocaleDateString('ja-JP')}
              </span>
            )}
          </div>
        </div>

        {/* アクションボタン */}
        {!readOnly && (
          <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center space-x-1">
              {/* 進行中ボタン */}
              {step.status !== 'inProgress' && (
                <button
                  onClick={() => handleStatusChange('inProgress')}
                  disabled={isUpdating}
                  className="p-1 text-blue-500 hover:bg-blue-100 rounded transition-colors"
                  title="進行中にする"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
              
              {/* 編集ボタン */}
              <button
                onClick={onEdit}
                className="p-1 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                title="編集"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
              
              {/* 削除ボタン */}
              <button
                onClick={onDelete}
                className="p-1 text-red-500 hover:bg-red-100 rounded transition-colors"
                title="削除"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9zM4 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 112 0v4a1 1 0 11-2 0V9zm4 0a1 1 0 112 0v4a1 1 0 11-2 0V9z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StepItem;