// エラーカテゴリの定義
export enum ErrorCategory {
  VALIDATION = 'validation',
  DATABASE = 'database',
  NETWORK = 'network',
  AI_SERVICE = 'ai_service',
  FILE_SYSTEM = 'file_system',
  AUTHENTICATION = 'authentication',
  PERMISSION = 'permission',
  UNKNOWN = 'unknown'
}

// エラーの重要度レベル
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium', 
  HIGH = 'high',
  CRITICAL = 'critical'
}

// アプリケーションエラーの基底クラス
export class AppError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly userMessage: string;
  public readonly timestamp: Date;
  public readonly stack?: string;

  constructor(
    message: string,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    userMessage?: string
  ) {
    super(message);
    this.name = 'AppError';
    this.category = category;
    this.severity = severity;
    this.userMessage = userMessage || this.getDefaultUserMessage(category);
    this.timestamp = new Date();
    
    // スタックトレースをキャプチャ
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  private getDefaultUserMessage(category: ErrorCategory): string {
    const messages = {
      [ErrorCategory.VALIDATION]: '入力された情報に問題があります。確認して再度お試しください。',
      [ErrorCategory.DATABASE]: 'データの保存・読み込みでエラーが発生しました。',
      [ErrorCategory.NETWORK]: 'ネットワーク接続に問題があります。インターネット接続を確認してください。',
      [ErrorCategory.AI_SERVICE]: 'AI画像生成サービスでエラーが発生しました。しばらく時間をおいて再度お試しください。',
      [ErrorCategory.FILE_SYSTEM]: 'ファイル操作でエラーが発生しました。',
      [ErrorCategory.AUTHENTICATION]: '認証エラーが発生しました。APIキーを確認してください。',
      [ErrorCategory.PERMISSION]: '権限が不足しています。',
      [ErrorCategory.UNKNOWN]: '予期しないエラーが発生しました。'
    };
    return messages[category];
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      severity: this.severity,
      userMessage: this.userMessage,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack
    };
  }
}

// 特定エラータイプのクラス
export class ValidationError extends AppError {
  constructor(message: string, userMessage?: string) {
    super(message, ErrorCategory.VALIDATION, ErrorSeverity.LOW, userMessage);
    this.name = 'ValidationError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, userMessage?: string) {
    super(message, ErrorCategory.DATABASE, ErrorSeverity.HIGH, userMessage);
    this.name = 'DatabaseError';
  }
}

export class NetworkError extends AppError {
  constructor(message: string, userMessage?: string) {
    super(message, ErrorCategory.NETWORK, ErrorSeverity.MEDIUM, userMessage);
    this.name = 'NetworkError';
  }
}

export class AIServiceError extends AppError {
  constructor(message: string, userMessage?: string) {
    super(message, ErrorCategory.AI_SERVICE, ErrorSeverity.MEDIUM, userMessage);
    this.name = 'AIServiceError';
  }
}

// エラーハンドラーインターフェース
interface ErrorHandler {
  handleError(error: Error | AppError): void;
}

// ログエラーハンドラー
class LogErrorHandler implements ErrorHandler {
  handleError(error: Error | AppError): void {
    const errorInfo = error instanceof AppError ? error.toJSON() : {
      name: error.name,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
    
    console.error('ErrorHandler:', errorInfo);
    
    // 重要度が高いエラーの場合、追加のログ出力
    if (error instanceof AppError && error.severity === ErrorSeverity.CRITICAL) {
      console.error('CRITICAL ERROR DETECTED:', errorInfo);
    }
  }
}

// 通知エラーハンドラー
class NotificationErrorHandler implements ErrorHandler {
  private readonly maxNotifications = 5;
  private notificationCount = 0;
  private lastResetTime = Date.now();

  handleError(error: Error | AppError): void {
    // レート制限（1分間に最大5個の通知）
    const now = Date.now();
    if (now - this.lastResetTime > 60000) {
      this.notificationCount = 0;
      this.lastResetTime = now;
    }

    if (this.notificationCount >= this.maxNotifications) {
      return;
    }

    this.notificationCount++;

    const userMessage = error instanceof AppError 
      ? error.userMessage 
      : 'エラーが発生しました。';

    // トースト通知を表示（実装は別途必要）
    this.showToast(userMessage, error instanceof AppError ? error.severity : ErrorSeverity.MEDIUM);
  }

  private showToast(message: string, severity: ErrorSeverity): void {
    // ここでトースト通知を表示
    // 実際の実装では、react-hot-toastなどのライブラリを使用
    console.log(`Toast [${severity}]: ${message}`);
  }
}

// メインエラーハンドラー
class GlobalErrorHandler {
  private handlers: ErrorHandler[] = [];

  constructor() {
    this.handlers.push(new LogErrorHandler());
    this.handlers.push(new NotificationErrorHandler());
    
    // グローバルエラーハンドラーを設定
    this.setupGlobalHandlers();
  }

  addHandler(handler: ErrorHandler): void {
    this.handlers.push(handler);
  }

  handleError(error: Error | AppError): void {
    this.handlers.forEach(handler => {
      try {
        handler.handleError(error);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    });
  }

  private setupGlobalHandlers(): void {
    // 未処理のPromise拒否をキャッチ
    window.addEventListener('unhandledrejection', (event) => {
      const error = new AppError(
        `Unhandled promise rejection: ${event.reason}`,
        ErrorCategory.UNKNOWN,
        ErrorSeverity.HIGH
      );
      this.handleError(error);
      event.preventDefault();
    });

    // 未処理のJavaScriptエラーをキャッチ
    window.addEventListener('error', (event) => {
      const error = new AppError(
        `Unhandled error: ${event.message}`,
        ErrorCategory.UNKNOWN,
        ErrorSeverity.HIGH
      );
      this.handleError(error);
    });
  }
}

// グローバルエラーハンドラーのインスタンス
export const globalErrorHandler = new GlobalErrorHandler();

// ユーティリティ関数
export const handleAsyncError = async <T>(
  asyncOperation: () => Promise<T>,
  errorCategory: ErrorCategory = ErrorCategory.UNKNOWN
): Promise<T | null> => {
  try {
    return await asyncOperation();
  } catch (error) {
    const appError = error instanceof AppError 
      ? error 
      : new AppError(
          error instanceof Error ? error.message : String(error),
          errorCategory
        );
    
    globalErrorHandler.handleError(appError);
    return null;
  }
};

// エラー作成のヘルパー関数
export const createError = {
  validation: (message: string, userMessage?: string) => 
    new ValidationError(message, userMessage),
  
  database: (message: string, userMessage?: string) => 
    new DatabaseError(message, userMessage),
  
  network: (message: string, userMessage?: string) => 
    new NetworkError(message, userMessage),
  
  aiService: (message: string, userMessage?: string) => 
    new AIServiceError(message, userMessage),
  
  unknown: (message: string, userMessage?: string) => 
    new AppError(message, ErrorCategory.UNKNOWN, ErrorSeverity.MEDIUM, userMessage)
};

// エラーログの集約と送信（将来的な機能）
export const reportError = async (error: AppError): Promise<void> => {
  // ここで外部サービスにエラーレポートを送信する
  // 現在は開発中なので何もしない
  console.log('Error reported:', error.toJSON());
};