import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { clearStaleChunkReloadFlag } from '../../utils/chunkRecovery';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    clearStaleChunkReloadFlag();
    window.location.reload();
  };

  private handleGoHome = () => {
    clearStaleChunkReloadFlag();
    window.location.hash = '/dashboard';
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-[#F5F7F8] dark:bg-[#111B21] text-[#111B21] dark:text-[#E9EDEF]">
          <div className="max-w-lg w-full bg-white dark:bg-[#202C33] border border-red-300 dark:border-red-500/30 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-3 text-red-600 dark:text-red-400">
              <div className="p-3 rounded-xl bg-red-100 dark:bg-red-500/20 border border-red-500/30 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                  {this.props.fallbackTitle || 'Component Error Encountered'}
                </h2>
                <p className="text-xs text-red-600 dark:text-red-300">
                  {this.state.error?.message || 'An unexpected rendering error occurred.'}
                </p>
              </div>
            </div>

            {this.state.error?.stack && (
              <pre className="p-3 bg-[#F0F2F5] dark:bg-[#111B21] rounded-xl border border-[#E0E5E7] dark:border-[#222D34] text-[11px] font-mono text-[#667781] dark:text-[#8696A0] overflow-x-auto max-h-48 whitespace-pre-wrap">
                {this.state.error.stack}
              </pre>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={this.handleGoHome}
                className="px-3.5 py-1.5 rounded-lg border border-[#E0E5E7] dark:border-[#222D34] bg-[#F0F2F5] dark:bg-[#111B21] text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] hover:bg-[#E0E5E7] dark:hover:bg-[#2A3942] transition-colors flex items-center space-x-1.5"
              >
                <Home className="h-3.5 w-3.5" />
                <span>Dashboard</span>
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-1.5 rounded-lg bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] text-white dark:text-[#111B21] text-xs font-bold transition-colors shadow-sm flex items-center space-x-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Reload Application</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

