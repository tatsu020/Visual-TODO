export interface Task {
  id?: number;
  title: string;
  description?: string;
  category: string;
  status: 'pending' | 'inProgress' | 'completed' | 'paused';
  type: 'immediate' | 'recurring' | 'scheduled';
  scheduledTime?: string;
  estimatedDuration?: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  imageUrl?: string;
  recurringPattern?: string;
  dueDate?: string;
}

export interface TaskStep {
  id?: number;
  task_id: number;
  title: string;
  description?: string;
  order_index: number;
  status: 'pending' | 'inProgress' | 'completed';
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface TaskWithSteps extends Task {
  steps?: TaskStep[];
  completedSteps?: number;
  totalSteps?: number;
  stepProgress?: number;
}

export interface UserProfile {
  id?: number;
  description: string;
  referenceImagePath?: string;
  artStyle: string;
  quality?: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  id?: number;
  key: string;
  value: string;
  updatedAt: string;
}

export interface TaskFormData {
  title: string;
  description: string;
  category: string;
  type: 'immediate' | 'recurring' | 'scheduled';
  scheduledTime?: string;
  estimatedDuration?: number;
  recurringPattern?: string;
  dueDate?: string;
}

export interface UserProfileFormData {
  description: string;
  referenceImagePath?: string;
  artStyle: string;
  quality?: 'low' | 'medium' | 'high';
}

export interface AIImageGenerationParams {
  prompt: string;
  referenceImagePath?: string;
  style: string;
  size?: '256x256' | '384x256' | '512x512' | '1024x1024';
}

export type TaskCategory = 
  | 'work'
  | 'health'
  | 'study'
  | 'hobby'
  | 'household'
  | 'social'
  | 'finance'
  | 'general';

export type ArtStyle = 
  | 'anime'
  | 'realistic'
  | 'watercolor'
  | 'pixel'
  | 'sketch'
  | 'cartoon'
  | 'minimalist';

export type TaskStatus = 'pending' | 'inProgress' | 'completed' | 'paused';
export type TaskType = 'immediate' | 'recurring' | 'scheduled';

export interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
  paused: number;
  completionRate: number;
}

export interface CategoryStats {
  [category: string]: {
    total: number;
    completed: number;
    completionRate: number;
  };
}

declare global {
  interface Window {
    electronAPI: {
      getVersion: () => Promise<string>;
      minimize: () => Promise<void>;
      close: () => Promise<void>;
      store: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<void>;
      };
      database: {
        query: (query: string, params?: any[]) => Promise<any>;
      };
      dialog: {
        openFile: (filters?: any[]) => Promise<any>;
      };
      shell: {
        openExternal: (url: string) => Promise<void>;
      };
      widget: {
        show: () => Promise<void>;
        hide: () => Promise<void>;
        toggle: () => Promise<void>;
      };
      gemini?: {
        initialize: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
        generateImage: (options: { prompt: string; style?: string; size?: string }) => Promise<any>;
      };
      ai?: {
        generateTaskImage: (taskTitle: string, taskDescription: string, userDescription: string, options?: any, taskId?: number) => Promise<{ success: boolean; imageUrl?: string; error?: string }>;
        regenerateTaskImage: (taskId: number) => Promise<{ success: boolean; imageUrl?: string; error?: string }>;
        isInitialized: () => Promise<boolean>;
        getImageUrlByTaskId: (taskId: number) => Promise<{ success: boolean; imageUrl?: string; error?: string }>;
        setProvider: (provider: 'gemini' | 'openai') => Promise<{ success: boolean; error?: string }>;
        getProvider: () => Promise<'gemini' | 'openai'>;
      };
      settings?: {
        setApiKey: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
        hasApiKey: () => Promise<boolean>;
        clearApiKey: () => Promise<{ success: boolean; error?: string }>;
        setOpenAIApiKey: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
        hasOpenAIApiKey: () => Promise<boolean>;
        clearOpenAIApiKey: () => Promise<{ success: boolean; error?: string }>;
      };
      taskSteps?: {
        getByTaskId: (taskId: number) => Promise<{ success: boolean; steps: any[] }>;
      };
      on: (channel: string, callback: Function) => void;
      removeAllListeners: (channel: string) => void;
      emit?: (channel: string, ...args: any[]) => void;
    };
  }
}