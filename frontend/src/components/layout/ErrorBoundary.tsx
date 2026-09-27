import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surfaced to the browser console so it's actually diagnosable instead
    // of the page just doing nothing.
    console.error("Transpiler crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-10 bg-background text-foreground">
          <div className="max-w-lg glass-panel p-6">
            <h1 className="text-lg font-semibold mb-2 text-red-400">Something broke in the UI</h1>
            <p className="text-sm text-muted mb-3">
              Open your browser's DevTools console (F12) for the full error - the message below is
              the short version.
            </p>
            <pre className="text-xs font-mono bg-black/40 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
            <button
              className="mt-4 text-sm text-accent-indigo hover:underline"
              onClick={() => this.setState({ error: null })}
            >
              Try to recover
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
