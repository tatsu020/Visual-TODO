// Browser environment mock for Electron APIs
interface BrowserMockDatabase {
  query: (sql: string, params?: any[]) => Promise<any>;
}

interface BrowserMockAPI {
  database: BrowserMockDatabase;
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
  openai: {
    initialize: (apiKey: string) => Promise<{ success: boolean }>;
    generateImage: (options: { prompt: string; size?: string; quality?: string; n?: number }) => Promise<any>;
  };
  on: (channel: string, _callback: Function) => void;
  removeAllListeners: (channel: string) => void;
  emit: (channel: string, data?: any) => void;
  getVersion: () => Promise<string>;
  minimize: () => Promise<void>;
  close: () => Promise<void>;
}

// Simple in-memory storage for browser testing
const browserStorage = new Map<string, any>();
const tasks = new Map<number, any>();
const userProfile = new Map<string, any>();
const settings = new Map<string, any>();

let taskIdCounter = 1;

const createBrowserMock = (): BrowserMockAPI => {
  return {
    database: {
      query: async (sql: string, params: any[] = []) => {
        console.log('Mock database query:', sql, params);

        // Simple SQL parser for testing
        if (sql.includes('SELECT * FROM tasks')) {
          return Array.from(tasks.values());
        }

        if (sql.includes('INSERT INTO tasks')) {
          const taskData = {
            id: taskIdCounter++,
            title: params[0] || 'Sample Task',
            description: params[1] || '',
            priority: params[2] || 'medium',
            status: params[3] || 'pending',
            type: params[4] || 'immediate',
            scheduledTime: params[5] || null,
            estimatedDuration: params[6] || null,
            createdAt: params[7] || new Date().toISOString(),
            updatedAt: params[8] || new Date().toISOString(),
            recurringPattern: params[9] || null,
            dueDate: params[10] || null,
            imageUrl: null
          };
          tasks.set(taskData.id, taskData);
          return { lastID: taskData.id, changes: 1 };
        }

        if (sql.includes('UPDATE tasks')) {
          // Simple update handling
          const taskId = params[params.length - 1];
          const existingTask = tasks.get(taskId);
          if (existingTask) {
            const updatedTask = { ...existingTask, updatedAt: new Date().toISOString() };
            if (sql.includes('status = ?')) {
              updatedTask.status = params[0];
              if (params[0] === 'completed') {
                updatedTask.completedAt = new Date().toISOString();
              }
            }
            tasks.set(taskId, updatedTask);
            return { changes: 1 };
          }
          return { changes: 0 };
        }

        if (sql.includes('DELETE FROM tasks')) {
          const taskId = params[0];
          const deleted = tasks.delete(taskId);
          return { changes: deleted ? 1 : 0 };
        }

        if (sql.includes('SELECT * FROM user_profiles')) {
          const profile = userProfile.get('profile');
          return profile ? [profile] : [];
        }

        if (sql.includes('INSERT') && sql.includes('user_profiles')) {
          const profileData = {
            id: 1,
            description: params[0],
            referenceImagePath: params[1],
            artStyle: params[2],
            createdAt: params[3],
            updatedAt: params[4]
          };
          userProfile.set('profile', profileData);
          return { lastID: 1, changes: 1 };
        }

        if (sql.includes('UPDATE') && sql.includes('user_profiles')) {
          const existing = userProfile.get('profile');
          if (existing) {
            const updated = {
              ...existing,
              description: params[0],
              referenceImagePath: params[1],
              artStyle: params[2],
              updatedAt: params[3]
            };
            userProfile.set('profile', updated);
            return { changes: 1 };
          }
          return { changes: 0 };
        }

        if (sql.includes('SELECT value FROM settings')) {
          const key = params[0];
          const setting = settings.get(key);
          return setting ? [{ value: setting }] : [];
        }

        if (sql.includes('INSERT OR REPLACE INTO settings')) {
          const [key, value] = params;
          settings.set(key, value);
          return { changes: 1 };
        }

        return [];
      }
    },

    store: {
      get: async (key: string) => {
        return browserStorage.get(key);
      },
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
        window.open(url, '_blank');
      }
    },

    widget: {
      show: async () => console.log('Mock widget show'),
      hide: async () => console.log('Mock widget hide'),
      toggle: async () => console.log('Mock widget toggle')
    },

    openai: {
      initialize: async (apiKey: string) => {
        console.log('Mock OpenAI API initialized with key:', apiKey.slice(0, 20) + '...');
        return { success: true };
      },
      generateImage: async (options: { prompt: string; size?: string; quality?: string; n?: number }) => {
        console.log('Mock image generation for prompt:', options.prompt);
        // Return mock image response
        return {
          data: [{
            url: `data:image/svg+xml;base64,${btoa(`
              <svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
                <rect width="256" height="256" fill="#f0f0f0"/>
                <text x="128" y="120" text-anchor="middle" font-family="Arial" font-size="14" fill="#666">
                  Mock AI Image
                </text>
                <text x="128" y="140" text-anchor="middle" font-family="Arial" font-size="12" fill="#999">
                  ${options.prompt.slice(0, 30)}...
                </text>
              </svg>
            `)}`
          }]
        };
      }
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
if (typeof window !== 'undefined' && !window.electronAPI) {
  console.log('Browser environment detected, initializing mock API');
  (window as any).electronAPI = createBrowserMock();

  // Add some sample data for testing
  const mockAPI = window.electronAPI as any;
  mockAPI.database.query(
    'INSERT INTO tasks (title, description, priority, status, type, scheduledTime, estimatedDuration, createdAt, updatedAt, recurringPattern, dueDate)',
    ['サンプルタスク1', '最初のサンプルタスクです', 'high', 'pending', 'immediate', null, 30, new Date().toISOString(), new Date().toISOString(), null, null]
  );

  mockAPI.database.query(
    'INSERT INTO tasks (title, description, priority, status, type, scheduledTime, estimatedDuration, createdAt, updatedAt, recurringPattern, dueDate)',
    ['サンプルタスク2', '完了済みのタスクです', 'medium', 'completed', 'immediate', null, 15, new Date().toISOString(), new Date().toISOString(), null, null]
  );
}

export default createBrowserMock;