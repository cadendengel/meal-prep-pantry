import React, { useState } from 'react';

// Helper functions for user management - inline
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getUsers() {
  const usersData = localStorage.getItem('users');
  return usersData ? JSON.parse(usersData) : [];
}

function saveUsers(users) {
  localStorage.setItem('users', JSON.stringify(users));
}

function createUser(name, email) {
  const users = getUsers();
  const existingUser = users.find(u => u.email === email);
  
  if (existingUser) {
    return { error: 'Email already exists' };
  }

  const newUser = {
    id: generateId(),
    name,
    email,
  };

  users.push(newUser);
  saveUsers(users);
  return { user: newUser };
}

function loginUser(email) {
  const users = getUsers();
  const user = users.find(u => u.email === email);
  
  if (!user) {
    return { error: 'User not found' };
  }

  // Save session
  localStorage.setItem('session', JSON.stringify({ user }));
  return { user };
}

function Landing({ onLogin }) {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (isCreating) {
      if (!name.trim()) {
        setError('Name is required');
        return;
      }

      const result = createUser(name.trim(), email.trim());
      if (result.error) {
        setError(result.error);
      } else {
        onLogin(result.user);
      }
    } else {
      const result = loginUser(email.trim());
      if (result.error) {
        setError(result.error);
      } else {
        onLogin(result.user);
      }
    }
  };

  return (
    <div className="landing-container">
      <div className="landing-content">
        <h1>🍽️ Meal Prep Pantry</h1>
        <p className="subtitle">Your local-first meal builder</p>

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
              />
            </div>

            <button type="submit" className="btn btn-primary">
              {isCreating ? 'Create Account' : 'Login'}
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
                  }}
                >
                  Create one
                </button>
              </p>
            )}
          </div>

          <div className="note">
            <small>
              <strong>Note:</strong> This is a local-only app. Data is stored in your browser.
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Landing;
