import React, { useState, useEffect, useRef, useCallback, useReducer, useMemo } from 'react';
import {
  Image as ImageIcon,
  RefreshCw,
  AlertCircle,
  ListTodo
} from 'lucide-react';
import { Task, TaskStatus, TaskStep } from '../types';
import { useTask } from '../contexts/TaskContext';
import { useHoverImage } from '../contexts/HoverImageContext';
import { format } from 'date-fns';
import CrumpleOverlay from './CrumpleOverlay';

interface TaskCardProps {
  task: Task;
  isDragEnabled?: boolean;
  onDetailClick?: (task: Task) => void;
}

//

// TaskCard用のReducer型定義
interface TaskCardState {
  isUpdating: boolean;
  isDragging: boolean;
  isCrumpling: boolean;
  isDeletePending: boolean;
  imageState: {
    isGenerating: boolean;
    error: string | null;
    canRetry: boolean;
  };
}

type TaskCardAction =
  | { type: 'SET_UPDATING'; payload: boolean }
  | { type: 'START_DRAG' }
  | { type: 'END_DRAG' }
  | { type: 'START_CRUMPLE' }
  | { type: 'RESET_CRUMPLE' }
  | { type: 'START_DELETE_SEQUENCE' }
  | { type: 'RESET_DELETE_SEQUENCE' }
  | { type: 'SET_IMAGE_STATE'; payload: { isGenerating: boolean; error: string | null; canRetry: boolean } };

// TaskCard用のReducer関数
function taskCardReducer(state: TaskCardState, action: TaskCardAction): TaskCardState {
  switch (action.type) {
    case 'SET_UPDATING':
      return { ...state, isUpdating: action.payload };
    case 'START_DRAG':
      return { ...state, isDragging: true };
    case 'END_DRAG':
      return { ...state, isDragging: false };
    case 'START_CRUMPLE':
      return { ...state, isCrumpling: true };
    case 'RESET_CRUMPLE':
      return { ...state, isCrumpling: false };
    case 'START_DELETE_SEQUENCE':
      return { ...state, isCrumpling: true, isDeletePending: true };
    case 'RESET_DELETE_SEQUENCE':
      return { ...state, isCrumpling: false, isDeletePending: false };
    case 'SET_IMAGE_STATE':
      return { ...state, imageState: action.payload };
    default:
      return state;
  }
}

// メモ化された子コンポーネント群
const TaskImage = React.memo<{
  task: Task;
  imageState: { isGenerating: boolean; error: string | null; canRetry: boolean };
}>(({ task, imageState }) => (
  <div className="flex-shrink-0 relative">
    {task.imageUrl ? (
      <img
        src={task.imageUrl}
        alt={`${task.title}のイラスト`}
        className="w-16 h-16 rounded-lg object-cover"
        loading="lazy"
        onError={(e) => {
          console.error('Image load error for task:', task.title, {
            imageUrlLength: task.imageUrl?.length,
            imageUrlPrefix: task.imageUrl ? '[data:image/*;base64, ...redacted]' : undefined
          });
          const imgElement = e.target as HTMLImageElement;
          imgElement.style.display = 'none';

          // 親要素にエラー状態を表示
          const parent = imgElement.parentElement;
          if (parent) {
            parent.innerHTML = `
              <div class="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
              </div>
            `;
          }
        }}
      />
    ) : imageState.isGenerating ? (
      <div className="w-16 h-16 bg-secondary-100 rounded-lg flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent"></div>
      </div>
    ) : imageState.error ? (
      <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center">
        <AlertCircle className="w-6 h-6 text-red-500" />
      </div>
    ) : (
      <div className="w-16 h-16 bg-secondary-100 rounded-lg flex items-center justify-center">
        <ImageIcon className="w-6 h-6 text-secondary-400" />
      </div>
    )}
  </div>
));

// 三点メニューは削除（詳細画面と機能重複のため）

const TaskMetadata = React.memo<{
  task: Task;
  getStatusColor: (status: string) => string;
  getStatusLabel: (status: string) => string;
  formatDate: (dateString: string) => string;
  inlineActions?: React.ReactNode;
}>(({ task, getStatusColor, getStatusLabel, formatDate, inlineActions }) => (
  <div className="flex items-center justify-between mt-2">
    <div className="flex items-center space-x-2">
      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(task.status)}`}>
        {getStatusLabel(task.status)}
      </span>

      {inlineActions}
    </div>

    {task.createdAt && (
      <span className="text-xs text-secondary-500">
        {formatDate(task.createdAt)}
      </span>
    )}
  </div>
));

// 旧: アクション行コンポーネント（インライン化に伴い未使用）
// const TaskStatusActions = React.memo<{
//   task: Task;
//   onStatusChange: (status: TaskStatus) => void;
//   isUpdating: boolean;
// }>(() => null);

const TaskImageError = React.memo<{
  error: string;
  canRetry: boolean;
  onRetry: () => void;
  isGenerating: boolean;
}>(({ error, canRetry, onRetry, isGenerating }) => (
  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
    <div className="flex items-center justify-between">
      <span>{error}</span>
      {canRetry && (
        <button
          onClick={onRetry}
          disabled={isGenerating}
          className="ml-2 text-red-600 hover:text-red-800 disabled:opacity-50"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      )}
    </div>
  </div>
));
const TaskCard: React.FC<TaskCardProps> = React.memo(({ task, isDragEnabled = true, onDetailClick }) => {
  const { updateTask, regenerateTaskImage } = useTask();
  const { showHoverImage, hideHoverImage } = useHoverImage();

  // useReducerで状態を統合して再レンダリングを最適化
  const [state, dispatch] = useReducer(taskCardReducer, {
    isUpdating: false,
    isDragging: false,
    isCrumpling: false,
    isDeletePending: false,
    imageState: {
      isGenerating: false,
      error: null,
      canRetry: false
    }
  });

  // 一覧用: 先頭（次）ステップ表示
  const [firstStep, setFirstStep] = useState<TaskStep | null>(null);

  // 画像生成状態の初期化を一度だけ実行するためのref
  const isInitializedRef = useRef(false);

  // 三点メニュー削除に伴い、Escapeキーでのメニュー閉じ処理は不要

  const handleStatusChange = useCallback(async (newStatus: TaskStatus) => {
    if (state.isUpdating) return;

    try {
      dispatch({ type: 'SET_UPDATING', payload: true });
      await updateTask(task.id!, { status: newStatus });
    } catch (error) {
      console.error('Failed to update task status:', error);
    } finally {
      dispatch({ type: 'SET_UPDATING', payload: false });
    }
  }, [state.isUpdating, updateTask, task.id]);

  // 削除機能は詳細画面に集約

  //

  const handleDragStart = useCallback((e: React.DragEvent) => {
    console.log(`🚀 ドラッグ開始: タスク "${task.title}" (ID: ${task.id}, ステータス: ${task.status})`);
    dispatch({ type: 'START_DRAG' });
    e.dataTransfer.setData('text/plain', task.id!.toString());
    e.dataTransfer.effectAllowed = 'move';
  }, [task.id, task.title, task.status]);

  const handleDragEnd = useCallback(() => {
    console.log(`🏁 ドラッグ終了: タスク "${task.title}" (ID: ${task.id})`);
    dispatch({ type: 'END_DRAG' });
  }, [task.id, task.title]);

  // 旧：各カードでの遅延hide。新：コンテキスト側で一元管理するためタイマーは不要。
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    if (task.imageUrl) {
      const cardRect = event.currentTarget.getBoundingClientRect();
      showHoverImage(task.imageUrl, task.title, cardRect);
    }
  }, [task.status, task.imageUrl, task.title, showHoverImage]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    // 遅延はコンテキスト側で実施
    hideHoverImage();
  }, [hideHoverImage]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  //

  const handleRegenerateImage = useCallback(async () => {
    if (!task.id || state.imageState.isGenerating) return;
    dispatch({
      type: 'SET_IMAGE_STATE',
      payload: {
        isGenerating: true,
        error: null,
        canRetry: false
      }
    });

    try {
      const result = await regenerateTaskImage(task.id);
      if (result.success) {
        dispatch({
          type: 'SET_IMAGE_STATE',
          payload: {
            isGenerating: false,
            error: null,
            canRetry: false
          }
        });
      } else {
        dispatch({
          type: 'SET_IMAGE_STATE',
          payload: {
            isGenerating: false,
            error: result.error?.userMessage || '画像生成に失敗しました',
            canRetry: result.error?.retryable || false
          }
        });
      }
    } catch (error) {
      dispatch({
        type: 'SET_IMAGE_STATE',
        payload: {
          isGenerating: false,
          error: '画像生成中に予期しないエラーが発生しました',
          canRetry: true
        }
      });
    }
    // 三点メニュー削除に伴い、メニューを閉じる処理は不要
  }, [task.id, state.imageState.isGenerating, regenerateTaskImage]);

  // 先頭ステップの読み込み
  useEffect(() => {
    let cancelled = false;
    const loadFirstStep = async () => {
      if (!task.id) return;
      try {
        const result = await (window as any).electronAPI?.taskSteps?.getByTaskId(task.id);
        if (!cancelled) {
          if (result?.success && Array.isArray(result.steps) && result.steps.length > 0) {
            const nextStep = result.steps.find((s: TaskStep) => s.status !== 'completed');
            setFirstStep(nextStep || null);
          } else {
            setFirstStep(null);
          }
        }
      } catch (error) {
        if (!cancelled) setFirstStep(null);
      }
    };
    loadFirstStep();
    return () => { cancelled = true; };
  }, [task.id]);

  // フォールバック画像取得機能
  const handleFallbackImageRetrieval = useCallback(async () => {
    if (!task.id || state.imageState.isGenerating) return;

    console.log(`🔄 フォールバック画像取得開始 - TaskID: ${task.id}`);

    try {
      if (window.electronAPI?.ai?.getImageUrlByTaskId) {
        const result = await window.electronAPI.ai.getImageUrlByTaskId(task.id);

        if (result.success && result.imageUrl) {
          console.log(`✅ フォールバック画像取得成功 - TaskID: ${task.id}`);
          // ローカル状態を直接更新（データベースは既に正しい）
          // TaskContextのsetTasksを直接使用する代わりに画像状態だけ更新
          dispatch({
            type: 'SET_IMAGE_STATE',
            payload: {
              isGenerating: false,
              error: null,
              canRetry: false
            }
          });
          return result.imageUrl;
        } else {
          console.warn(`⚠️ フォールバック画像取得失敗 - TaskID: ${task.id}:`, result.error);
        }
      }
    } catch (error) {
      console.error(`❌ フォールバック画像取得エラー - TaskID: ${task.id}:`, error);
    }

    return null;
  }, [task.id, state.imageState.isGenerating]);

  // 画像生成状態の管理 - useEffectの無限ループを防ぐためrefを使用
  useEffect(() => {
    // タスクが変わった場合は初期化フラグをリセット
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;

      console.log(`🖼️ TaskCard初期化 - タスク: ${task.title} (ID: ${task.id})`, {
        hasImageUrl: !!task.imageUrl,
        imageUrlLength: task.imageUrl?.length
      });

      // 画像URLがある場合は生成完了状態にする
      if (task.imageUrl) {
        dispatch({
          type: 'SET_IMAGE_STATE',
          payload: {
            isGenerating: false,
            error: null,
            canRetry: false
          }
        });
      } else {
        // 画像URLがない場合、フォールバック機能で再取得を試行
        console.log(`🔄 画像URL空 - フォールバック取得を試行 - TaskID: ${task.id}`);
        handleFallbackImageRetrieval().then(retrievedUrl => {
          if (!retrievedUrl) {
            // フォールバックでも取得できない場合は生成中状態にする（一度だけ）
            console.log(`🎨 画像生成開始 - タスク: ${task.title}`);
            dispatch({
              type: 'SET_IMAGE_STATE',
              payload: {
                isGenerating: true,
                error: null,
                canRetry: false
              }
            });
          }
        }).catch(error => {
          console.error(`❌ フォールバック処理エラー:`, error);
        });
      }
    } else if (task.imageUrl && state.imageState.isGenerating) {
      // 画像URLが後から設定された場合（AI生成完了時）
      console.log(`✅ 画像生成完了検出 - タスク: ${task.title}`);
      dispatch({
        type: 'SET_IMAGE_STATE',
        payload: {
          isGenerating: false,
          error: null,
          canRetry: false
        }
      });
    }
  }, [task.imageUrl, task.id, handleFallbackImageRetrieval]);

  // タスクが変わった時に初期化フラグをリセット
  useEffect(() => {
    isInitializedRef.current = false;
  }, [task.id]);

  // メモ化されたヘルパー関数
  const getStatusColor = useMemo(() => (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'inProgress': return 'text-yellow-600 bg-yellow-100';
      case 'paused': return 'text-orange-600 bg-orange-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  }, []);

  const getStatusLabel = useMemo(() => (status: string) => {
    switch (status) {
      case 'completed': return '完了';
      case 'inProgress': return '進行中';
      case 'paused': return '一時停止';
      case 'pending': return '未着手';
      default: return status;
    }
  }, []);

  const formatDate = useMemo(() => (dateString: string) => {
    try {
      return format(new Date(dateString), 'MM/dd HH:mm');
    } catch {
      return '';
    }
  }, []);

  // メモ化されたCSSクラス
  const cardClasses = useMemo(() => {
    return `group relative p-4 bg-white rounded-lg border transition-all duration-200 ${state.isDragging
        ? 'opacity-50 scale-95 border-primary-400'
        : 'hover:shadow-md border-secondary-200'
      } ${state.isCrumpling ? 'animate-crumple' : ''}`;
  }, [state.isDragging, state.isCrumpling]);

  return (
    <div
      id={`task-${task.id}`}
      className={cardClasses}
      draggable={isDragEnabled}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onDetailClick?.(task)}
      style={{ cursor: onDetailClick ? 'pointer' : 'default' }}
      data-testid={`task-card-${task.id}`}
    >
      {/* Crumple overlay */}
      {state.isCrumpling && (
        <CrumpleOverlay
          task={task}
          isActive={state.isCrumpling}
          onComplete={() => {
            console.log('Crumple animation completed for task:', task.id);
          }}
        />
      )}

      <div className="flex items-start space-x-3">
        {/* Task Image - メモ化されたコンポーネント */}
        <TaskImage
          task={task}
          imageState={state.imageState}
        />

        {/* Task Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-secondary-900 truncate">
                {task.title}
              </h3>
              {task.description && (
                <p className="text-xs text-secondary-600 mt-1 line-clamp-2">
                  {task.description}
                </p>
              )}
            </div>

            {/* 三点メニュー削除 */}
          </div>

          {/* Task Metadata + Inline status actions */}
          <TaskMetadata
            task={task}
            getStatusColor={getStatusColor}
            getStatusLabel={getStatusLabel}
            formatDate={formatDate}
            inlineActions={(
              <div className="flex items-center space-x-1 ml-1">
                {task.status === 'pending' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleStatusChange('inProgress'); }}
                    disabled={state.isUpdating}
                    className="text-[10px] px-2 py-0.5 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
                  >
                    開始
                  </button>
                )}
                {task.status === 'inProgress' && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStatusChange('completed'); }}
                      disabled={state.isUpdating}
                      className="text-[10px] px-2 py-0.5 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                    >
                      完了
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStatusChange('paused'); }}
                      disabled={state.isUpdating}
                      className="text-[10px] px-2 py-0.5 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
                    >
                      一時停止
                    </button>
                  </>
                )}
                {task.status === 'paused' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleStatusChange('inProgress'); }}
                    disabled={state.isUpdating}
                    className="text-[10px] px-2 py-0.5 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
                  >
                    再開
                  </button>
                )}
              </div>
            )}
          />

          {/* First Step highlighted */}
          {firstStep && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-start space-x-2">
              <ListTodo className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-blue-800">次のステップ</div>
                <div className="text-sm text-blue-900 truncate" title={firstStep.title}>
                  {firstStep.title}
                </div>
              </div>
            </div>
          )}

          {/* 既存のアクション行は削除（インラインに集約） */}

          {/* Error Display */}
          {state.imageState.error && (
            <TaskImageError
              error={state.imageState.error}
              canRetry={state.imageState.canRetry}
              onRetry={handleRegenerateImage}
              isGenerating={state.imageState.isGenerating}
            />
          )}
        </div>
      </div>

      {/* Drag Instruction */}
      {isDragEnabled && (
        <div className="absolute bottom-2 right-2 text-xs text-secondary-400 opacity-0 group-hover:opacity-100 transition-opacity">
          他のセクションにドラッグして状態を変更
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // カスタム比較関数でより細かい制御
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.title === nextProps.task.title &&
    prevProps.task.status === nextProps.task.status &&
    prevProps.task.imageUrl === nextProps.task.imageUrl &&
    prevProps.task.updatedAt === nextProps.task.updatedAt &&
    prevProps.isDragEnabled === nextProps.isDragEnabled
  );
});

export default TaskCard;
