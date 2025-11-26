import Database from 'better-sqlite3';

// SQLクエリのサニタイゼーションと検証
export class DatabaseSecurity {
  private static readonly DANGEROUS_PATTERNS = [
    /;\s*(drop|delete|truncate|alter|create|insert|update)\s+/i,
    /union\s+select/i,
    /--/,
    /\/\*/,
    /\*\//,
    /exec\s*\(/i,
    /execute\s*\(/i,
    /sp_/i,
    /xp_/i
  ];

  private static readonly ALLOWED_TABLES = [
    'tasks',
    'user_profiles', 
    'settings',
    'categories',
    'task_steps',
    'sqlite_master'  // データベースメタデータ取得用
  ];

  /**
   * SQLクエリの安全性を検証
   */
  static validateQuery(query: string): void {
    const normalizedQuery = query.toLowerCase().trim();
    
    // 危険なパターンのチェック
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(normalizedQuery)) {
        throw new Error('Potentially dangerous SQL query detected');
      }
    }

    // テーブル名の検証（SELECT、INSERT、UPDATE、DELETE文の場合）
    const tableMatch = normalizedQuery.match(/(?:from|into|update|join)\s+(\w+)/);
    if (tableMatch) {
      const tableName = tableMatch[1];
      if (!this.ALLOWED_TABLES.includes(tableName)) {
        throw new Error(`Access to table '${tableName}' is not allowed`);
      }
    }
  }

  /**
   * パラメータのサニタイゼーション
   */
  static sanitizeParams(params?: any[]): any[] {
    if (!params) return [];
    
    return params.map(param => {
      if (typeof param === 'string') {
        // base64画像データURLの場合は制限を緩和
        if (param.startsWith('data:image/')) {
          return param.replace(/\0/g, ''); // NULL文字のみ除去、サイズ制限なし
        }
        
        // 通常の文字列パラメータのサニタイゼーション
        return param
          .replace(/\0/g, '') // NULL文字除去
          .slice(0, 10000);   // 長すぎる文字列の切り詰め
      }
      
      if (typeof param === 'number') {
        // 数値の検証
        if (!isFinite(param)) {
          throw new Error('Invalid number parameter');
        }
        return param;
      }
      
      if (param === null || param === undefined) {
        return null;
      }
      
      if (typeof param === 'boolean') {
        return param;
      }
      
      // その他の型は文字列化
      return String(param).slice(0, 1000);
    });
  }

  /**
   * クエリ実行回数の制限（レート制限）
   */
  private static queryCount = 0;
  private static lastReset = Date.now();
  private static readonly MAX_QUERIES_PER_MINUTE = 1000;

  static checkRateLimit(): void {
    const now = Date.now();
    
    // 1分ごとにカウンタをリセット
    if (now - this.lastReset > 60000) {
      this.queryCount = 0;
      this.lastReset = now;
    }
    
    this.queryCount++;
    
    if (this.queryCount > this.MAX_QUERIES_PER_MINUTE) {
      throw new Error('Query rate limit exceeded');
    }
  }

  /**
   * セキュアなクエリ実行ラッパー
   */
  static executeSecure(
    db: Database.Database, 
    query: string, 
    params?: any[]
  ): any {
    // レート制限チェック
    this.checkRateLimit();
    
    // クエリ検証
    this.validateQuery(query);
    
    // パラメータサニタイゼーション
    const sanitizedParams = this.sanitizeParams(params);
    
    // クエリ実行
    const trimmedQuery = query.trim().toLowerCase();
    if (trimmedQuery.startsWith('select')) {
      const stmt = db.prepare(query);
      return stmt.all(...sanitizedParams);
    } else {
      const stmt = db.prepare(query);
      const result = stmt.run(...sanitizedParams);
      return { 
        lastID: result.lastInsertRowid, 
        changes: result.changes 
      };
    }
  }
}