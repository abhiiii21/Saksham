import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Saksham ErrorBoundary caught an exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.state.error?.message || 'An unexpected rendering error occurred. The rest of the dashboard remains operational.';
      const errorStack = this.state.error?.stack || this.state.errorInfo?.componentStack;

      return (
        <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center p-6 bg-slate-900/90 text-slate-100 rounded-2xl border border-rose-500/30 backdrop-blur-md">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-100 font-sans tracking-tight mb-1">
            {this.props.title || 'Component Error Encountered'}
          </h3>
          <p className="text-xs tabular-nums text-rose-300 max-w-md text-center mb-4 bg-rose-950/40 px-3 py-1.5 rounded-lg border border-rose-800/40 font-sans">
            {errorMessage}
          </p>

          <div className="flex items-center space-x-3 mb-4">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center space-x-2 transition-all shadow-md cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Reload Component</span>
            </button>
          </div>

          {errorStack && (
            <details className="w-full max-w-lg mt-2 text-left">
              <summary className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer text-center select-none font-sans">
                Show Diagnostic Stack Trace
              </summary>
              <pre className="mt-2 p-3 text-[10px] tabular-nums font-sans bg-slate-950/90 text-slate-400 rounded-xl border border-slate-800 overflow-x-auto max-h-40 leading-relaxed">
                {errorStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
