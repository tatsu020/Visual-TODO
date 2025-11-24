import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Task, TaskFormData, TaskStats } from '../types';
import { TaskCreateSchema, TaskUpdateSchema, validateAndSanitize } from '../schemas';
import { handleAsyncError, createError, ErrorCategory } from '../utils/error-handler';

interface TaskContextType {
  tasks: Task[];
  stats: TaskStats;
  loading: boolean;
  error: string | null;
  fetchTasks: () => Promise<void>;
  createTask: (taskData: TaskFormData) => Promise<Task>;
  updateTask: (id: number, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
  generateTaskImage: (task: Task) => Promise<{ success: boolean; imageUrl?: string; error?: any }>;
  regenerateTaskImage: (taskId: number) => Promise<{ success: boolean; error?: any }>;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const useTask = () => {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useTask must be used within a TaskProvider');
  }
  return context;
};

interface TaskProviderProps {
  children: ReactNode;
}

export const TaskProvider: React.FC<TaskProviderProps> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 統計計算を最適化 - 4回のfilterを1回のreduceに変更
  const stats: TaskStats = React.useMemo(() => {
    const stats = tasks.reduce((acc, task) => {
      acc.total++;
      switch (task.status) {
        case 'completed':
          acc.completed++;
          break;
        case 'pending':
          acc.pending++;
          break;
        case 'inProgress':
          acc.inProgress++;
          break;
        case 'paused':
          acc.paused++;
          break;
      }
      return acc;
    }, {
      total: 0,
      completed: 0,
      pending: 0,
      inProgress: 0,
      paused: 0
    });

    const completionRate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

    return {
      ...stats,
      completionRate: Math.round(completionRate * 100) / 100
    };
  }, [tasks]);

  const fetchTasks = async () => {
    const result = await handleAsyncError(async () => {
      setLoading(true);
      setError(null);

      // Check if Electron API is available
      if (!window.electronAPI.tasks) {
        console.warn('Electron API not available, using fallback');
        setTasks([]);
        return;
      }

      const response = await window.electronAPI.tasks.list();
      const result = response?.success && Array.isArray(response.tasks) ? response.tasks as Task[] : [];

      console.log('📊 fetchTasks()完了 - タスク数:', result.length);
      console.log('🔍 画像URL保存状況の詳細分析:');

      // 画像URL保存状況の詳細な統計とデバッグ情報
      let hasImageCount = 0;
      let emptyImageCount = 0;
      let invalidImageCount = 0;

      result.forEach((task: Task, index: number) => {
        if (task.imageUrl) {
          if (task.imageUrl.startsWith('data:image/')) {
            hasImageCount++;
            console.log(`✅ タスク${index + 1} "${task.title}": 有効な画像URL (${Math.round(task.imageUrl.length / 1024)}KB)`);
          } else {
            invalidImageCount++;
            console.warn(`⚠️ タスク${index + 1} "${task.title}": 無効な画像URL形式（伏せ字）`);
          }
        } else {
          emptyImageCount++;
          console.log(`❌ タスク${index + 1} "${task.title}": 画像URL なし`);
        }
      });

      console.log('📊 画像URL統計:');
      console.log(`  - 有効な画像: ${hasImageCount}/${result.length}`);
      console.log(`  - 画像なし: ${emptyImageCount}/${result.length}`);
      console.log(`  - 無効な画像: ${invalidImageCount}/${result.length}`);

      // 画像URLが空のタスクに対してフォールバック処理を実行
      if (emptyImageCount > 0 && window.electronAPI?.ai) {
        console.log('🔄 画像なしタスクの画像URL復元を試行中...');

        // バックグラウンドで画像URL復元を試行（ブロックしない）
        result.forEach(async (task: Task) => {
          if (!task.imageUrl && task.id) {
            try {
              console.log(`🔍 TaskID ${task.id} の画像URL復元を試行...`);
              const imageUrlResult = await window.electronAPI!.ai!.getImageUrlByTaskId(task.id);

              if (imageUrlResult.success && imageUrlResult.imageUrl) {
                console.log(`✅ TaskID ${task.id} の画像URL復元成功`);
                // ローカル状態を直接更新（fetchTasks()を再度呼ばない）
                setTasks(prev => prev.map(t =>
                  t.id === task.id
                    ? { ...t, imageUrl: imageUrlResult.imageUrl }
                    : t
                ));
              } else {
                console.log(`❌ TaskID ${task.id} の画像URL復元失敗:`, imageUrlResult.error);
              }
            } catch (err) {
              console.warn(`⚠️ TaskID ${task.id} の画像URL復元エラー:`, err);
            }
          }
        });
      }

      setTasks(result);
    }, ErrorCategory.DATABASE);

    if (result === null) {
      setError('タスクの取得に失敗しました');
    }

    setLoading(false);
  };
  const createTask = async (taskData: TaskFormData): Promise<Task> => {
    const result = await handleAsyncError<Task>(async () => {
      setLoading(true);
      setError(null);

      console.log('🚀 createTask called with:', taskData);

      // 入力値検証とサニタイゼーション
      let validatedData: any;
      try {
        validatedData = validateAndSanitize(TaskCreateSchema, taskData);
        console.log('✅ Validation successful:', validatedData);
      } catch (validationError) {
        console.error('❌ Validation failed:', validationError);
        throw createError.validation(
          validationError instanceof Error ? validationError.message : 'Validation failed',
          '入力されたタスク情報に問題があります。確認して再度お試しください。'
        );
      }

      // Check if Electron API is available
      if (!window.electronAPI.tasks) {
        console.warn('Electron API not available, using fallback');
        const now = new Date().toISOString();
        const newTask: Task = {
          id: Date.now(), // Simple ID generation for demo
          ...validatedData,
          status: 'pending',
          createdAt: now,
          updatedAt: now
        };
        setTasks(prev => [newTask, ...prev]);
        return newTask;
      }

      const dbResult = await window.electronAPI.tasks.create(validatedData);

      if (!dbResult?.success || !dbResult.task) {
        throw createError.database('Failed to create task in main process');
      }

      console.log('📝 タスク作成完了 - ID:', dbResult.task.id, 'タイトル:', validatedData.title, '場所:', validatedData.location);

      const newTask: Task = {
        ...validatedData,
        ...dbResult.task
      };

      setTasks(prev => [newTask, ...prev]);

      // Generate AI image in background with proper error handling
      console.log('🚀 バックグラウンドでAI画像生成を開始 - TaskID:', newTask.id);

      // TaskIDが確実に存在する場合のみAI画像生成を実行
      if (newTask.id && typeof newTask.id === 'number') {
        console.log('✅ TaskID確認済み、AI画像生成開始');
        generateTaskImage(newTask)
          .then(result => {
            console.log('🎯 バックグラウンド画像生成結果:', result);
            if (result.success && result.imageUrl) {
              console.log('✅ 画像生成成功、ローカル状態を直接更新');
              // 画像生成成功時、ローカル状態を直接更新（fetchTasks()は呼ばない）
              setTasks(prev => prev.map(task =>
                task.id === newTask.id
                  ? { ...task, imageUrl: result.imageUrl, updatedAt: new Date().toISOString() }
                  : task
              ));
            } else {
              console.error('❌ 画像生成失敗:', result.error);
              // 失敗時はエラー状態をローカル状態に反映
              setTasks(prev => prev.map(task =>
                task.id === newTask.id
                  ? { ...task, imageUrl: undefined, updatedAt: new Date().toISOString() }
                  : task
              ));
            }
          })
          .catch(err => {
            console.error('❌ バックグラウンド画像生成エラー:', err);
          });
      } else {
        console.error('❌ TaskID無効 - AI画像生成をスキップ:', {
          taskId: newTask.id,
          type: typeof newTask.id,
          taskIdFromMain: dbResult.task?.id
        });
      }
      return newTask;
    }, ErrorCategory.DATABASE);

    if (result === null) {
      setError('タスクの作成に失敗しました');
      throw createError.database('Failed to create task');
    }

    setLoading(false);
    return result;
  };

  const updateTask = async (id: number, updates: Partial<Task>) => {
    try {
      setLoading(true);
      setError(null);

      // 入力値検証とサニタイゼーション（部分更新用）
      const validatedUpdates = validateAndSanitize(TaskUpdateSchema, { id, ...updates });

      const now = new Date().toISOString();
      const updatedData = { ...validatedUpdates, updatedAt: now };

      // IDは更新対象から除外
      delete (updatedData as any).id;

      if (updates.status === 'completed' && !updates.completedAt) {
        (updatedData as any).completedAt = now;
      }

      console.log('🔄 データベース更新実行中:', { id, updatedData });

      await window.electronAPI.tasks.update(id, updatedData);

      console.log('✅ データベース更新完了、React状態を更新中');

      setTasks(prev => {
        const updatedTasks = prev.map(task =>
          task.id === id ? { ...task, ...updatedData } : task
        );
        console.log('🔄 React状態更新完了:', updatedTasks.find(t => t.id === id));
        return updatedTasks;
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'タスクの更新に失敗しました');
      console.error('Failed to update task:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteTask = async (id: number) => {
    try {
      setLoading(true);
      setError(null);

      await window.electronAPI.tasks.delete(id);
      setTasks(prev => prev.filter(task => task.id !== id));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'タスクの削除に失敗しました');
      console.error('Failed to delete task:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const generateTaskImage = async (task: Task): Promise<{ success: boolean; imageUrl?: string; error?: any }> => {
    try {
      console.log('Generating image for task:', task.title);

      // Check if AI image generation API is available
      if (!window.electronAPI?.ai) {
        console.warn('AI image generation API not available');
        return { success: false, error: { userMessage: 'AI機能が利用できません', retryable: false } };
      }

      // Check if AI is initialized
      const isInitialized = await window.electronAPI.ai.isInitialized();
      if (!isInitialized) {
        console.warn('AI image generator not initialized');
        return {
          success: false,
          error: {
            userMessage: 'AI画像生成にはAPIキーの設定が必要です。設定画面で設定してください。',
            retryable: false
          }
        };
      }

      // Get user profile for personalized image generation
      let userDescription = '';
      let artStyle = 'anime';
      let referenceImagePath: string | undefined = undefined;
      let profileQuality: 'low' | 'medium' | 'high' | undefined = undefined;

      try {
        const profileResponse = await window.electronAPI.userProfile.get();
        const profile = profileResponse?.success ? profileResponse.profile : null;
        if (profile) {
          userDescription = profile.description || '';
          artStyle = profile.artStyle || 'anime';
          referenceImagePath = profile.referenceImagePath || undefined;
          if (profile.quality === 'low' || profile.quality === 'medium' || profile.quality === 'high') {
            profileQuality = profile.quality;
          }
        }
      } catch (profileErr) {
        console.warn('Could not fetch user profile, using defaults:', profileErr);
      }

      console.log('User description:', userDescription);
      console.log('Art style:', artStyle);

      const response = await window.electronAPI.ai.generateTaskImage(
        task.title,
        task.description || '',
        userDescription,
        { style: artStyle, size: '256x256', referenceImagePath, quality: profileQuality },
        task.id
      );

      console.log('🔍 AI画像生成レスポンス:', {
        success: response.success,
        hasImageUrl: !!response.imageUrl,
        imageUrlLength: response.imageUrl ? Math.min(response.imageUrl.length, 9999) : undefined,
        imageUrlPrefix: response.imageUrl ? '[data:image/*;base64, ...redacted]' : undefined,
        error: response.error
      });

      if ((response as any).success && (response as any).imageUrl) {
        console.log('✅ 画像生成成功 - タスク:', task.title, 'URL:', response.imageUrl);
        // データベース更新はAIImageGeneratorで実行済み、ここでは画像URLも返す
        return { success: true, imageUrl: (response as any).imageUrl };
      } else {
        console.error('❌ 画像生成失敗:', (response as any).error);
        return { success: false, error: (response as any).error };
      }
    } catch (err) {
      console.error('Failed to generate task image:', err);
      return {
        success: false,
        error: {
          userMessage: '画像生成中に予期しないエラーが発生しました',
          retryable: true
        }
      };
    }
  };

  const regenerateTaskImage = async (taskId: number): Promise<{ success: boolean; error?: any }> => {
    try {
      console.log('🔄 画像再生成開始 - タスクID:', taskId);

      // Check if AI image generation API is available
      if (!window.electronAPI?.ai) {
        console.error('❌ AI API利用不可');
        return { success: false, error: { userMessage: 'AI機能が利用できません', retryable: false } };
      }

      console.log('📡 AI再生成API呼び出し中...');
      const response: any = await window.electronAPI.ai.regenerateTaskImage(taskId);
      console.log('📋 AI再生成レスポンス:', response);

      if (response.success && response.imageUrl) {
        console.log('✅ 画像再生成成功:', response.imageUrl);

        // Update task in local state
        setTasks(prev => prev.map(task =>
          task.id === taskId ? { ...task, imageUrl: response.imageUrl } : task
        ));


        console.log('🔄 ローカル状態更新完了 - タスクID:', taskId);

        // fetchTasks()を削除（直接ローカル状態を更新済み）

        return { success: true };
      } else {
        console.error('❌ 画像再生成失敗:', response.error);
        return { success: false, error: response.error };
      }
    } catch (err) {
      console.error('❌ 画像再生成例外エラー:', err);
      return {
        success: false,
        error: {
          userMessage: '画像再生成中に予期しないエラーが発生しました',
          retryable: true
        }
      };
    }
  };

  useEffect(() => {
    fetchTasks();
    // 他ウィンドウ（ウィジェット等）からの変更を同期
    const listener = () => fetchTasks();
    if (window.electronAPI?.on) {
      window.electronAPI.on('task:updated', listener);
    }
    return () => {
      if (window.electronAPI?.removeAllListeners) {
        window.electronAPI.removeAllListeners('task:updated');
      }
    };
  }, []);




  const value: TaskContextType = {
    tasks,
    stats,
    loading,
    error,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    generateTaskImage,
    regenerateTaskImage
  };

  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  );
};
