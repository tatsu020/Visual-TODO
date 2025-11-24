/**
 * Lightweight browser mock for the Electron preload API.
 * This lets the renderer run in Storybook/Chromium without the real main process.
 */

interface BrowserMockAPI {
  store: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
  };
  dialog: {
    openFile: (filters?: any[]) => Promise<{ canceled: boolean; filePaths: string[] }>;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
  widget: {
    show: () => Promise<void>;
    hide: () => Promise<void>;
    toggle: () => Promise<void>;
  };
  tasks: {
    list: (filter?: { status?: string; orderByPriority?: boolean }) => Promise<{ success: boolean; tasks: any[] }>;
    listForWidget: () => Promise<{ success: boolean; tasks: any[] }>;
    create: (task: any) => Promise<{ success: boolean; task: any }>;
    update: (id: number, updates: any) => Promise<{ success: boolean }>;
    delete: (id: number) => Promise<{ success: boolean }>;
    getWithSteps: (taskId: number) => Promise<{ success: boolean; task: any | null }>;
  };
  userProfile: {
    get: () => Promise<{ success: boolean; profile: any | null }>;
    save: (profile: any) => Promise<{ success: boolean }>;
  };
  settings: {
    setApiKey: (apiKey: string) => Promise<{ success: boolean }>;
    hasApiKey: () => Promise<boolean>;
    clearApiKey: () => Promise<{ success: boolean }>;
    setOpenAIApiKey: (apiKey: string) => Promise<{ success: boolean }>;
    hasOpenAIApiKey: () => Promise<boolean>;
    clearOpenAIApiKey: () => Promise<{ success: boolean }>;
    getMany: (keys: string[]) => Promise<{ success: boolean; values: Record<string, string | null> }>;
    setMany: (entries: Record<string, string>) => Promise<{ success: boolean }>;
  };
  taskSteps: {
    getByTaskId: (taskId: number) => Promise<{ success: boolean; steps: any[] }>;
    create: (step: any) => Promise<{ success: boolean }>;
    update: (id: number, updates: any) => Promise<{ success: boolean }>;
    delete: (id: number) => Promise<{ success: boolean }>;
    reorder: (ids: number[]) => Promise<{ success: boolean }>;
  };
  ai: {
    generateTaskImage: (taskTitle: string, taskDescription: string, userDescription: string, options?: any, taskId?: number) => Promise<{ success: boolean; imageUrl?: string; error?: any }>;
    regenerateTaskImage: (taskId: number) => Promise<{ success: boolean; imageUrl?: string; error?: any }>;
    isInitialized: () => Promise<boolean>;
    getImageUrlByTaskId: (taskId: number) => Promise<{ success: boolean; imageUrl?: string | null }>;
    setProvider: (provider: 'gemini' | 'openai') => Promise<{ success: boolean }>;
    getProvider: () => Promise<'gemini' | 'openai'>;
    getCacheDir: () => Promise<string>;
  };
  on: (channel: string, callback: Function) => void;
  removeAllListeners: (channel: string) => void;
  emit: (channel: string, data?: any) => void;
  getVersion: () => Promise<string>;
  minimize: () => Promise<void>;
  close: () => Promise<void>;
}

const browserStorage = new Map<string, any>();
const tasks = new Map<number, any>();
const settings = new Map<string, string>();
let taskIdCounter = 1;

const userProfileState: { profile: any | null } = { profile: null };

const toPriorityScore = (priority: string | undefined) => {
  if (priority === 'high') return 3;
  if (priority === 'medium') return 2;
  return 1;
};

const createBrowserMock = (): BrowserMockAPI => {
  return {
    store: {
      get: async (key: string) => browserStorage.get(key),
      set: async (key: string, value: any) => {
        browserStorage.set(key, value);
      }
    },

    dialog: {
      openFile: async () => {
        console.log('Mock file dialog opened');
        return { canceled: true, filePaths: [] };
      }
    },

    shell: {
      openExternal: async (url: string) => {
        console.log('Mock external link:', url);
        if (typeof window !== 'undefined') {
          window.open(url, '_blank');
        }
      }
    },

    widget: {
      show: async () => console.log('Mock widget show'),
      hide: async () => console.log('Mock widget hide'),
      toggle: async () => console.log('Mock widget toggle')
    },

    tasks: {
      list: async (filter) => {
        const values = Array.from(tasks.values());
        const filtered = filter?.status ? values.filter(t => t.status === filter.status) : values;
        const ordered = [...filtered].sort((a, b) => {
          if (filter?.orderByPriority) {
            const diff = toPriorityScore(b.priority) - toPriorityScore(a.priority);
            if (diff !== 0) return diff;
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        return { success: true, tasks: ordered };
      },
      listForWidget: async () => {
        const values = Array.from(tasks.values());
        const byStatus = (status: string) => values.filter(t => t.status === status)
          .sort((a, b) => {
            const diff = toPriorityScore(b.priority) - toPriorityScore(a.priority);
            if (diff !== 0) return diff;
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          });
        const active = byStatus('inProgress');
        if (active.length > 0) return { success: true, tasks: active };
        return { success: true, tasks: byStatus('pending') };
      },
      create: async (task) => {
        const now = new Date().toISOString();
        const newTask = {
          id: taskIdCounter++,
          status: 'pending',
          priority: task.priority || 'medium',
          createdAt: now,
          updatedAt: now,
          ...task
        };
        tasks.set(newTask.id, newTask);
        return { success: true, task: newTask };
      },
      update: async (id, updates) => {
        const existing = tasks.get(id);
        if (existing) {
          tasks.set(id, { ...existing, ...updates, updatedAt: new Date().toISOString() });
        }
        return { success: true };
      },
      delete: async (id) => {
        tasks.delete(id);
        return { success: true };
      },
      getWithSteps: async (taskId) => {
        const task = tasks.get(taskId) || null;
        return { success: true, task };
      }
    },

    userProfile: {
      get: async () => ({ success: true, profile: userProfileState.profile }),
      save: async (profile) => {
        const now = new Date().toISOString();
        userProfileState.profile = { id: 1, ...profile, updatedAt: now, createdAt: profile.createdAt || now };
        return { success: true };
      }
    },

    settings: {
      setApiKey: async (apiKey: string) => {
        settings.set('geminiApiKey', apiKey);
        return { success: true };
      },
      hasApiKey: async () => settings.has('geminiApiKey'),
      clearApiKey: async () => {
        settings.delete('geminiApiKey');
        return { success: true };
      },
      setOpenAIApiKey: async (apiKey: string) => {
        settings.set('openaiApiKey', apiKey);
        settings.set('imageProvider', 'openai');
        return { success: true };
      },
      hasOpenAIApiKey: async () => settings.has('openaiApiKey'),
      clearOpenAIApiKey: async () => {
        settings.delete('openaiApiKey');
        return { success: true };
      },
      getMany: async (keys: string[]) => {
        const values: Record<string, string | null> = {};
        for (const key of keys) {
          values[key] = settings.has(key) ? settings.get(key)! : null;
        }
        return { success: true, values };
      },
      setMany: async (entries: Record<string, string>) => {
        for (const [key, value] of Object.entries(entries)) {
          settings.set(key, value);
        }
        return { success: true };
      }
    },

    taskSteps: {
      getByTaskId: async () => ({ success: true, steps: [] }),
      create: async () => ({ success: true }),
      update: async () => ({ success: true }),
      delete: async () => ({ success: true }),
      reorder: async () => ({ success: true })
    },

    ai: {
      generateTaskImage: async (taskTitle: string) => ({
        success: true,
        imageUrl: `data:image/svg+xml;base64,${btoa(`
          <svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
            <rect width="256" height="256" fill="#f0f0f0"/>
            <text x="128" y="130" text-anchor="middle" font-family="Arial" font-size="14" fill="#666">
              Mock AI Image
            </text>
            <text x="128" y="150" text-anchor="middle" font-family="Arial" font-size="12" fill="#999">
              ${taskTitle.slice(0, 18)}
            </text>
          </svg>
        `)}`
      }),
      regenerateTaskImage: async (_taskId: number) => ({ success: true }),
      isInitialized: async () => true,
      getImageUrlByTaskId: async (taskId: number) => ({ success: true, imageUrl: tasks.get(taskId)?.imageUrl || null }),
      setProvider: async () => ({ success: true }),
      getProvider: async () => 'gemini' as const,
      getCacheDir: async () => '/tmp/mock-cache'
    },

    on: (channel: string, _callback: Function) => {
      console.log('Mock event listener added:', channel);
    },

    removeAllListeners: (channel: string) => {
      console.log('Mock event listeners removed:', channel);
    },

    emit: (channel: string, data?: any) => {
      console.log('Mock event emitted:', channel, data);
    },

    getVersion: async () => '1.0.0',
    minimize: async () => console.log('Mock minimize'),
    close: async () => console.log('Mock close')
  };
};

// Initialize mock if in browser environment
if (typeof window !== 'undefined' && !(window as any).electronAPI) {
  console.log('Browser environment detected, initializing mock API');
  (window as any).electronAPI = createBrowserMock();

  const mockAPI = (window as any).electronAPI as any;
  const now = new Date().toISOString();
  mockAPI.tasks.create({
    title: 'Sample Task 1',
    description: 'Example task created for browser mock',
    priority: 'high',
    status: 'pending',
    type: 'immediate',
    scheduledTime: null,
    estimatedDuration: 30,
    createdAt: now,
    updatedAt: now,
    recurringPattern: null,
    dueDate: null
  });

  mockAPI.tasks.create({
    title: 'Sample Task 2',
    description: 'Completed sample task',
    priority: 'medium',
    status: 'completed',
    type: 'immediate',
    scheduledTime: null,
    estimatedDuration: 15,
    createdAt: now,
    updatedAt: now,
    recurringPattern: null,
    dueDate: null
  });
}

export default createBrowserMock;
