import { Component, type ReactNode } from 'react';

/**
 * A render-error boundary. Catches a throw anywhere in its subtree, reports it via
 * `onError` (e.g. to push a banner), and shows `fallback` in place of the crashed
 * subtree so one bad panel never blanks the whole workspace. Stays in the fallback
 * until remounted (`resetKey` change) — a crashed subtree won't re-throw on every
 * render.
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;

  /** Change this to clear the crashed state and retry rendering the children. */
  resetKey?: unknown;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, { crashed: boolean }> {
  constructor (props: ErrorBoundaryProps) {
    super(props);
    this.state = { crashed: false };
  }

  static getDerivedStateFromError (): { crashed: boolean } {
    return { crashed: true };
  }

  componentDidUpdate (prev: ErrorBoundaryProps): void {
    if (this.state.crashed && prev.resetKey !== this.props.resetKey) {
      this.setState({ crashed: false });
    }
  }

  componentDidCatch (error: Error): void {
    this.props.onError?.(error);
  }

  render (): ReactNode {
    return this.state.crashed ? this.props.fallback ?? null : this.props.children;
  }
}
