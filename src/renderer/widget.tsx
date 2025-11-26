import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Clock, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { Task } from './types';
import './index.css';

const NOW_TASK_ID_KEY = 'nowTaskId';

interface WidgetState {
  loading: boolean;
  error: string | null;
}

const Widget: React.FC = () => {
  const [state, setState] = useState<WidgetState>({
    loading: true,
    error: null
  });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [nowTaskId, setNowTaskId] = useState<number | null>(null);
  // ステップ進捗（フックは常にトップレベルで宣言）
  const [stepInfo, setStepInfo] = useState<{completed: number; total: number}>({completed: 0, total: 0});
  const [nextStepTitle, setNextStepTitle] = useState<string | null>(null);

  useEffect(() => {
    loadTasks();
    setupEventListeners();
    
    return () => {
      cleanupEventListeners();
    };
  }, []);

  const loadTasks = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      // NOWタスクIDを設定から読み込む
      let currentNowTaskId: number | null = null;
      try {
        const settingsResult = await window.electronAPI.settings.getMany([NOW_TASK_ID_KEY]);
        if (settingsResult?.success && settingsResult.values) {
          const savedId = settingsResult.values[NOW_TASK_ID_KEY];
          if (savedId) {
            const parsedId = parseInt(savedId, 10);
            if (!isNaN(parsedId)) {
              currentNowTaskId = parsedId;
              setNowTaskId(parsedId);
            }
          } else {
            setNowTaskId(null);
          }
        }
      } catch (err) {
        console.warn('Failed to load nowTaskId:', err);
      }

      // NOWタスクのみを表示
      if (currentNowTaskId) {
        // 全タスクを取得してNOWタスクを探す
        const allTasksResponse = await window.electronAPI.tasks.list({ orderByPriority: true });
        const allTasks = allTasksResponse?.success && Array.isArray(allTasksResponse.tasks) 
          ? allTasksResponse.tasks as Task[] 
          : [];
        
        const nowTask = allTasks.find(t => t.id === currentNowTaskId && t.status !== 'completed');
        
        if (nowTask) {
          setTasks([nowTask]);
          setCurrentIndex(0);
        } else {
          // NOWタスクが見つからない（削除されたか完了済み）
          setTasks([]);
          setNowTaskId(null);
        }
      } else {
        // NOWタスクが設定されていない場合は空
        setTasks([]);
      }
      
      setState(prev => ({ ...prev, loading: false }));
    } catch (error) {
      console.error('Failed to load task:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: error instanceof Error ? error.message : 'タスクの読み込みに失敗しました'
      }));
    }
  };

  const setupEventListeners = () => {
    if (window.electronAPI) {
      window.electronAPI.on('task:updated', handleTaskUpdated);
      window.electronAPI.on('now:updated', handleNowUpdated);
    }
  };

  const cleanupEventListeners = () => {
    if (window.electronAPI) {
      window.electronAPI.removeAllListeners('task:updated');
      window.electronAPI.removeAllListeners('now:updated');
    }
  };

  const handleTaskUpdated = () => {
    loadTasks();
  };

  const handleNowUpdated = (newNowTaskId: number | null) => {
    console.log('[Widget] Now task updated:', newNowTaskId);
    setNowTaskId(newNowTaskId);
    loadTasks();
  };

  const completeCurrentTask = async () => {
    const task = tasks[currentIndex];
    if (!task || task.id == null) return;
    
    try {
      await window.electronAPI.tasks.update(
        task.id,
        { status: 'completed', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      );
      
      // 完了したタスクがNOWタスクだった場合、nowTaskIdをクリア
      if (nowTaskId && task.id === nowTaskId) {
        try {
          await window.electronAPI.settings.setMany({ [NOW_TASK_ID_KEY]: '' });
          setNowTaskId(null);
        } catch (err) {
          console.warn('Failed to clear nowTaskId:', err);
        }
      }
      
      // 完了後は最新の進行中/保留タスクを再読込
      await loadTasks();
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  };

  const formatTime = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}分`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}時間${mins}分` : `${hours}時間`;
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#22c55e';
      default: return '#6b7280';
    }
  };

  // 現在タスクの変更に応じてステップ進捗を取得
  useEffect(() => {
    (async () => {
      try {
        const task = tasks[currentIndex];
        const taskStepsApi = (window as any)?.electronAPI?.taskSteps;
        if (!task?.id || !taskStepsApi?.getByTaskId) {
          setStepInfo({completed:0,total:0});
          return;
        }
        const stepsRes = await taskStepsApi.getByTaskId(task.id);
        if (stepsRes?.success && Array.isArray(stepsRes.steps)) {
          const steps = stepsRes.steps as any[];
          const total = steps.length;
          const completed = steps.filter((s: any) => s.status === 'completed').length;
          setStepInfo({completed, total});
          // 次のステップ名（未完了の最小 order_index を優先）
          const sorted = [...steps].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
          const next = sorted.find(s => s.status !== 'completed');
          setNextStepTitle(next?.title || null);
        } else {
          setStepInfo({completed:0,total:0});
          setNextStepTitle(null);
        }
      } catch {
        setStepInfo({completed:0,total:0});
        setNextStepTitle(null);
      }
    })();
  }, [tasks, currentIndex]);

  if (state.loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="flex items-center justify-center h-full text-center p-4">
        <div>
          <div className="text-red-500 text-sm mb-2">エラー</div>
          <div className="text-xs text-secondary-600">{state.error}</div>
        </div>
      </div>
    );
  }

  const currentTask = tasks[currentIndex] || null;

  if (!currentTask) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <div className="text-2xl mb-2">🎯</div>
        <div className="text-sm text-secondary-600 mb-1">NOWカードが設定されていません</div>
        <div className="text-xs text-secondary-400">メインウィンドウでタスクをダブルクリックして設定してください</div>
      </div>
    );
  }

  // （重複削除）ステップ進捗のフックはトップレベルで定義済み、更新は別の useEffect で実行

  return (
    <div className="h-full w-full flex flex-col widget-content relative">
      {/* NOW バッジ */}
      <div className="absolute top-1 left-1 z-10">
        <div className="flex items-center gap-1 bg-red-500 text-white px-2 py-0.5 rounded-full font-bold text-[10px] shadow">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          NOW
        </div>
      </div>
      
      {/* メインコンテンツ */}
      <div className="flex-1 flex items-start gap-2 pt-7 px-1">
        {/* 画像 */}
        <div className="w-20 h-20 bg-secondary-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
          {currentTask.imageUrl ? (
            <img 
              src={currentTask.imageUrl}
              alt={`${currentTask.title}のイラスト`}
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageIcon className="w-6 h-6 text-secondary-400" />
          )}
        </div>
        
        {/* タスク情報 */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-start justify-between mb-1">
            <h3 className="text-[11px] font-semibold text-secondary-900 leading-tight line-clamp-2 pr-1">
              {currentTask.title}
            </h3>
            <div 
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: getPriorityColor((currentTask as any).priority || 'low') }}
            />
          </div>
          
          <div className="text-[10px] text-secondary-600 space-y-0.5">
            {nextStepTitle && (
              <div className="truncate" title={nextStepTitle}>次: {nextStepTitle}</div>
            )}
            {currentTask.estimatedDuration && (
              <div className="flex items-center gap-1">
                <Clock className="w-[10px] h-[10px]" />
                <span>{formatTime(currentTask.estimatedDuration)}</span>
              </div>
            )}
            {stepInfo.total > 0 && (
              <div className="steps">
                <div className="bar"><div style={{ width: `${Math.round((stepInfo.completed/stepInfo.total)*100)}%` }} /></div>
                <div className="mt-0.5 text-[9px] text-secondary-500">{stepInfo.completed}/{stepInfo.total} 完了</div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 完了ボタン */}
      <div className="px-1 pb-1">
        <button
          onClick={completeCurrentTask}
          className="w-full flex items-center justify-center gap-1 py-1.5 bg-green-500 text-white text-[10px] font-medium rounded hover:bg-green-600 transition-colors"
        >
          <CheckCircle className="w-3 h-3" />
          <span>完了</span>
        </button>
      </div>
    </div>
  );
};

// Mount the widget
const root = ReactDOM.createRoot(document.getElementById('widget-body')!);
root.render(<Widget />);
