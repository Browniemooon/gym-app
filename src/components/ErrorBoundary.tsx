import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    (this as any).state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    const state = (this as any).state;
    const props = (this as any).props;

    if (state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-black text-white">
          <div className="max-w-md w-full glass p-8 rounded-3xl border border-red-500/20 text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-4 bg-red-500/10 rounded-full">
                <AlertTriangle className="w-12 h-12 text-red-500" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black uppercase italic tracking-tight">System Error</h2>
              <p className="text-zinc-400 text-sm">
                The application encountered an unexpected error.
              </p>
            </div>
            <div className="p-4 bg-black/50 rounded-xl border border-white/5 text-left overflow-auto max-h-32">
              <code className="text-xs text-red-400 font-mono">
                {state.error?.message}
              </code>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-all active:scale-95"
            >
              <RefreshCw className="w-4 h-4" /> Restart Application
            </button>
          </div>
        </div>
      );
    }

    return props.children;
  }
}
