import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Catches render-time errors anywhere below it and shows a recoverable message
 * instead of a blank screen. A silent white/blank panel (an unhandled render
 * error unmounting the whole tree) is the worst failure mode for an extension
 * UI, so this is a deliberate safety net.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface in the panel's devtools console for debugging.
    console.error('Hype Detector UI error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="card"
          role="alert"
          style={{ margin: 'var(--space)', borderColor: 'var(--danger)' }}
        >
          <strong style={{ color: 'var(--danger)' }}>Something went wrong displaying this.</strong>
          <p style={{ margin: '8px 0' }}>{this.state.error.message}</p>
          <button className="btn btn-secondary" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
