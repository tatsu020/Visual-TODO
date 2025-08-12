import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Bug, Copy } from 'lucide-react';
import { AppError, ErrorCategory, ErrorSeverity, globalErrorHandler } from '../utils/error-handler';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  level?: 'page' | 'component' | 'section';
}

interface State {
  hasError: boolean;
  error?: Error;
  errorId?: string;
  retryCount: number;
}

class ErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      retryCount: 0 
    };
  }

  static getDerivedStateFromError(error: Error): State {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return { 
      hasError: true, 
      error,
      errorId,
      retryCount: 0
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { onError, level = 'component' } = this.props;
    
    // カスタムエラーハンドラーがあれば実行
    if (onError) {
      onError(error, errorInfo);
    }

    // AppErrorでない場合は変換
    const appError = error instanceof AppError 
      ? error 
      : new AppError(
          error.message,
          ErrorCategory.UNKNOWN,
          level === 'page' ? ErrorSeverity.CRITICAL : ErrorSeverity.HIGH,
          'コンポーネントでエラーが発生しました'
        );

    // グローバルエラーハンドラーに通知
    globalErrorHandler.handleError(appError);

    // エラー詳細を追加ログ出力
    console.error('ErrorBoundary Details:', {
      error: appError.toJSON(),
      errorInfo,
      componentStack: errorInfo.componentStack,
      level,
      errorId: this.state.errorId
    });
  }

  private handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: undefined,
        errorId: undefined,
        retryCount: prevState.retryCount + 1
      }));
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private copyErrorDetails = () => {
    const errorDetails = {
      errorId: this.state.errorId,
      message: this.state.error?.message,
      stack: this.state.error?.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2))
      .then(() => console.log('Error details copied to clipboard'))
      .catch(err => console.error('Failed to copy error details:', err));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { level = 'component' } = this.props;
      const canRetry = this.state.retryCount < this.maxRetries;
      const isComponentLevel = level === 'component' || level === 'section';

      return (
        <div className={`flex-1 flex items-center justify-center p-8 ${
          level === 'page' ? 'bg-red-50 min-h-screen' : 'bg-red-25 rounded-lg border border-red-200'
        }`}>
          <div className="text-center max-w-md">
            <AlertTriangle className={`${
              level === 'page' ? 'w-16 h-16' : 'w-12 h-12'
            } text-red-500 mx-auto mb-4`} />
            
            <h2 className={`${
              level === 'page' ? 'text-xl' : 'text-lg'
            } font-bold text-red-800 mb-2`}>
              {level === 'page' ? 'アプリケーションエラー' : 'エラーが発生しました'}
            </h2>
            
            <p className="text-red-600 mb-4">
              {level === 'page' 
                ? 'アプリケーションで重大な問題が発生しました。'
                : 'この機能の一部で問題が発生しました。'
              }
            </p>

            {this.state.error?.message && (
              <div className="bg-red-100 border border-red-300 rounded p-3 mb-4 text-left">
                <p className="text-sm text-red-700 font-mono">
                  {this.state.error.message}
                </p>
              </div>
            )}

            {this.state.errorId && (
              <p className="text-xs text-red-400 mb-4">
                エラーID: {this.state.errorId}
              </p>
            )}

            <div className="flex flex-col space-y-2">
              {canRetry && isComponentLevel && (
                <button
                  onClick={this.handleRetry}
                  className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>再試行 ({this.maxRetries - this.state.retryCount}回まで)</span>
                </button>
              )}

              <button
                onClick={this.handleReload}
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>ページを再読み込み</span>
              </button>

              <button
                onClick={this.copyErrorDetails}
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
              >
                <Copy className="w-4 h-4" />
                <span>エラー詳細をコピー</span>
              </button>
            </div>

            {level === 'page' && (
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
                <div className="flex items-center space-x-2 text-yellow-800">
                  <Bug className="w-4 h-4" />
                  <span className="text-sm font-medium">開発者向け情報</span>
                </div>
                <p className="text-xs text-yellow-700 mt-1">
                  エラーの詳細はコンソールログで確認できます。<br />
                  問題が継続する場合は、サポートまでご連絡ください。
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;