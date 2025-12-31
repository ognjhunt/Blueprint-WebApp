import React, { Component, ErrorInfo, ReactNode } from 'react';
import { errorTracking, addBreadcrumb } from '@/lib/errorTracking';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  eventId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    eventId: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Generate a unique event ID for reference
    const eventId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.setState({ errorInfo, eventId });

    // Report to error tracking service
    errorTracking.captureException(error, {
      componentStack: errorInfo.componentStack || undefined,
      tags: {
        errorBoundary: 'true',
        eventId,
      },
      level: 'fatal',
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error);
      console.error('Component stack:', errorInfo.componentStack);
    }
  }

  private handleRetry = () => {
    addBreadcrumb({
      category: 'ui',
      message: 'User clicked retry after error',
      data: { eventId: this.state.eventId },
    });
    this.setState({ hasError: false, error: null, errorInfo: null, eventId: null });
  };

  private handleGoHome = () => {
    addBreadcrumb({
      category: 'navigation',
      message: 'User navigated home after error',
      data: { eventId: this.state.eventId },
    });
    window.location.href = '/';
  };

  private handleReportBug = () => {
    const { error, eventId } = this.state;
    const subject = encodeURIComponent(`Bug Report: ${error?.message || 'Application Error'}`);
    const body = encodeURIComponent(
      `Error ID: ${eventId}\n` +
      `Error: ${error?.message}\n` +
      `URL: ${window.location.href}\n` +
      `Time: ${new Date().toISOString()}\n\n` +
      `Please describe what you were doing when this error occurred:\n\n`
    );
    window.location.href = `mailto:support@tryblueprint.io?subject=${subject}&body=${body}`;
  };

  public render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-red-50 to-orange-50 px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Something went wrong
                    </h2>
                    <p className="text-sm text-slate-600">
                      We've been notified and are working on a fix
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-4 space-y-4">
                {/* Error message */}
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-sm font-mono text-slate-700 break-words">
                    {this.state.error?.message || 'An unexpected error occurred'}
                  </p>
                </div>

                {/* Event ID for support */}
                {this.state.eventId && (
                  <p className="text-xs text-slate-500">
                    Reference ID:{' '}
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                      {this.state.eventId}
                    </code>
                  </p>
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    onClick={this.handleRetry}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-500 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                  </button>
                  <button
                    onClick={this.handleGoHome}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    <Home className="w-4 h-4" />
                    Go Home
                  </button>
                </div>

                {/* Report bug link */}
                <button
                  onClick={this.handleReportBug}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <Bug className="w-4 h-4" />
                  Report this issue
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
