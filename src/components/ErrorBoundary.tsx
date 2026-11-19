import * as React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
  /** Change this when the underlying data has been repaired: it remounts the subtree. */
  resetKey?: string | number;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  lastResetKey?: string | number;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '', lastResetKey: props.resetKey };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    if (state.hasError && props.resetKey !== state.lastResetKey) {
      return { hasError: false, errorMessage: '', lastResetKey: props.resetKey };
    }
    return null;
  }

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const captureOwnerStack = (React as unknown as { captureOwnerStack?: () => string | null })
      .captureOwnerStack;
    const ownerStack = typeof captureOwnerStack === 'function' ? captureOwnerStack() : null;
    console.error('[ErrorBoundary]', error, info.componentStack, ownerStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '20px',
            margin: '16px',
            background: '#450a0a',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            color: '#fecaca',
            fontFamily: 'sans-serif',
          }}
        >
          <h3 style={{ marginTop: 0, color: '#f87171' }}>
            {this.props.fallbackTitle || 'Une erreur de rendu est survenue'}
          </h3>
          <p style={{ fontSize: '13px', fontFamily: 'monospace' }}>{this.state.errorMessage}</p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '8px 14px',
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Réinitialiser le composant
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
