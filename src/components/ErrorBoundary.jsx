import React from 'react';

/**
 * Catches render errors so a single bad record cannot blank the whole app.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unknown error' };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info);
  }

  handleReload = () => {
    window.location.assign('/');
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-container">
          <main className="main-content">
            <h2>Something went wrong</h2>
            <div className="error-message">{this.state.message}</div>
            <button onClick={this.handleReload} className="btn btn-primary">
              Return to start
            </button>
          </main>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
