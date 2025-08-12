import { Database } from 'sqlite3';
import { join } from 'path';
import { app } from 'electron';
import { DatabaseSecurity } from './database-security';

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

export interface Category {
  id?: number;
  name: string;
  label: string;
  color: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export class DatabaseManager {
  private db: Database | null = null;
  private dbPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.dbPath = join(userDataPath, 'visual-todo.db');
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        this.createTables().then(() => {
          console.log('Database initialized successfully');
          resolve();
        }).catch(reject);
      });
    });
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const queries = [
      `CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL DEFAULT 'general',
        status TEXT NOT NULL DEFAULT 'pending',
        type TEXT NOT NULL DEFAULT 'immediate',
        scheduledTime TEXT,
        estimatedDuration INTEGER,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        completedAt TEXT,
        imageUrl TEXT,
        recurringPattern TEXT,
        dueDate TEXT
      )`,
      
      `CREATE TABLE IF NOT EXISTS user_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT NOT NULL,
        referenceImagePath TEXT,
        artStyle TEXT NOT NULL DEFAULT 'anime',
        quality TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,
      
      `CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,
      
      `CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        label TEXT NOT NULL,
        color TEXT NOT NULL,
        isDefault INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,
      
      `CREATE TABLE IF NOT EXISTS task_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        order_index INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )`,
      
      // パフォーマンス最適化インデックス
      `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_scheduled ON tasks(scheduledTime)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(createdAt DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_status_created ON tasks(status, createdAt DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_category_status ON tasks(category, status)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_type_status ON tasks(type, status)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(dueDate)`,
      `CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key)`,
      `CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name)`,
      `CREATE INDEX IF NOT EXISTS idx_categories_is_default ON categories(isDefault, label)`,
      `CREATE INDEX IF NOT EXISTS idx_task_steps_task_id ON task_steps(task_id)`,
      `CREATE INDEX IF NOT EXISTS idx_task_steps_order ON task_steps(task_id, order_index)`,
      `CREATE INDEX IF NOT EXISTS idx_task_steps_status ON task_steps(status)`
    ];

    for (const query of queries) {
      await this.query(query);
    }

    // user_profilesにquality列が無い場合は追加（マイグレーション）
    try {
      const userProfileTable: any[] = await this.query(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'user_profiles'"
      );
      const createSql: string = userProfileTable?.[0]?.sql || '';
      if (createSql && !/\bquality\b/i.test(createSql)) {
        await this.query('ALTER TABLE user_profiles ADD COLUMN quality TEXT');
        console.log('✅ Migrated: added user_profiles.quality column');
      }
    } catch (e) {
      console.warn('⚠️ Failed to ensure user_profiles.quality column:', e);
    }
    
    // デフォルトカテゴリを初期化
    await this.initializeDefaultCategories();
    
    // データベース統計情報をログ出力
    await this.logDatabaseStats();
  }

  async query(sql: string, params: any[] = []): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // セキュアなクエリ実行
      return await DatabaseSecurity.executeSecure(this.db, sql, params);
    } catch (error) {
      console.error('Database security check failed:', error);
      throw new Error('Database operation failed: Invalid query or parameters');
    }
  }

  async createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = new Date().toISOString();
    const result = await this.query(
      `INSERT INTO tasks (title, description, category, status, type, scheduledTime, estimatedDuration, createdAt, updatedAt, imageUrl, recurringPattern, dueDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.title,
        task.description || null,
        task.category,
        task.status,
        task.type,
        task.scheduledTime || null,
        task.estimatedDuration || null,
        now,
        now,
        task.imageUrl || null,
        task.recurringPattern || null,
        task.dueDate || null
      ]
    );
    return result.lastID;
  }

  async getTasks(status?: string): Promise<Task[]> {
    let query = 'SELECT * FROM tasks';
    let params: any[] = [];
    
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY createdAt DESC';
    
    return await this.query(query, params);
  }

  async updateTask(id: number, updates: Partial<Task>): Promise<void> {
    const now = new Date().toISOString();
    updates.updatedAt = now;
    
    if (updates.status === 'completed' && !updates.completedAt) {
      updates.completedAt = now;
    }

    const keys = Object.keys(updates).filter(key => key !== 'id');
    const values = keys.map(key => (updates as any)[key]);
    const setClause = keys.map(key => `${key} = ?`).join(', ');

    await this.query(
      `UPDATE tasks SET ${setClause} WHERE id = ?`,
      [...values, id]
    );
  }

  // TaskStep関連メソッド
  async createTaskStep(step: Omit<TaskStep, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const now = new Date().toISOString();
    const result = await this.query(
      `INSERT INTO task_steps (task_id, title, description, order_index, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [step.task_id, step.title, step.description, step.order_index, step.status, now, now]
    );
    return result.lastInsertRowid as number;
  }

  async getTaskSteps(taskId: number): Promise<TaskStep[]> {
    return await this.query(
      `SELECT * FROM task_steps WHERE task_id = ? ORDER BY order_index ASC`,
      [taskId]
    );
  }

  async updateTaskStep(id: number, updates: Partial<TaskStep>): Promise<void> {
    const now = new Date().toISOString();
    const { id: _, task_id, created_at, ...validUpdates } = updates;
    
    const fields = Object.keys(validUpdates);
    const values = Object.values(validUpdates);
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    
    if (fields.length === 0) return;
    
    values.push(now, id);
    await this.query(
      `UPDATE task_steps SET ${setClause}, updated_at = ? WHERE id = ?`,
      values
    );
  }

  async deleteTaskStep(id: number): Promise<void> {
    await this.query(`DELETE FROM task_steps WHERE id = ?`, [id]);
  }

  async reorderTaskSteps(stepIds: number[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    stepIds.forEach((stepId, index) => {
      const stmt = this.db!.prepare(`UPDATE task_steps SET order_index = ?, updated_at = ? WHERE id = ?`);
      stmt.run(index, new Date().toISOString(), stepId);
    });
  }

  async getTaskWithSteps(taskId: number): Promise<TaskWithSteps | null> {
    const task = await this.query(`SELECT * FROM tasks WHERE id = ?`, [taskId]);
    if (!task || task.length === 0) return null;
    
    const steps = await this.getTaskSteps(taskId);
    const completedSteps = steps.filter(step => step.status === 'completed').length;
    const totalSteps = steps.length;
    const stepProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
    
    return {
      ...task[0],
      steps,
      completedSteps,
      totalSteps,
      stepProgress
    };
  }

  async deleteTask(id: number): Promise<void> {
    await this.query('DELETE FROM tasks WHERE id = ?', [id]);
  }

  async createOrUpdateUserProfile(profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = new Date().toISOString();
    const existing = await this.query('SELECT id FROM user_profiles LIMIT 1');
    
    if (existing.length > 0) {
      await this.query(
        'UPDATE user_profiles SET description = ?, referenceImagePath = ?, artStyle = ?, quality = ?, updatedAt = ? WHERE id = ?',
        [profile.description, profile.referenceImagePath || null, profile.artStyle, (profile as any).quality || null, now, existing[0].id]
      );
    } else {
      await this.query(
        'INSERT INTO user_profiles (description, referenceImagePath, artStyle, quality, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [profile.description, profile.referenceImagePath || null, profile.artStyle, (profile as any).quality || null, now, now]
      );
    }
  }

  async getUserProfile(): Promise<UserProfile | null> {
    const results = await this.query('SELECT * FROM user_profiles LIMIT 1');
    return results.length > 0 ? results[0] : null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const now = new Date().toISOString();
    await this.query(
      'INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (?, ?, ?)',
      [key, value, now]
    );
  }

  async getSetting(key: string): Promise<string | null> {
    const results = await this.query('SELECT value FROM settings WHERE key = ?', [key]);
    return results.length > 0 ? results[0].value : null;
  }

  private async initializeDefaultCategories(): Promise<void> {
    // 既存のカテゴリ数をチェック
    const existingCategories = await this.query('SELECT COUNT(*) as count FROM categories');
    if (existingCategories[0].count > 0) {
      return; // 既にカテゴリが存在する場合はスキップ
    }

    const defaultCategories = [
      { name: 'work', label: '仕事', color: '#2196f3' },
      { name: 'health', label: '健康', color: '#4caf50' },
      { name: 'study', label: '勉強', color: '#9c27b0' },
      { name: 'hobby', label: '趣味', color: '#e91e63' },
      { name: 'household', label: '家事', color: '#ff9800' },
      { name: 'social', label: '社交', color: '#00bcd4' },
      { name: 'finance', label: '金融', color: '#ffc107' },
      { name: 'general', label: '一般', color: '#fdd835' }
    ];

    const now = new Date().toISOString();
    for (const category of defaultCategories) {
      await this.query(
        'INSERT INTO categories (name, label, color, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, 0, ?, ?)',
        [category.name, category.label, category.color, now, now]
      );
    }
  }

  async getCategories(): Promise<Category[]> {
    return await this.query('SELECT * FROM categories ORDER BY isDefault DESC, label ASC');
  }

  async createCategory(name: string, label: string, color: string): Promise<number> {
    const now = new Date().toISOString();
    const result = await this.query(
      'INSERT INTO categories (name, label, color, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, 0, ?, ?)',
      [name, label, color, now, now]
    );
    return result.lastID;
  }

  async updateCategory(id: number, updates: Partial<Pick<Category, 'name' | 'label' | 'color'>>): Promise<void> {
    const now = new Date().toISOString();
    const keys = Object.keys(updates);
    const values = keys.map(key => (updates as any)[key]);
    const setClause = keys.map(key => `${key} = ?`).join(', ');

    await this.query(
      `UPDATE categories SET ${setClause}, updatedAt = ? WHERE id = ?`,
      [...values, now, id]
    );
  }

  async deleteCategory(id: number): Promise<void> {
    // カテゴリ数をチェック - 最後の1つは削除不可
    const categoryCount = await this.query('SELECT COUNT(*) as count FROM categories');
    if (categoryCount[0].count <= 1) {
      throw new Error('最後のカテゴリは削除できません');
    }

    // 削除予定のカテゴリ名を取得
    const categoryToDelete = await this.query('SELECT name FROM categories WHERE id = ?', [id]);
    if (categoryToDelete.length === 0) {
      throw new Error('カテゴリが見つかりません');
    }

    // そのカテゴリを使用しているタスクを他のカテゴリ（最初に見つかったもの）に移動
    const remainingCategories = await this.query('SELECT name FROM categories WHERE id != ? LIMIT 1', [id]);
    if (remainingCategories.length > 0) {
      await this.query(
        'UPDATE tasks SET category = ? WHERE category = ?',
        [remainingCategories[0].name, categoryToDelete[0].name]
      );
    }

    // カテゴリを削除
    await this.query('DELETE FROM categories WHERE id = ?', [id]);
  }

  // データベース統計情報とパフォーマンス分析
  private async logDatabaseStats(): Promise<void> {
    try {
      console.log('📊 データベース統計情報:');
      
      // テーブル統計
      const tableStats = await Promise.all([
        this.query("SELECT COUNT(*) as count FROM tasks"),
        this.query("SELECT COUNT(*) as count FROM categories"),
        this.query("SELECT COUNT(*) as count FROM user_profiles"),
        this.query("SELECT COUNT(*) as count FROM settings")
      ]);
      
      console.log(`  - タスク数: ${tableStats[0][0].count}`);
      console.log(`  - カテゴリ数: ${tableStats[1][0].count}`);
      console.log(`  - ユーザープロファイル数: ${tableStats[2][0].count}`);
      console.log(`  - 設定数: ${tableStats[3][0].count}`);
      
      // インデックス統計
      const indexInfo = await this.query("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'");
      console.log(`  - インデックス数: ${indexInfo.length}`);
      
      // よく使用されるクエリのパフォーマンステスト
      if (tableStats[0][0].count > 0) {
        console.log('⚡ クエリパフォーマンステスト:');
        
        const startTime = Date.now();
        await this.query("SELECT * FROM tasks WHERE status = 'pending' ORDER BY createdAt DESC LIMIT 10");
        const queryTime1 = Date.now() - startTime;
        console.log(`  - ステータス別クエリ: ${queryTime1}ms`);
        
        const startTime2 = Date.now();
        await this.query("SELECT * FROM tasks WHERE category = 'work' AND status = 'inProgress'");
        const queryTime2 = Date.now() - startTime2;
        console.log(`  - カテゴリ・ステータス複合クエリ: ${queryTime2}ms`);
      }
      
    } catch (error) {
      console.warn('⚠️ データベース統計情報の取得に失敗:', error);
    }
  }

  // パフォーマンス分析機能
  public async analyzePerformance(): Promise<{
    tableStats: Record<string, number>;
    indexCount: number;
    queryPerformance: Record<string, number>;
  }> {
    try {
      // テーブル統計
      const [tasks, categories, profiles, settings] = await Promise.all([
        this.query("SELECT COUNT(*) as count FROM tasks"),
        this.query("SELECT COUNT(*) as count FROM categories"),
        this.query("SELECT COUNT(*) as count FROM user_profiles"),
        this.query("SELECT COUNT(*) as count FROM settings")
      ]);
      
      // インデックス数
      const indexInfo = await this.query("SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'");
      
      // クエリパフォーマンステスト
      const queryPerformance: Record<string, number> = {};
      
      if (tasks[0].count > 0) {
        // ステータス別クエリ
        let start = Date.now();
        await this.query("SELECT * FROM tasks WHERE status = 'pending' ORDER BY createdAt DESC LIMIT 10");
        queryPerformance.statusQuery = Date.now() - start;
        
        // 複合インデックスクエリ
        start = Date.now();
        await this.query("SELECT * FROM tasks WHERE category = 'work' AND status = 'inProgress'");
        queryPerformance.compositeQuery = Date.now() - start;
        
        // 全件取得クエリ
        start = Date.now();
        await this.query("SELECT * FROM tasks ORDER BY createdAt DESC");
        queryPerformance.fullScanQuery = Date.now() - start;
      }
      
      return {
        tableStats: {
          tasks: tasks[0].count,
          categories: categories[0].count,
          profiles: profiles[0].count,
          settings: settings[0].count
        },
        indexCount: indexInfo[0].count,
        queryPerformance
      };
      
    } catch (error) {
      console.error('パフォーマンス分析エラー:', error);
      throw error;
    }
  }

  // 最適化されたタスク取得メソッド
  public async getTasksOptimized(options: {
    status?: string;
    category?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'createdAt' | 'updatedAt' | 'title';
    sortOrder?: 'ASC' | 'DESC';
  } = {}): Promise<Task[]> {
    const {
      status,
      category,
      limit = 100,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = options;
    
    let query = 'SELECT * FROM tasks';
    const params: any[] = [];
    const conditions: string[] = [];
    
    // WHERE句の構築
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    // ORDER BY句とLIMIT句
    query += ` ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const startTime = Date.now();
    const result = await this.query(query, params);
    const queryTime = Date.now() - startTime;
    
    if (queryTime > 100) {
      console.warn(`⚠️ 遅いクエリを検出: ${queryTime}ms - ${query}`);
    }
    
    return result;
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}