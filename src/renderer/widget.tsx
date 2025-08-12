import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { Clock, CheckCircle, SkipForward, Image as ImageIcon } from 'lucide-react';
import { Task } from './types';
import './index.css';

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
  const wheelLockRef = useRef<boolean>(false);
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
      
      // 進行中タスクを優先的に取得。なければ保留中タスクをフォールバック
      let rows = await window.electronAPI.database.query(
        'SELECT * FROM tasks WHERE status = ? ORDER BY priority DESC, createdAt ASC',
        ['inProgress']
      );
      if (!rows || rows.length === 0) {
        rows = await window.electronAPI.database.query(
          'SELECT * FROM tasks WHERE status = ? ORDER BY priority DESC, createdAt ASC',
          ['pending']
        );
      }
      setTasks(rows || []);
      setCurrentIndex(prev => {
        const maxIdx = Math.max(0, (rows?.length || 1) - 1);
        return Math.min(prev, maxIdx);
      });
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
    }
  };

  const cleanupEventListeners = () => {
    if (window.electronAPI) {
      window.electronAPI.removeAllListeners('task:updated');
    }
  };

  const handleTaskUpdated = () => {
    loadTasks();
  };

  const completeCurrentTask = async () => {
    const task = tasks[currentIndex];
    if (!task) return;
    
    try {
      await window.electronAPI.database.query(
        'UPDATE tasks SET status = ?, completedAt = ?, updatedAt = ? WHERE id = ?',
        ['completed', new Date().toISOString(), new Date().toISOString(), task.id]
      );
      // 完了後は最新の進行中/保留タスクを再読込
      await loadTasks();
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  };

  const skipCurrentTask = () => {
    if (tasks.length === 0) return;
    setCurrentIndex((idx) => (idx + 1) % tasks.length);
  };

  // ホイールで前後に切り替え（200msスロットル）
  const handleWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    e.stopPropagation();
    if (tasks.length <= 1) return;
    if (wheelLockRef.current) return;
    wheelLockRef.current = true;
    setTimeout(() => (wheelLockRef.current = false), 200);
    if (e.deltaY > 0) {
      setCurrentIndex((idx) => (idx + 1) % tasks.length);
    } else if (e.deltaY < 0) {
      setCurrentIndex((idx) => (idx - 1 + tasks.length) % tasks.length);
    }
  };

  const openMainWindow = () => {
    // ボタンは非ドラッグ領域
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
        <div className="text-2xl mb-2">📝</div>
        <div className="text-sm text-secondary-600 mb-3">タスクがありません</div>
        <button
          onClick={openMainWindow}
          className="text-xs px-3 py-1 bg-primary-100 text-primary-700 rounded hover:bg-primary-200 transition-colors"
        >
          タスクを作成
        </button>
      </div>
    );
  }

  // （重複削除）ステップ進捗のフックはトップレベルで定義済み、更新は別の useEffect で実行

  return (
    <div className="h-full w-full flex flex-col widget-content" onWheel={handleWheel}>
      <div className="flex items-start space-x-2.5">
        <div className="w-[126px] h-[126px] bg-secondary-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 task-image">
          {currentTask.imageUrl ? (
            <img 
              src={currentTask.imageUrl}
              alt={`${currentTask.title}のイラスト`}
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageIcon className="w-7 h-7 text-secondary-400" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-0.5">
            <h3 className="text-[12px] font-semibold text-secondary-900 leading-tight line-clamp-2">
              {currentTask.title}
            </h3>
            <div 
              className="w-2 h-2 rounded-full flex-shrink-0 ml-2 mt-0.5"
              style={{ backgroundColor: getPriorityColor((currentTask as any).priority || 'low') }}
            />
          </div>
          
          <div className="text-[10px] text-secondary-600 space-y-0.5">
            {nextStepTitle && (
              <div className="truncate" title={nextStepTitle}>次のステップ: {nextStepTitle}</div>
            )}
            {currentTask.estimatedDuration && (
              <div className="flex items-center space-x-1">
                <Clock className="w-[10px] h-[10px]" />
                <span>{formatTime(currentTask.estimatedDuration)}</span>
              </div>
            )}
            {stepInfo.total > 0 && (
              <div className="steps">
                <div className="bar"><div style={{ width: `${Math.round((stepInfo.completed/stepInfo.total)*100)}%` }} /></div>
                <div className="mt-0.5 text-[10px] text-secondary-500">{stepInfo.completed}/{stepInfo.total} 完了</div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex space-x-1.5 mt-1 pb-0">
        <button
          onClick={completeCurrentTask}
          className="flex-1 flex items-center justify-center space-x-1 px-1.5 py-1 bg-green-500 text-white text-[10px] rounded hover:bg-green-600 transition-colors"
        >
          <CheckCircle className="w-[11px] h-[11px]" />
          <span>完了</span>
        </button>
        <button
          onClick={skipCurrentTask}
          className="flex-1 flex items-center justify-center space-x-1 px-1.5 py-1 bg-secondary-200 text-secondary-700 text-[10px] rounded hover:bg-secondary-300 transition-colors"
        >
          <SkipForward className="w-[11px] h-[11px]" />
          <span>次へ</span>
        </button>
      </div>
      
      {/* サイズ調整ボタンは削除。ウィンドウ端ドラッグでリサイズ可能 */}
    </div>
  );
};

// Mount the widget
const root = ReactDOM.createRoot(document.getElementById('widget-body')!);
root.render(<Widget />);