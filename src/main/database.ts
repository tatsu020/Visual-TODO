import Database from 'better-sqlite3';
import { join } from 'path';
import { app } from 'electron';

export interface Task {
  id?: number;
  title: string;
  description?: string;
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
  location?: string;
  priority?: 'high' | 'medium' | 'low';
  scheduledTimeEnd?: string;
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

export class DatabaseManager {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor() {
    this.dbPath = join(app.getPath('userData'), 'database.sqlite');
  }

  async initialize(): Promise<void> {
    try {
      this.db = new Database(this.dbPath);
      console.log('Database initialized at:', this.dbPath);
      this.createTables();
    } catch (err) {
      console.error('Database initialization failed:', err);
      throw err;
    }
  }

  public async query(sql: string, params: any[] = []): Promise<any> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const trimmedSql = sql.trim().toUpperCase();
    
    if (trimmedSql.startsWith('SELECT')) {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params);
    } else {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      return { lastID: result.lastInsertRowid, changes: result.changes };
    }
  }

  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    const queries = [
      `CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        type TEXT NOT NULL DEFAULT 'immediate',
        scheduledTime TEXT,
        estimatedDuration INTEGER,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        completedAt TEXT,
        imageUrl TEXT,
        recurringPattern TEXT,
        dueDate TEXT,
        location TEXT,
        priority TEXT DEFAULT 'medium',
        scheduledTimeEnd TEXT
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
      `CREATE TABLE IF NOT EXISTS user_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT NOT NULL,
        referenceImagePath TEXT,
        artStyle TEXT NOT NULL,
        quality TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`
    ];

    for (const query of queries) {
      this.db.exec(query);
    }

    // Migrations
    this.runMigration('ALTER TABLE tasks ADD COLUMN location TEXT', 'added tasks.location column');
    this.runMigration("ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'medium'", 'added tasks.priority column');
    this.runMigration('ALTER TABLE tasks ADD COLUMN scheduledTimeEnd TEXT', 'added tasks.scheduledTimeEnd column');
  }

  private runMigration(sql: string, description: string): void {
    try {
      this.db?.exec(sql);
      console.log(`✅ Migrated: ${description}`);
    } catch (e) {
      // Column likely exists
    }
  }

  // --- Task Methods ---

  async createTaskFromInput(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'imageUrl'> & Partial<Pick<Task, 'status' | 'imageUrl'>>): Promise<Task> {
    const now = new Date().toISOString();
    const status = task.status || 'pending';
    const result = await this.query(
      `INSERT INTO tasks (
        title, description, status, type, scheduledTime, 
        estimatedDuration, createdAt, updatedAt, imageUrl, recurringPattern, dueDate,
        location, priority, scheduledTimeEnd
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.title,
        task.description || null,
        status,
        task.type,
        task.scheduledTime || null,
        task.estimatedDuration || null,
        now,
        now,
        task.imageUrl || null,
        task.recurringPattern || null,
        task.dueDate || null,
        task.location || null,
        task.priority || 'medium',
        task.scheduledTimeEnd || null
      ]
    );

    return { ...task, id: Number(result.lastID), status, imageUrl: task.imageUrl, createdAt: now, updatedAt: now };
  }

  async createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const now = new Date().toISOString();
    const result = await this.query(
      `INSERT INTO tasks (
        title, description, status, type, scheduledTime, 
        estimatedDuration, createdAt, updatedAt, imageUrl, recurringPattern, dueDate,
        location, priority, scheduledTimeEnd
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.title, task.description, task.status, task.type, task.scheduledTime,
        task.estimatedDuration, now, now, task.imageUrl, task.recurringPattern, task.dueDate,
        task.location, task.priority || 'medium', task.scheduledTimeEnd
      ]
    );

    return { ...task, id: Number(result.lastID), createdAt: now, updatedAt: now };
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

  async getTasksByStatus(status: string, orderByPriority = false): Promise<Task[]> {
    const order = orderByPriority
      ? " ORDER BY CASE priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC, createdAt ASC"
      : ' ORDER BY createdAt DESC';
    return await this.query(`SELECT * FROM tasks WHERE status = ?${order}`, [status]);
  }

  async getPreferredTasksForWidget(): Promise<Task[]> {
    const active = await this.getTasksByStatus('inProgress', true);
    if (active.length > 0) return active;
    return this.getTasksByStatus('pending', true);
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

    if (keys.length === 0) return;

    await this.query(
      `UPDATE tasks SET ${setClause} WHERE id = ?`,
      [...values, id]
    );
  }

  async deleteTask(id: number): Promise<void> {
    await this.query('DELETE FROM tasks WHERE id = ?', [id]);
  }

  // --- TaskStep Methods ---

  async createTaskStep(step: Omit<TaskStep, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const now = new Date().toISOString();
    const result = await this.query(
      `INSERT INTO task_steps (task_id, title, description, order_index, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [step.task_id, step.title, step.description, step.order_index, step.status, now, now]
    );
    return Number(result.lastID);
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

    for (let i = 0; i < stepIds.length; i++) {
      await this.query(
        `UPDATE task_steps SET order_index = ?, updated_at = ? WHERE id = ?`,
        [i, new Date().toISOString(), stepIds[i]]
      );
    }
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

  // --- UserProfile Methods ---

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

  // --- Settings Methods ---

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

  async getSettings(keys: string[]): Promise<Record<string, string | null>> {
    if (keys.length === 0) return {};
    const placeholders = keys.map(() => '?').join(', ');
    const rows = await this.query(`SELECT key, value FROM settings WHERE key IN (${placeholders})`, keys);
    const map: Record<string, string | null> = {};
    for (const key of keys) {
      const row = rows.find((r: any) => r.key === key);
      map[key] = row ? row.value : null;
    }
    return map;
  }

  async setSettings(entries: Record<string, string>): Promise<void> {
    const now = new Date().toISOString();
    for (const [key, value] of Object.entries(entries)) {
      await this.query(
        'INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (?, ?, ?)',
        [key, value, now]
      );
    }
  }

  // --- Stats & Performance ---

  private async logDatabaseStats(): Promise<void> {
    try {
      console.log('📊 データベース統計情報:');
      const tableStats = await Promise.all([
        this.query("SELECT COUNT(*) as count FROM tasks"),
        this.query("SELECT COUNT(*) as count FROM user_profiles"),
        this.query("SELECT COUNT(*) as count FROM settings")
      ]);

      console.log(`  - タスク数: ${tableStats[0][0].count}`);
      console.log(`  - ユーザープロファイル数: ${tableStats[1][0].count}`);
      console.log(`  - 設定数: ${tableStats[2][0].count}`);
    } catch (error) {
      console.warn('⚠️ データベース統計情報の取得に失敗:', error);
    }
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
