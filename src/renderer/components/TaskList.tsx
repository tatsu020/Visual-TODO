import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Task } from '../types';
import { useTask } from '../contexts/TaskContext';
import TaskCard from './TaskCard';

interface TaskListProps {
  tasks: Task[];
  showCompletedOnly?: boolean;
  onTaskDetailClick?: (task: Task) => void;
}

const TaskList: React.FC<TaskListProps> = ({ tasks, showCompletedOnly = false, onTaskDetailClick }) => {
  const { updateTask } = useTask();
  
  const [dragOverSection, setDragOverSection] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ドラッグ状態を統合管理
  const [dragState, setDragState] = useState({
    isDragging: false,
    draggedTaskId: null as number | null,
    lastDragOverSection: null as string | null
  });

  // デバウンス用のRef
  const dragOverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dragLeaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // メモ化された統計計算
  const taskGroups = useMemo(() => {
    const groups = tasks.reduce((acc, task) => {
      if (!acc[task.status]) acc[task.status] = [];
      acc[task.status].push(task);
      return acc;
    }, {} as Record<string, typeof tasks>);
    
    return groups;
  }, [tasks]);

  // ドラッグハンドラーの最適化
  const handleDragOver = useCallback((e: React.DragEvent, section: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // 同じセクションの場合は処理をスキップ
    if (dragState.lastDragOverSection === section) {
      return;
    }
    
    // 既存のタイムアウトをクリア
    if (dragOverTimeoutRef.current) {
      clearTimeout(dragOverTimeoutRef.current);
      dragOverTimeoutRef.current = null;
    }
    
    // 即座にハイライトを設定
    setDragOverSection(section);
    setDragState(prev => ({ ...prev, lastDragOverSection: section }));
    
    // デバウンスされたクリア
    dragOverTimeoutRef.current = setTimeout(() => {
      setDragOverSection(null);
      setDragState(prev => ({ ...prev, lastDragOverSection: null }));
    }, 150);
  }, [dragState.lastDragOverSection]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    
    // より正確な境界チェック
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const margin = 5; // 5pxのマージンを設定
    
    const isInsideX = e.clientX >= (rect.left - margin) && e.clientX <= (rect.right + margin);
    const isInsideY = e.clientY >= (rect.top - margin) && e.clientY <= (rect.bottom + margin);
    
    if (!isInsideX || !isInsideY) {
      // 遅延クリアでフリッカーを防止
      if (dragLeaveTimeoutRef.current) {
        clearTimeout(dragLeaveTimeoutRef.current);
      }
      
      dragLeaveTimeoutRef.current = setTimeout(() => {
        if (dragOverTimeoutRef.current) {
          clearTimeout(dragOverTimeoutRef.current);
          dragOverTimeoutRef.current = null;
        }
        setDragOverSection(null);
        setDragState(prev => ({ ...prev, lastDragOverSection: null }));
      }, 50);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    
    // 全てのタイムアウトをクリア
    if (dragOverTimeoutRef.current) {
      clearTimeout(dragOverTimeoutRef.current);
      dragOverTimeoutRef.current = null;
    }
    if (dragLeaveTimeoutRef.current) {
      clearTimeout(dragLeaveTimeoutRef.current);
      dragLeaveTimeoutRef.current = null;
    }
    
    setDragOverSection(null);
    setDragState({
      isDragging: false,
      draggedTaskId: null,
      lastDragOverSection: null
    });
    
    const taskId = parseInt(e.dataTransfer.getData('text/plain'), 10);
    
    // キャッシュされたタスクから検索（O(1)ではないがマップ化で改善可能）
    const task = tasks.find(t => t.id === taskId);
    
    if (task && task.status !== targetStatus) {
      console.log(`🔄 ドラッグ&ドロップ: タスク "${task.title}" を ${task.status} から ${targetStatus} に変更中...`);
      
      try {
        // 型安全な状態更新
        const validStatuses = ['pending', 'inProgress', 'completed', 'paused'];
        if (!validStatuses.includes(targetStatus)) {
          throw new Error(`Invalid status: ${targetStatus}`);
        }
        
        await updateTask(taskId, { status: targetStatus as 'pending' | 'inProgress' | 'completed' | 'paused' });
        console.log(`✅ 状態更新成功: タスク "${task.title}" が ${targetStatus} になりました`);
        
      } catch (error) {
        console.error('❌ ドラッグ&ドロップでの状態更新に失敗:', error);
        // エラー時は状態をリセット
        setDragOverSection(null);
      }
    } else if (task && task.status === targetStatus) {
      console.log(`ℹ️ タスク "${task.title}" は既に ${targetStatus} 状態です`);
    } else {
      console.error('❌ タスクが見つかりません:', taskId);
    }
  }, [tasks, updateTask]);

  // クリーンアップ関数
  useEffect(() => {
    return () => {
      if (dragOverTimeoutRef.current) {
        clearTimeout(dragOverTimeoutRef.current);
      }
      if (dragLeaveTimeoutRef.current) {
        clearTimeout(dragLeaveTimeoutRef.current);
      }
    };
  }, []);

  if (tasks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-secondary-900 mb-2">タスクがありません</h3>
          <p className="text-secondary-600">
            新しいタスクを作成して、AIがイラストを生成します。
          </p>
        </div>
      </div>
    );
  }

  const orderedStatuses = showCompletedOnly ? ['completed'] : ['inProgress', 'paused', 'pending'];
  const statusLabels = {
    pending: '未着手',
    inProgress: '進行中',
    paused: '一時停止',
    completed: '完了'
  };
  const statusColors = {
    pending: 'border-blue-200 bg-blue-50',
    inProgress: 'border-yellow-200 bg-yellow-50',
    paused: 'border-orange-200 bg-orange-50',
    completed: 'border-green-200 bg-green-50'
  };
  const dropZoneColors = {
    pending: 'border-blue-400 bg-blue-100',
    inProgress: 'border-yellow-400 bg-yellow-100',
    paused: 'border-orange-400 bg-orange-100',
    completed: 'border-green-400 bg-green-100'
  };

  return (
    <div ref={containerRef} className="flex-1 p-6 overflow-auto" data-testid="task-list">
      <div className={`grid gap-6 h-full ${
        showCompletedOnly 
          ? 'grid-cols-1 max-w-md mx-auto' 
          : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      }`}>
        {orderedStatuses.map(status => {
          const statusTasks = taskGroups[status] || [];
          const isDropTarget = dragOverSection === status;
          
          return (
            <div
              key={status}
              className={`border-2 border-dashed rounded-lg p-4 transition-all duration-200 ${
                isDropTarget 
                  ? dropZoneColors[status as keyof typeof dropZoneColors]
                  : statusColors[status as keyof typeof statusColors]
              }`}
              onDragOver={(e) => handleDragOver(e, status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, status)}
              data-testid={`task-section-${status}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-secondary-900">
                  {statusLabels[status as keyof typeof statusLabels]}
                </h3>
                <span className="text-sm text-secondary-500 bg-white px-2 py-1 rounded">
                  {statusTasks.length}
                </span>
              </div>
              
              <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                {statusTasks.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">📝</div>
                    <p className="text-secondary-500 text-sm">タスクなし</p>
                  </div>
                ) : (
                  statusTasks.map(task => (
                    <TaskCard 
                      key={task.id} 
                      task={task} 
                      isDragEnabled={true}
                      onDetailClick={onTaskDetailClick}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TaskList;