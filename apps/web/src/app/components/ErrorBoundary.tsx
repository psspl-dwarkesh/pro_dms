import { Component, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

type ErrorBoundaryProps = {
  children: ReactNode;
  // Rendered in place of the crashed subtree. Receives a reset() to retry without a full page reload.
  fallback: (reset: () => void) => ReactNode;
  // Called once per catch, e.g. to log to a monitoring service.
  onError?: (error: unknown, info: { componentStack: string }) => void;
};

type ErrorBoundaryState = { hasError: boolean };

// Class component is required here: React only invokes getDerivedStateFromError/componentDidCatch
// on class components, so a render crash anywhere below this boundary is caught instead of
// unmounting the whole app to a blank white screen.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack: string }) {
    this.props.onError?.(error, info);
    if (import.meta.env.DEV) console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) return this.props.fallback(this.reset);
    return this.props.children;
  }
}

export function CrashFallback({ title, detail, onRetry }: { title: string; detail: string; onRetry: () => void }) {
  return (
    <div className="crash-fallback" role="alert">
      <AlertTriangle size={22} />
      <strong>{title}</strong>
      <p>{detail}</p>
      <button type="button" onClick={onRetry}>Try again</button>
    </div>
  );
}
