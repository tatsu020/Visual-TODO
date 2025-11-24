import { app, BrowserWindow, Tray, Menu, ipcMain, dialog, shell } from 'electron';
import { join } from 'path';
// import { is } from 'electron-util';
import Store from 'electron-store';
import { createTray } from './tray';
import { createWidget } from './widget';
import { DatabaseManager, TaskStep } from './database';
import { NotificationManager } from './notifications';
import { AIImageGenerator } from './ai-image';

// httpモジュールを使用してポート検出
import { request } from 'http';

interface AppStore {
  windowBounds?: Electron.Rectangle;
  widgetBounds?: Electron.Rectangle;
  widgetVisible?: boolean;
  apiKey?: string;
  userProfile?: {
    description: string;
    referenceImage?: string;
    artStyle: string;
  };
}

/*
==============================================================================
VisualTodoApp クラス - 安全に保管（完全な機能を持つオリジナルコード）
==============================================================================
class VisualTodoApp {
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private widget: BrowserWindow | null = null;
  private store: Store<AppStore>;
  private database?: DatabaseManager;
  private notifications?: NotificationManager;
  private aiImageGenerator?: AIImageGenerator;
  private isDev: boolean;

  constructor() {
    this.store = new Store<AppStore>();
    // 段階的テスト: 複雑な初期化を一時無効化
    // this.database = new DatabaseManager();
    // this.notifications = new NotificationManager();
    // this.aiImageGenerator = new AIImageGenerator(this.database);
    this.isDev = !app.isPackaged;
  }

  async initialize() {
    // 段階的テスト: 基本機能のみ有効化
    // await this.database.initialize();
    // await this.loadApiKeyAndInitialize();
    this.setupEventHandlers();
    this.createMainWindow();
    // this.createTray();
    // this.createWidget();
  }

  private async loadApiKeyAndInitialize() {
    try {
      // セキュアなAPIキー管理：環境変数またはデータベースから取得
      const apiKeyResult = await this.database?.query('SELECT value FROM settings WHERE key = ?', ['geminiApiKey']) || [];
      let apiKey: string | null = null;
      
      if (apiKeyResult.length > 0 && apiKeyResult[0].value) {
        // データベースから暗号化されたAPIキーを取得
        apiKey = apiKeyResult[0].value;
      } else {
        // 環境変数からAPIキーを取得（開発・テスト用）
        apiKey = process.env.GEMINI_API_KEY || null;
        
        if (apiKey) {
          // 環境変数からAPIキーが取得できた場合、データベースに保存
          await this.database?.query(
            'INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updatedAt = ?',
            ['geminiApiKey', apiKey, new Date().toISOString(), apiKey, new Date().toISOString()]
          );
        }
      }
      
      if (apiKey) {
        await this.aiImageGenerator?.initialize(apiKey);
        console.log('Gemini AI Image Generator initialized with secure API key');
      } else {
        console.warn('No Gemini API key found. AI image generation will be disabled.');
        console.info('Please set API key via Settings or GEMINI_API_KEY environment variable');
      }
    } catch (error) {
      console.error('Failed to load API key and initialize:', error);
    }
  }

  private setupEventHandlers() {
    app.whenReady().then(() => this.initialize());

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createMainWindow();
      }
    });

    app.on('before-quit', () => {
      // 段階的テスト: データベースクローズを一時無効化
      // this.database.close();
    });

    ipcMain.handle('app:getVersion', () => app.getVersion());
    ipcMain.handle('app:minimize', () => this.mainWindow?.minimize());
    ipcMain.handle('app:close', () => this.mainWindow?.close());
    
    ipcMain.handle('store:get', (_, key: keyof AppStore) => this.store.get(key));
    ipcMain.handle('store:set', (_, key: keyof AppStore, value: any) => this.store.set(key, value));
    
    // 段階的テスト: データベース機能を一時無効化
    // ipcMain.handle('database:query', async (_, query: string, params?: any[]) => {
    //   return await this.database.query(query, params);
    // });

    ipcMain.handle('dialog:openFile', async (_, filters?: Electron.FileFilter[]) => {
      const result = await dialog.showOpenDialog(this.mainWindow!, {
        properties: ['openFile'],
        filters: filters || [
          { name: 'Images', extensions: ['jpg', 'png', 'gif', 'jpeg'] }
        ]
      });
      return result;
    });

    ipcMain.handle('shell:openExternal', (_, url: string) => {
      shell.openExternal(url);
    });

    // 段階的テスト: ウィジェット機能を一時無効化
    // ipcMain.handle('widget:show', () => this.showWidget());
    // ipcMain.handle('widget:hide', () => this.hideWidget());
    // ipcMain.handle('widget:toggle', () => this.toggleWidget());

    // 段階的テスト: AI・設定関連機能を一時無効化
    // Gemini AI handlers (using existing ai:generateTaskImage handler)
    // ipcMain.handle('ai:generateTaskImage', async (_, taskTitle: string, taskDescription: string, userDescription: string, options: any = {}) => { ... });
    // ipcMain.handle('ai:regenerateTaskImage', async (_, taskId: number) => { ... });
    // ipcMain.handle('ai:isInitialized', () => { ... });
    // セキュアな設定管理ハンドラー
    // ipcMain.handle('settings:setApiKey', async (_, apiKey: string) => { ... });
    // ipcMain.handle('settings:hasApiKey', async () => { ... });
    // ipcMain.handle('settings:clearApiKey', async () => { ... });
  }

  private createMainWindow() {
    console.log('[Main] Creating main window...');
    
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      alwaysOnTop: false,
      frame: true,
      transparent: false,
      backgroundColor: '#ffffff',
      title: 'Visual TODO App',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, '../preload/preload.js'),
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false
      }
    });

    console.log('[Main] BrowserWindow created, isDev:', this.isDev);

    // 実際のアプリケーションロード
    if (this.isDev) {
      console.log('[Main] Loading development server URL');
      this.mainWindow.loadURL('http://localhost:5173');
      this.mainWindow.webContents.openDevTools();
    } else {
      console.log('[Main] Loading production files');
      this.mainWindow.loadFile(join(__dirname, '../../renderer/index.html'));
    }

    this.mainWindow.once('ready-to-show', () => {
      console.log('[Main] ready-to-show event fired, showing window');
      this.mainWindow?.show();
    });

    this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('[Main] Failed to load:', errorCode, errorDescription, validatedURL);
    });

    this.mainWindow.webContents.on('did-finish-load', () => {
      console.log('[Main] Page finished loading');
    });

    this.mainWindow.on('close', (event) => {
      event.preventDefault();
      this.mainWindow?.hide();
    });

    this.mainWindow.on('resize', () => {
      this.saveBounds();
    });

    this.mainWindow.on('move', () => {
      this.saveBounds();
    });
  }

  private createTray() {
    this.tray = createTray(this);
  }

  private async createWidget() {
    this.widget = await createWidget(this);
    // 開発時は常に表示してデバッグしやすくする。ユーザー設定は本番で尊重
    const shouldShow = this.isDev || this.store.get('widgetVisible', true);
    if (shouldShow) {
      this.widget.show();
    }

    // 読み込み完了後にも再度可視化を保証（描画遅延対策）
    this.widget?.once('ready-to-show', () => {
      const stillShouldShow = this.isDev || this.store.get('widgetVisible', true);
      if (stillShouldShow) {
        this.widget?.show();
      }
    });
  }

  private saveBounds() {
    if (this.mainWindow) {
      this.store.set('windowBounds', this.mainWindow.getBounds());
    }
  }

  public showMainWindow() {
    if (this.mainWindow) {
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  public hideMainWindow() {
    if (this.mainWindow) {
      this.mainWindow.hide();
    }
  }

  public showWidget() {
    if (this.widget) {
      this.widget.show();
      this.store.set('widgetVisible', true);
    }
  }

  public hideWidget() {
    if (this.widget) {
      this.widget.hide();
      this.store.set('widgetVisible', false);
    }
  }

  public toggleWidget() {
    if (this.widget?.isVisible()) {
      this.hideWidget();
    } else {
      this.showWidget();
    }
  }

  public quit() {
    app.quit();
  }

  public getMainWindow() {
    return this.mainWindow;
  }

  public getWidget() {
    return this.widget;
  }

  public getDatabase() {
    return this.database;
  }

  public getNotifications() {
    return this.notifications;
  }
}

const visualTodoApp = new VisualTodoApp();

export default visualTodoApp;

if (require.main === module) {
  visualTodoApp.initialize();
}

export default visualTodoApp;
==============================================================================
*/

// 修正版: 無限ループ問題を解決したVisualTodoAppクラス
class VisualTodoApp {
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private widget: BrowserWindow | null = null;
  private store: Store<AppStore>;
  private database: DatabaseManager;
  private notifications: NotificationManager;
  private aiImageGenerator: AIImageGenerator;
  private isDev: boolean;

  constructor() {
    this.store = new Store<AppStore>();
    this.database = new DatabaseManager();
    this.notifications = new NotificationManager();
    this.aiImageGenerator = new AIImageGenerator(
      this.database,
      (progress) => {
        // 進行度を全てのウィンドウにブロードキャスト
        this.broadcast('ai:image-progress', progress);
      }
    );
    this.isDev = !app.isPackaged;

    // 修正: コンストラクタでイベントハンドラーを設定（無限ループ回避）
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // 修正: app.whenReady は一度だけ呼び出し
    app.whenReady().then(async () => {
      try {
        console.log('[Main] App ready, initializing database...');
        await this.database.initialize();
        console.log('[Main] Database initialized, loading API key...');
      } catch (error) {
        console.error('[Main] Database initialization failed:', error);
      }

      try {
        await this.loadApiKeyAndInitialize();
      } catch (error) {
        console.error('[Main] API key initialization failed:', error);
      }

      try {
        console.log('[Main] Restoring image mappings from database...');
        await this.aiImageGenerator.restoreMappingsFromDatabase(this.database);
        console.log('[Main] AI Image Generator ready, creating components...');
      } catch (error) {
        console.error('[Main] Image mapping restore failed:', error);
      }

      try {
        await this.createMainWindow();
      } catch (error) {
        console.error('[Main] Failed to create main window:', error);
      }

      try {
        this.createTray();
      } catch (error) {
        console.error('[Main] Failed to create tray:', error);
      }

      try {
        await this.createWidget();
      } catch (error) {
        console.error('[Main] Failed to create widget:', error);
      }
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createMainWindow();
      }
    });

    app.on('before-quit', () => {
      this.database.close();
    });

    // 基本的なIPCハンドラー
    ipcMain.handle('app:getVersion', () => app.getVersion());
    ipcMain.handle('app:minimize', () => this.mainWindow?.minimize());
    ipcMain.handle('app:close', () => this.mainWindow?.close());

    ipcMain.handle('store:get', (_, key: keyof AppStore) => this.store.get(key));
    ipcMain.handle('store:set', (_, key: keyof AppStore, value: any) => this.store.set(key, value));

    // Database IPC (typed)
    ipcMain.handle('tasks:list', async (_evt, filter?: { status?: string; orderByPriority?: boolean }) => {
      try {
        const tasks = filter?.status
          ? await this.database.getTasksByStatus(filter.status, !!filter.orderByPriority)
          : await this.database.getTasks();
        return { success: true, tasks };
      } catch (error) {
        console.error('Failed to list tasks:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('tasks:listForWidget', async () => {
      try {
        const tasks = await this.database.getPreferredTasksForWidget();
        return { success: true, tasks };
      } catch (error) {
        console.error('Failed to list tasks for widget:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('tasks:create', async (_evt, input: any) => {
      try {
        const task = await this.database.createTaskFromInput(input);
        this.broadcast('task:updated');
        return { success: true, task };
      } catch (error) {
        console.error('Failed to create task:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('tasks:update', async (_evt, id: number, updates: any) => {
      try {
        await this.database.updateTask(id, updates);
        this.broadcast('task:updated');
        return { success: true };
      } catch (error) {
        console.error('Failed to update task:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('tasks:delete', async (_evt, id: number) => {
      try {
        await this.database.deleteTask(id);
        this.broadcast('task:updated');
        return { success: true };
      } catch (error) {
        console.error('Failed to delete task:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('userProfile:get', async () => {
      try {
        const profile = await this.database.getUserProfile();
        return { success: true, profile };
      } catch (error) {
        console.error('Failed to get user profile:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('userProfile:save', async (_evt, payload: any) => {
      try {
        await this.database.createOrUpdateUserProfile(payload);
        return { success: true };
      } catch (error) {
        console.error('Failed to save user profile:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('settings:getMany', async (_evt, keys: string[]) => {
      try {
        const values = await this.database.getSettings(keys);
        return { success: true, values };
      } catch (error) {
        console.error('Failed to get settings:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('settings:setMany', async (_evt, entries: Record<string, string>) => {
      try {
        await this.database.setSettings(entries);
        return { success: true };
      } catch (error) {
        console.error('Failed to set settings:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('dialog:openFile', async (_, filters?: Electron.FileFilter[]) => {
      const result = await dialog.showOpenDialog(this.mainWindow!, {
        properties: ['openFile'],
        filters: filters || [
          { name: 'Images', extensions: ['jpg', 'png', 'gif', 'jpeg'] }
        ]
      });
      return result;
    });

    ipcMain.handle('shell:openExternal', (_, url: string) => {
      shell.openExternal(url);
    });

    // ウィジェット機能復元
    ipcMain.handle('widget:show', () => this.showWidget());
    ipcMain.handle('widget:hide', () => this.hideWidget());
    ipcMain.handle('widget:toggle', () => this.toggleWidget());
    ipcMain.handle('widget:setSize', (_evt, width: number, height: number) => {
      try {
        if (this.widget && !this.widget.isDestroyed()) {
          this.widget.setSize(Math.max(200, Math.min(width, 800)), Math.max(160, Math.min(height, 600)));
          return true;
        }
      } catch { }
      return false;
    });
    ipcMain.handle('widget:setZoom', (_evt, factor: number) => {
      try {
        if (this.widget && !this.widget.isDestroyed()) {
          const safe = Math.max(0.5, Math.min(factor, 2));
          this.widget.webContents.setZoomFactor(safe);
          return true;
        }
      } catch { }
      return false;
    });

    // Google Gemini AI IPCハンドラー復元
    ipcMain.handle('ai:generateTaskImage', async (_, taskTitle: string, taskDescription: string, userDescription: string, options: any = {}, taskId?: number) => {
      try {
        console.log('🔄 IPC画像生成リクエスト - タスク:', taskTitle, 'ID:', taskId);
        const result = await this.aiImageGenerator.generateTaskImage(taskTitle, taskDescription, userDescription, options, taskId);
        console.log('📋 IPC画像生成レスポンス:', result.success ? '成功' : '失敗');
        return result; // 構造化されたレスポンス（success/error）を直接返す
      } catch (error) {
        console.error('Failed to generate task image:', error);
        return {
          success: false,
          error: {
            type: 'UNKNOWN_ERROR',
            message: error instanceof Error ? error.message : String(error),
            userMessage: '画像生成中に予期しないエラーが発生しました。再試行してください。',
            retryable: true
          }
        };
      }
    });

    ipcMain.handle('ai:regenerateTaskImage', async (_, taskId: number) => {
      try {
        const result = await this.aiImageGenerator.regenerateTaskImage(taskId);
        return result; // 構造化されたレスポンス（success/error）を直接返す
      } catch (error) {
        console.error('Failed to regenerate task image:', error);
        return {
          success: false,
          error: {
            type: 'UNKNOWN_ERROR',
            message: error instanceof Error ? error.message : String(error),
            userMessage: '画像再生成中に予期しないエラーが発生しました。再試行してください。',
            retryable: true
          }
        };
      }
    });

    ipcMain.handle('ai:isInitialized', () => {
      return this.aiImageGenerator.isInitialized();
    });

    ipcMain.handle('ai:convertFileUrlToBase64', async (_, fileUrl: string) => {
      try {
        const result = await this.aiImageGenerator.convertFileUrlToBase64(fileUrl);
        return { success: true, imageUrl: result };
      } catch (error) {
        console.error('Failed to convert file URL to base64:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // 新機能: TaskIDから直接画像URLを取得
    ipcMain.handle('ai:getImageUrlByTaskId', async (_, taskId: number) => {
      try {
        const imageUrl = await this.aiImageGenerator.getImageUrlByTaskId(taskId);
        return { success: true, imageUrl };
      } catch (error) {
        console.error('Failed to get image URL by task ID:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // セキュアな設定管理ハンドラー復元
    ipcMain.handle('settings:setApiKey', async (_, apiKey: string) => {
      try {
        if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
          return { success: false, error: 'Invalid API key provided' };
        }

        await this.database.query(
          'INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updatedAt = ?',
          ['geminiApiKey', apiKey.trim(), new Date().toISOString(), apiKey.trim(), new Date().toISOString()]
        );

        await this.aiImageGenerator.initialize(apiKey.trim());

        return { success: true };
      } catch (error) {
        console.error('Failed to set API key:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // OpenAI APIキー設定（gpt-image-1 用）
    ipcMain.handle('settings:setOpenAIApiKey', async (_, apiKey: string) => {
      try {
        if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
          return { success: false, error: 'Invalid API key provided' };
        }

        await this.database.query(
          'INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updatedAt = ?',
          ['openaiApiKey', apiKey.trim(), new Date().toISOString(), apiKey.trim(), new Date().toISOString()]
        );

        await this.aiImageGenerator.initializeOpenAI(apiKey.trim());
        // 初回セット時はプロバイダをOpenAIに切替（ユーザーの意図を優先）
        this.aiImageGenerator.setProvider('openai');
        await this.database.query(
          'INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (?, ?, ?)',
          ['imageProvider', 'openai', new Date().toISOString()]
        );
        return { success: true };
      } catch (error) {
        console.error('Failed to set OpenAI API key:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('settings:hasOpenAIApiKey', async () => {
      try {
        const result = await this.database.query('SELECT value FROM settings WHERE key = ?', ['openaiApiKey']);
        return result.length > 0 && result[0].value && result[0].value.trim().length > 0;
      } catch (error) {
        console.error('Failed to check OpenAI API key:', error);
        return false;
      }
    });

    ipcMain.handle('settings:clearOpenAIApiKey', async () => {
      try {
        await this.database.query('DELETE FROM settings WHERE key = ?', ['openaiApiKey']);
        return { success: true };
      } catch (error) {
        console.error('Failed to clear OpenAI API key:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // 画像プロバイダ切替
    ipcMain.handle('ai:setProvider', async (_, provider: 'gemini' | 'openai') => {
      try {
        this.aiImageGenerator.setProvider(provider);
        // 永続化
        await this.database.query(
          'INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (?, ?, ?)',
          ['imageProvider', provider, new Date().toISOString()]
        );
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('ai:getProvider', () => {
      return this.aiImageGenerator.getProvider();
    });

    ipcMain.handle('ai:getCacheDir', () => {
      return this.aiImageGenerator.getCacheDir();
    });

    ipcMain.handle('settings:hasApiKey', async () => {
      try {
        const result = await this.database.query('SELECT value FROM settings WHERE key = ?', ['geminiApiKey']);
        return result.length > 0 && result[0].value && result[0].value.trim().length > 0;
      } catch (error) {
        console.error('Failed to check API key:', error);
        return false;
      }
    });

    ipcMain.handle('settings:clearApiKey', async () => {
      try {
        await this.database.query('DELETE FROM settings WHERE key = ?', ['geminiApiKey']);
        return { success: true };
      } catch (error) {
        console.error('Failed to clear API key:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // TaskStepハンドラーを設定
    this.setupTaskStepHandlers();
  }

  // TaskStep関連IPCハンドラーを追加
  private setupTaskStepHandlers() {
    ipcMain.handle('taskSteps:create', async (_, step: Omit<TaskStep, 'id' | 'created_at' | 'updated_at'>) => {
      try {
        const stepId = await this.database.createTaskStep(step);
        return { success: true, stepId };
      } catch (error) {
        console.error('Failed to create task step:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('taskSteps:getByTaskId', async (_, taskId: number) => {
      try {
        const steps = await this.database.getTaskSteps(taskId);
        return { success: true, steps };
      } catch (error) {
        console.error('Failed to get task steps:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('taskSteps:update', async (_, stepId: number, step: Partial<TaskStep>) => {
      try {
        await this.database.updateTaskStep(stepId, step);
        return { success: true };
      } catch (error) {
        console.error('Failed to update task step:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('taskSteps:delete', async (_, stepId: number) => {
      try {
        await this.database.deleteTaskStep(stepId);
        return { success: true };
      } catch (error) {
        console.error('Failed to delete task step:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('taskSteps:reorder', async (_, stepIds: number[]) => {
      try {
        await this.database.reorderTaskSteps(stepIds);
        return { success: true };
      } catch (error) {
        console.error('Failed to reorder task steps:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('tasks:getWithSteps', async (_, taskId: number) => {
      try {
        const taskWithSteps = await this.database.getTaskWithSteps(taskId);
        // レンダラーは result.task を期待しているためキー名を合わせる
        return { success: true, task: taskWithSteps };
      } catch (error) {
        console.error('Failed to get task with steps:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });
  }

  private async findVitePort(): Promise<string> {
    // 環境変数を直接ロードするのではなく、.env.localファイルを明示的に読み込み
    const fs = require('fs');
    const path = require('path');

    let preferredPort = '5173'; // デフォルトポート

    try {
      // パスを絶対パスで解決
      const envLocalPath = path.resolve(__dirname, '../../../.env.local');
      console.log(`🔧 [Main] Checking .env.local at: ${envLocalPath}`);
      if (fs.existsSync(envLocalPath)) {
        const envContent = fs.readFileSync(envLocalPath, 'utf8');
        console.log(`🔧 [Main] .env.local content: ${envContent}`);
        const vitePortMatch = envContent.match(/VITE_PORT=(.+)/);
        if (vitePortMatch) {
          preferredPort = vitePortMatch[1].trim();
          console.log(`🔧 [Main] Loaded VITE_PORT from .env.local: ${preferredPort}`);
        }
      } else {
        console.log(`🔧 [Main] .env.local file not found at: ${envLocalPath}`);
      }
    } catch (error) {
      console.warn('[Main] Could not read .env.local file:', error);
    }

    // 環境変数からもチェック
    if (process.env.VITE_PORT) {
      preferredPort = process.env.VITE_PORT;
      console.log(`🔧 [Main] Using VITE_PORT from environment: ${preferredPort}`);
    }

    console.log(`🔧 [Main] Attempting to connect to Vite server on port ${preferredPort}`);

    // 指定されたポートでViteサーバーが動作しているか確認
    const isViteRunning = await this.checkVitePort(parseInt(preferredPort));
    if (isViteRunning) {
      console.log(`✅ [Main] Confirmed Vite server running on port ${preferredPort}`);
      return preferredPort;
    }

    // 指定ポートでサーバーが利用できない場合、他のポートをスキャン
    console.log(`⚠️ [Main] Vite server not found on port ${preferredPort}, scanning nearby ports...`);

    for (let port = parseInt(preferredPort) - 5; port <= parseInt(preferredPort) + 5; port++) {
      if (port === parseInt(preferredPort)) continue; // 既にチェック済み
      try {
        const isViteRunning = await this.checkVitePort(port);
        if (isViteRunning) {
          console.log(`✅ [Main] Found Vite server on alternative port ${port}`);
          return port.toString();
        }
      } catch (error) {
        continue;
      }
    }

    // フォールバック: 設定されたポートを使用（エラーは後で処理）
    console.warn(`⚠️ [Main] Could not find running Vite server, will attempt connection to configured port ${preferredPort}`);
    return preferredPort;
  }

  private checkVitePort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const req = request({
        hostname: '127.0.0.1', // IPv4を強制使用
        port: port,
        path: '/',
        method: 'HEAD',
        timeout: 3000, // タイムアウトを少し長く
        family: 4 // IPv4を強制
      }, (res) => {
        // Viteサーバーの検出ロジックを改善
        const isViteServer = res.statusCode === 200 || res.statusCode === 304 ||
          (res.headers['server'] && res.headers['server'].includes('vite')) ||
          res.headers['x-powered-by'] === 'vite' ||
          (res.headers['accept-ranges'] === 'bytes'); // Viteの特徴
        console.log(`🔍 [Main] Port ${port} check - Status: ${res.statusCode}, Headers: ${JSON.stringify(res.headers)}`);
        resolve(isViteServer);
      });

      req.on('error', (err) => {
        console.log(`🔍 [Main] Port ${port} check - Connection error: ${err.message}`);
        resolve(false);
      });
      req.on('timeout', () => {
        console.log(`🔍 [Main] Port ${port} check - Timeout`);
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const { createServer } = require('net');
      const server = createServer();

      server.listen(port, () => {
        server.once('close', () => resolve(true));
        server.close();
      });

      server.on('error', () => resolve(false));
    });
  }

  private async loadApiKeyAndInitialize() {
    try {
      const apiKeyResult = await this.database.query('SELECT value FROM settings WHERE key = ?', ['geminiApiKey']);
      const openaiKeyResult = await this.database.query('SELECT value FROM settings WHERE key = ?', ['openaiApiKey']);
      const providerResult = await this.database.query('SELECT value FROM settings WHERE key = ?', ['imageProvider']);
      let apiKey: string | null = null;
      let openaiApiKey: string | null = null;

      if (apiKeyResult.length > 0 && apiKeyResult[0].value) {
        apiKey = apiKeyResult[0].value;
      } else {
        apiKey = process.env.GEMINI_API_KEY || null;

        if (apiKey) {
          await this.database.query(
            'INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updatedAt = ?',
            ['geminiApiKey', apiKey, new Date().toISOString(), apiKey, new Date().toISOString()]
          );
        }
      }

      if (openaiKeyResult.length > 0 && openaiKeyResult[0].value) {
        openaiApiKey = openaiKeyResult[0].value;
      } else {
        openaiApiKey = process.env.OPENAI_API_KEY || null;
        if (openaiApiKey) {
          await this.database.query(
            'INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updatedAt = ?',
            ['openaiApiKey', openaiApiKey, new Date().toISOString(), openaiApiKey, new Date().toISOString()]
          );
        }
      }

      if (apiKey) {
        await this.aiImageGenerator.initialize(apiKey);
        console.log('Gemini AI Image Generator initialized with secure API key');
      }

      if (openaiApiKey) {
        await this.aiImageGenerator.initializeOpenAI(openaiApiKey);
        console.log('OpenAI gpt-image-1 initialized with secure API key');
      }

      // プロバイダ設定を反映（デフォルトはgemini）
      if (providerResult.length > 0 && (providerResult[0].value === 'openai' || providerResult[0].value === 'gemini')) {
        this.aiImageGenerator.setProvider(providerResult[0].value);
      }

      if (!apiKey && !openaiApiKey) {
        console.warn('No AI API key found. AI image generation will be disabled.');
        console.info('Please set API key via Settings or GEMINI_API_KEY / OPENAI_API_KEY environment variables');
      }
    } catch (error) {
      console.error('Failed to load API key and initialize:', error);
    }
  }

  private async createMainWindow() {
    console.log('[Main] Creating main window...');

    const bounds = this.store.get('windowBounds') || { width: 1200, height: 800 };

    this.mainWindow = new BrowserWindow({
      ...bounds,
      minWidth: 800,
      minHeight: 600,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, '../preload/preload.js'),
        webSecurity: !this.isDev
      },
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: '#1f2937',
        symbolColor: '#ffffff'
      },
      title: 'Visual TODO App'
    });

    // メインウィンドウのズームを初期化・固定（誤って拡大状態が残るのを防止）
    try {
      this.mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
      this.mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && (input.control || input.meta)) {
          const key = (input.key || '').toLowerCase();
          if (key === '+' || key === '=' || key === '-' || key === '_' || key === 'add' || key === 'subtract' || key === '0') {
            event.preventDefault();
          }
        }
      });
    } catch { }

    if (this.isDev) {
      const port = await this.findVitePort();
      console.log(`[Main] Using Vite port: ${port}`);
      this.mainWindow.loadURL(`http://127.0.0.1:${port}`); // IPv4を強制使用
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(join(__dirname, '../../renderer/index.html'));
    }

    this.mainWindow.once('ready-to-show', () => {
      console.log('[Main] ready-to-show event fired, showing window');
      try { this.mainWindow?.webContents.setZoomFactor(1); } catch { }
      this.mainWindow?.show();
    });

    this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('[Main] Failed to load:', errorCode, errorDescription, validatedURL);
    });

    this.mainWindow.webContents.on('did-finish-load', () => {
      console.log('[Main] Page finished loading');
    });

    this.mainWindow.on('close', (event) => {
      event.preventDefault();
      this.mainWindow?.hide();
    });

    this.mainWindow.on('resize', () => {
      this.saveBounds();
    });

    this.mainWindow.on('move', () => {
      this.saveBounds();
    });
  }

  private broadcast(channel: string, ...args: any[]) {
    try {
      const allWindows = BrowserWindow.getAllWindows();
      for (const win of allWindows) {
        if (!win.isDestroyed()) {
          win.webContents.send(channel, ...args);
        }
      }
    } catch (e) {
      console.warn('Broadcast failed:', e);
    }
  }

  private createTray() {
    this.tray = createTray(this);
  }

  private async createWidget() {
    this.widget = await createWidget(this);
    // 開発時は必ず表示してデバッグ容易にする。プロダクションはユーザー設定を尊重
    const shouldShow = this.isDev || this.store.get('widgetVisible', true);
    if (shouldShow) {
      this.widget.show();
    }
    this.widget?.once('ready-to-show', () => {
      const stillShouldShow = this.isDev || this.store.get('widgetVisible', true);
      if (stillShouldShow) {
        this.widget?.show();
      }
    });
  }

  private saveBounds() {
    if (this.mainWindow) {
      this.store.set('windowBounds', this.mainWindow.getBounds());
    }
  }

  public showMainWindow() {
    if (this.mainWindow) {
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  public hideMainWindow() {
    if (this.mainWindow) {
      this.mainWindow.hide();
    }
  }

  public showWidget() {
    if (this.widget) {
      this.widget.show();
      this.store.set('widgetVisible', true);
    }
  }

  public hideWidget() {
    if (this.widget) {
      this.widget.hide();
      this.store.set('widgetVisible', false);
    }
  }

  public toggleWidget() {
    if (this.widget?.isVisible()) {
      this.hideWidget();
    } else {
      this.showWidget();
    }
  }

  public quit() {
    app.quit();
  }

  public getMainWindow() {
    return this.mainWindow;
  }

  public getWidget() {
    return this.widget;
  }

  public getDatabase() {
    return this.database;
  }

  public getNotifications() {
    return this.notifications;
  }
}

const visualTodoApp = new VisualTodoApp();

export default visualTodoApp;
