import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword, saveCurrentUser } from '../utils/api.js';

function ResetPassword({ onLogin }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const user = await resetPassword(token, password);
      saveCurrentUser(user);
      onLogin(user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not reset your password.');
      setLoading(false);
    }
  };

  return (
    <div className="landing-container">
      <div className="landing-content">
        <h1>🍽️ Meal Prep Pantry</h1>
        <div className="auth-card">
          <h2>Choose a new password</h2>

          {!token ? (
            <>
              <div className="error-message">This link is missing its token. Request a new reset email.</div>
              <Link to="/forgot-password" className="btn btn-primary">Request a new link</Link>
            </>
          ) : (
            <>
              {error && <div className="error-message">{error}</div>}
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="new-password">New password</label>
                  <input id="new-password" type="password" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters" autoFocus required disabled={loading} />
                </div>
                <div className="form-group">
                  <label htmlFor="confirm-password">Confirm password</label>
                  <input id="confirm-password" type="password" value={confirm}
                    onChange={(e) => setConfirm(e.target.value)} required disabled={loading} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Set new password'}
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

export default ResetPassword;
