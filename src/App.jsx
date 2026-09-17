import React, { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MealEdit from './pages/MealEdit.jsx';
import MealView from './pages/MealView.jsx';
import Pantry from './pages/Pantry.jsx';
import ShoppingList from './pages/ShoppingList.jsx';
import Settings from './pages/Settings.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { ToastProvider } from './components/Toast.jsx';
import {
  getCurrentUser, logout, isAuthenticated, onSessionExpired, getProfile,
} from './utils/api.js';

const NO_TARGETS = { calories: null, protein: null, carbs: null, fat: null };

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [targets, setTargets] = useState(NO_TARGETS);
  const [loading, setLoading] = useState(true);
  const [sessionNotice, setSessionNotice] = useState('');

  useEffect(() => {
    if (isAuthenticated()) {
      setCurrentUser(getCurrentUser());
    }
    setLoading(false);
  }, []);

  // Macro targets are read once per session and shared with every page
  // that compares a meal against them.
  useEffect(() => {
    if (!currentUser) {
      setTargets(NO_TARGETS);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const profile = await getProfile();
        if (!cancelled) setTargets(profile.targets || NO_TARGETS);
      } catch {
        // Targets are optional. A failure here must not block the app.
        if (!cancelled) setTargets(NO_TARGETS);
      }
    })();

    return () => { cancelled = true; };
  }, [currentUser]);

  useEffect(() => {
    return onSessionExpired(() => {
      setCurrentUser(null);
      setSessionNotice('Your session has expired. Please log in again.');
    });
  }, []);

  const handleLogin = useCallback((user) => {
    setSessionNotice('');
    setCurrentUser(user);
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    setSessionNotice('');
    setCurrentUser(null);
  }, []);

  const handleProfileChange = useCallback((user) => {
    setCurrentUser(user);
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // Every signed-in route shares these props.
  const shell = { user: currentUser, onLogout: handleLogout };

  const guarded = (element) => (currentUser ? element : <Navigate to="/" replace />);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/"
              element={
                currentUser
                  ? <Navigate to="/dashboard" replace />
                  : <Landing onLogin={handleLogin} notice={sessionNotice} />
              }
            />
            <Route
              path="/forgot-password"
              element={currentUser ? <Navigate to="/dashboard" replace /> : <ForgotPassword />}
            />
            <Route path="/reset-password" element={<ResetPassword onLogin={handleLogin} />} />

            <Route path="/dashboard" element={guarded(<Dashboard {...shell} targets={targets} />)} />
            <Route path="/meal/new" element={guarded(<MealEdit {...shell} targets={targets} />)} />
            <Route path="/meal/:id/edit" element={guarded(<MealEdit {...shell} targets={targets} />)} />
            <Route path="/meal/:id" element={guarded(<MealView {...shell} targets={targets} />)} />
            <Route path="/pantry" element={guarded(<Pantry {...shell} />)} />
            <Route path="/shopping-list" element={guarded(<ShoppingList {...shell} />)} />
            <Route
              path="/settings"
              element={guarded(<Settings {...shell} onProfileChange={handleProfileChange} />)}
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
