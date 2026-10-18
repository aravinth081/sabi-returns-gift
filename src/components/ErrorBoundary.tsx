import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, Copy, Check } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = "/dashboard";
  };

  private handleCopyError = async () => {
    const errorDetails = `Error: ${this.state.error?.message || "Unknown error"}\n\nStack:\n${this.state.error?.stack || "No stack trace"}\n\nComponent Stack:\n${this.state.errorInfo?.componentStack || "No component stack"}`;
    try {
      await navigator.clipboard.writeText(errorDetails);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // ignore
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#0b1329] text-white">
          <div className="w-full max-w-xl bg-[#0d1527] border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center backdrop-blur-xl animate-in fade-in duration-300">
            {/* Pulsing warning icon container */}
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-5 shadow-lg shadow-amber-500/10">
              <AlertTriangle size={32} className="animate-pulse" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wide mb-2">
              {this.props.fallbackTitle || "Something went wrong"}
            </h1>
            <p className="text-slate-300 text-sm mb-6 max-w-md">
              An unexpected error occurred while rendering this view. Your inventory, orders, and database records remain safe.
            </p>

            {/* Error Message Box */}
            {this.state.error && (
              <div className="w-full bg-[#131c2e] border border-white/10 rounded-2xl p-4 text-left mb-6 font-mono text-xs text-rose-300 overflow-x-auto max-h-40 custom-scrollbar">
                <span className="font-bold text-rose-400 block mb-1">
                  {this.state.error.name}: {this.state.error.message}
                </span>
                {this.state.error.stack && (
                  <pre className="text-[10px] text-slate-400 whitespace-pre-wrap">
                    {this.state.error.stack.split("\n").slice(0, 4).join("\n")}
                  </pre>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-center gap-3 w-full">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all"
              >
                <RefreshCw size={14} />
                <span>Reload Page</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="px-5 py-2.5 bg-[#15213b] hover:bg-[#1d2b4d] border border-white/20 text-white font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer transition-colors active:scale-95"
              >
                <Home size={14} />
                <span>Return to Dashboard</span>
              </button>

              <button
                type="button"
                onClick={this.handleCopyError}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Copy error details for support"
              >
                {this.state.copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{this.state.copied ? "Copied" : "Copy Details"}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
