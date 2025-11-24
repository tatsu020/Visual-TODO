import { contextBridge, ipcRenderer } from 'electron';

// TaskStep型定義（mainプロセスと同期）
interface TaskStep {
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

const electronAPI = {
  // App controls
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  minimize: () => ipcRenderer.invoke('app:minimize'),
  close: () => ipcRenderer.invoke('app:close'),

  // Store operations
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('store:set', key, value)
  },

  // Dialog operations
  dialog: {
    openFile: (filters?: Electron.FileFilter[]) => ipcRenderer.invoke('dialog:openFile', filters)
  },

  // Shell operations
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
  },

  // Widget controls
  widget: {
    show: () => ipcRenderer.invoke('widget:show'),
    hide: () => ipcRenderer.invoke('widget:hide'),
    toggle: () => ipcRenderer.invoke('widget:toggle'),
    setSize: (width: number, height: number) => ipcRenderer.invoke('widget:setSize', width, height),
    setZoom: (factor: number) => ipcRenderer.invoke('widget:setZoom', factor)
  },

  // OpenAI API
  openai: {
    initialize: (apiKey: string) => ipcRenderer.invoke('openai:initialize', apiKey),
    generateImage: (options: { prompt: string; size?: string; quality?: string; n?: number }) =>
      ipcRenderer.invoke('openai:generateImage', options)
  },

  // AI Image Generation
  ai: {
    generateTaskImage: (taskTitle: string, taskDescription: string, userDescription: string, options?: any, taskId?: number) =>
      ipcRenderer.invoke('ai:generateTaskImage', taskTitle, taskDescription, userDescription, options, taskId),
    regenerateTaskImage: (taskId: number) =>
      ipcRenderer.invoke('ai:regenerateTaskImage', taskId),
    isInitialized: () => ipcRenderer.invoke('ai:isInitialized'),
    convertFileUrlToBase64: (fileUrl: string) =>
      ipcRenderer.invoke('ai:convertFileUrlToBase64', fileUrl),
    getImageUrlByTaskId: (taskId: number) =>
      ipcRenderer.invoke('ai:getImageUrlByTaskId', taskId),
    setProvider: (provider: 'gemini' | 'openai') =>
      ipcRenderer.invoke('ai:setProvider', provider),
    getProvider: () => ipcRenderer.invoke('ai:getProvider'),
    getCacheDir: () => ipcRenderer.invoke('ai:getCacheDir')
  },

  // TaskStep operations
  taskSteps: {
    create: (step: Omit<TaskStep, 'id' | 'created_at' | 'updated_at'>) =>
      ipcRenderer.invoke('taskSteps:create', step),
    getByTaskId: (taskId: number) =>
      ipcRenderer.invoke('taskSteps:getByTaskId', taskId),
    update: (id: number, updates: Partial<TaskStep>) =>
      ipcRenderer.invoke('taskSteps:update', id, updates),
    delete: (id: number) =>
      ipcRenderer.invoke('taskSteps:delete', id),
    reorder: (stepIds: number[]) =>
      ipcRenderer.invoke('taskSteps:reorder', stepIds)
  },

  // Task operations
  tasks: {
    list: (filter?: { status?: string; orderByPriority?: boolean }) =>
      ipcRenderer.invoke('tasks:list', filter),
    listForWidget: () =>
      ipcRenderer.invoke('tasks:listForWidget'),
    create: (task: any) =>
      ipcRenderer.invoke('tasks:create', task),
    update: (id: number, updates: any) =>
      ipcRenderer.invoke('tasks:update', id, updates),
    delete: (id: number) =>
      ipcRenderer.invoke('tasks:delete', id),
    getWithSteps: (taskId: number) =>
      ipcRenderer.invoke('tasks:getWithSteps', taskId)
  },

  // User profile operations
  userProfile: {
    get: () => ipcRenderer.invoke('userProfile:get'),
    save: (profile: any) => ipcRenderer.invoke('userProfile:save', profile)
  },

  // Secure Settings Management
  settings: {
    setApiKey: (apiKey: string) => ipcRenderer.invoke('settings:setApiKey', apiKey),
    hasApiKey: () => ipcRenderer.invoke('settings:hasApiKey'),
    clearApiKey: () => ipcRenderer.invoke('settings:clearApiKey'),
    setOpenAIApiKey: (apiKey: string) => ipcRenderer.invoke('settings:setOpenAIApiKey', apiKey),
    hasOpenAIApiKey: () => ipcRenderer.invoke('settings:hasOpenAIApiKey'),
    clearOpenAIApiKey: () => ipcRenderer.invoke('settings:clearOpenAIApiKey'),
    getMany: (keys: string[]) => ipcRenderer.invoke('settings:getMany', keys),
    setMany: (entries: Record<string, string>) => ipcRenderer.invoke('settings:setMany', entries)
  },

  // Event listeners
  on: (channel: string, callback: Function) => {
    const validChannels = [
      'widget:nextTask',
      'widget:completeTask',
      'widget:skipTask',
      'task:updated',
      'notification:clicked',
      'ai:image-progress'
    ];

    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },

  // Remove event listeners
  removeAllListeners: (channel: string) => {
    const validChannels = [
      'widget:nextTask',
      'widget:completeTask',
      'widget:skipTask',
      'task:updated',
      'notification:clicked',
      'ai:image-progress'
    ];

    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  }
};

// Expose the API to the renderer process
// contextIsolation: true 環境でも確実に使えるよう常に contextBridge で公開
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// 互換性のため、contextIsolation: false 環境でも参照できるように window にも設定
if (typeof window !== 'undefined') {
  (window as any).electronAPI = electronAPI;
}

// Type definitions for the renderer process
export type ElectronAPI = typeof electronAPI;
