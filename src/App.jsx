import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MealEdit from './pages/MealEdit.jsx';
import MealView from './pages/MealView.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { getCurrentUser, logout, isAuthenticated, onSessionExpired } from './utils/api.js';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionNotice, setSessionNotice] = useState('');

  useEffect(() => {
    // Check if user is logged in (has valid token).
    // getCurrentUser handles corrupt storage on its own and returns null.
    if (isAuthenticated()) {
      setCurrentUser(getCurrentUser());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // The API client clears the session when the server rejects the token.
    // Mirror that in the UI so the route guards send the user to the
    // landing page instead of leaving a dead "Unauthorized" screen.
    return onSessionExpired(() => {
      setCurrentUser(null);
      setSessionNotice('Your session has expired. Please log in again.');
    });
  }, []);

  const handleLogin = (user) => {
    setSessionNotice('');
    setCurrentUser(user);
  };

  const handleLogout = () => {
    logout();
    setSessionNotice('');
    setCurrentUser(null);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              currentUser ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Landing onLogin={handleLogin} notice={sessionNotice} />
              )
            }
          />
          <Route
            path="/dashboard"
            element={
              currentUser ? (
                <Dashboard user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/meal/new"
            element={
              currentUser ? (
                <MealEdit user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/meal/:id/edit"
            element={
              currentUser ? (
                <MealEdit user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/meal/:id"
            element={
              currentUser ? (
                <MealView user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
