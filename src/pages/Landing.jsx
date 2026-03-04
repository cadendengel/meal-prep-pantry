import React, { useState } from 'react';
import { register, login, saveCurrentUser } from '../utils/api.js';

function Landing({ onLogin }) {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email.trim()) {
        setError('Email is required');
        setLoading(false);
        return;
      }

      if (!password.trim()) {
        setError('Password is required');
        setLoading(false);
        return;
      }

      if (isCreating) {
        if (!name.trim()) {
          setError('Name is required');
          setLoading(false);
          return;
        }

        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }

        const user = await register(name.trim(), email.trim(), password);
        saveCurrentUser(user);
        onLogin(user);
      } else {
        const user = await login(email.trim(), password);
        saveCurrentUser(user);
        onLogin(user);
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="landing-container">
      <div className="landing-content">
        <h1>🍽️ Meal Prep Pantry</h1>
        <p className="subtitle">Your cloud-enabled meal builder</p>

        <div className="auth-card">
          <h2>{isCreating ? 'Create Account' : 'Login'}</h2>
          
          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit}>
            {isCreating && (
              <div className="form-group">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoFocus={isCreating}
                  disabled={loading}
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                autoFocus={!isCreating}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isCreating ? 'Min. 6 characters' : 'Your password'}
                disabled={loading}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Please wait...' : (isCreating ? 'Create Account' : 'Login')}
            </button>
          </form>

          <div className="auth-toggle">
            {isCreating ? (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setIsCreating(false);
                    setError('');
                    setName('');
                    setPassword('');
                  }}
                >
                  Login
                </button>
              </p>
            ) : (
              <p>
                Don't have an account?{' '}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setIsCreating(true);
                    setError('');
                    setPassword('');
                  }}
                >
                  Create one
                </button>
              </p>
            )}
          </div>

          <div className="note">
            <small>
              <strong>Note:</strong> Your data is securely stored in the cloud and synced across devices.
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Landing;
