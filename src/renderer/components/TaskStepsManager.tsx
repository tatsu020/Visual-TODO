import React, { useState, useEffect } from 'react';
import { TaskStep } from '../types';
import { StepItem } from './StepItem';
import { StepForm } from './StepForm';

interface TaskStepsManagerProps {
  taskId: number;
  initialSteps?: TaskStep[];
  onStepsChange?: (steps: TaskStep[]) => void;
  readOnly?: boolean;
}

export const TaskStepsManager: React.FC<TaskStepsManagerProps> = ({
  taskId,
  initialSteps = [],
  onStepsChange,
  readOnly = false
}) => {
  const [steps, setSteps] = useState<TaskStep[]>(initialSteps);
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [editingStepId, setEditingStepId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [draggedStepId, setDraggedStepId] = useState<number | null>(null);

  const electronAPI = (window as any).electronAPI;

  // ステップ一覧の読み込み
  const loadSteps = async () => {
    if (!taskId) return;
    
    setLoading(true);
    try {
      const result = await electronAPI.taskSteps.getByTaskId(taskId);
      if (result.success) {
        setSteps(result.steps || []);
        onStepsChange?.(result.steps || []);
      } else {
        console.error('Failed to load steps:', result.error);
      }
    } catch (error) {
      console.error('Error loading steps:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初期読み込み
  useEffect(() => {
    if (taskId && initialSteps.length === 0) {
      loadSteps();
    }
  }, [taskId]);

  // ステップ作成
  const handleCreateStep = async (stepData: Omit<TaskStep, 'id' | 'task_id' | 'created_at' | 'updated_at'>) => {
    try {
      if (!electronAPI || !electronAPI.taskSteps) {
        throw new Error('Electron API not available');
      }
      
      const newStep = {
        ...stepData,
        task_id: taskId,
        order_index: steps.length
      };
      
      const result = await electronAPI.taskSteps.create(newStep);
      if (result.success) {
        await loadSteps(); // リロードして最新の状態を取得
        setIsAddingStep(false);
      } else {
        console.error('Failed to create step:', result.error);
        alert(`ステップの作成に失敗しました: ${result.error}`);
      }
    } catch (error) {
      console.error('Error creating step:', error);
      alert('ステップの作成中にエラーが発生しました。');
    }
  };

  // ステップ更新
  const handleUpdateStep = async (stepId: number, updates: Partial<TaskStep>) => {
    try {
      const result = await electronAPI.taskSteps.update(stepId, updates);
      if (result.success) {
        await loadSteps();
        setEditingStepId(null);
      } else {
        console.error('Failed to update step:', result.error);
      }
    } catch (error) {
      console.error('Error updating step:', error);
    }
  };

  // ステップ削除
  const handleDeleteStep = async (stepId: number) => {
    try {
      const result = await electronAPI.taskSteps.delete(stepId);
      if (result.success) {
        await loadSteps();
      } else {
        console.error('Failed to delete step:', result.error);
      }
    } catch (error) {
      console.error('Error deleting step:', error);
    }
  };

  // ステップ並び替え
  const handleReorderSteps = async (newStepIds: number[]) => {
    try {
      // preloadのシグネチャは (stepIds: number[]) のみ
      const result = await electronAPI.taskSteps.reorder(newStepIds);
      if (result.success) {
        await loadSteps();
      } else {
        console.error('Failed to reorder steps:', result.error);
      }
    } catch (error) {
      console.error('Error reordering steps:', error);
    }
  };

  // ドラッグ&ドロップ処理
  const handleDragStart = (stepId: number) => {
    setDraggedStepId(stepId);
  };

  const handleDragOver = (e: React.DragEvent, targetStepId: number) => {
    e.preventDefault();
    if (draggedStepId && draggedStepId !== targetStepId) {
      // 視覚的フィードバック
    }
  };

  const handleDrop = (e: React.DragEvent, targetStepId: number) => {
    e.preventDefault();
    if (!draggedStepId || draggedStepId === targetStepId) return;

    const draggedIndex = steps.findIndex(s => s.id === draggedStepId);
    const targetIndex = steps.findIndex(s => s.id === targetStepId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newSteps = [...steps];
    const [draggedStep] = newSteps.splice(draggedIndex, 1);
    newSteps.splice(targetIndex, 0, draggedStep);

    const stepIds = newSteps.map(s => s.id!);
    handleReorderSteps(stepIds);
    setDraggedStepId(null);
  };

  // 進捗計算
  const completedSteps = steps.filter(step => step.status === 'completed').length;
  const totalSteps = steps.length;
  const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">ステップを読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 進捗表示 */}
      {totalSteps > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">進捗</span>
            <span className="text-sm text-gray-600">{completedSteps}/{totalSteps} ステップ完了</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="text-center mt-1">
            <span className="text-xs text-gray-500">{progressPercentage}%</span>
          </div>
        </div>
      )}

      {/* ステップ一覧 */}
      <div className="space-y-2">
        {steps.map((step, index) => (
          <StepItem
            key={step.id}
            step={step}
            index={index}
            isEditing={editingStepId === step.id}
            readOnly={readOnly}
            onUpdate={(updates) => handleUpdateStep(step.id!, updates)}
            onDelete={() => handleDeleteStep(step.id!)}
            onEdit={() => setEditingStepId(step.id!)}
            onCancelEdit={() => setEditingStepId(null)}
            onDragStart={() => handleDragStart(step.id!)}
            onDragOver={(e) => handleDragOver(e, step.id!)}
            onDrop={(e) => handleDrop(e, step.id!)}
            isDragging={draggedStepId === step.id}
          />
        ))}
      </div>

      {/* 新しいステップ追加 */}
      {!readOnly && (
        <>
          {isAddingStep ? (
            <StepForm
              onSave={handleCreateStep}
              onCancel={() => setIsAddingStep(false)}
            />
          ) : (
            <button
              onClick={() => setIsAddingStep(true)}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              + ステップを追加
            </button>
          )}
        </>
      )}

      {/* 空の状態 */}
      {totalSteps === 0 && !isAddingStep && (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">📝</div>
          <p>まだステップが追加されていません</p>
          {!readOnly && (
            <p className="text-sm mt-1">「+ ステップを追加」ボタンでタスクを詳細な手順に分けましょう</p>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskStepsManager;