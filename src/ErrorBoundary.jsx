import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('App crashed:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          fontFamily: 'Segoe UI, Arial, sans-serif', padding: 32, maxWidth: 640, margin: '40px auto',
          background: '#fff', border: '1px solid #e0535f', borderRadius: 8, color: '#1c2630',
        }}
        >
          <h2 style={{ color: '#b94a4a', marginTop: 0 }}>Something went wrong</h2>
          <p>
            The app hit an unexpected error instead of silently going blank.
            Your work is still saved in this browser&apos;s local storage —
            reloading the page should recover it.
          </p>
          <pre style={{
            background: '#f6f7f8', padding: 12, borderRadius: 6, overflow: 'auto',
            fontSize: 12, whiteSpace: 'pre-wrap',
          }}
          >
            {String(this.state.error && this.state.error.stack ? this.state.error.stack : this.state.error)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 12, padding: '8px 16px', borderRadius: 6, border: 'none',
              background: '#2f9e44', color: '#fff', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
