import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../utils/api.js';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-container">
      <div className="landing-content">
        <h1>🍽️ Meal Prep Pantry</h1>
        <div className="auth-card">
          <h2>Reset your password</h2>

          {sent ? (
            <>
              <p className="note">
                If that email address has an account, a reset link is on its way.
                The link stops working after 30 minutes.
              </p>
              <Link to="/" className="btn btn-primary">Back to login</Link>
            </>
          ) : (
            <>
              {error && <div className="error-message">{error}</div>}
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="forgot-email">Email</label>
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    autoFocus
                    required
                    disabled={loading}
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
              </form>
              <div className="auth-toggle">
                <p><Link to="/" className="link-button">Back to login</Link></p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
