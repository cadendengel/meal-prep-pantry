import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

let nextId = 0;

/**
 * Provides transient status messages, replacing window.alert.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback((message, tone = 'info', durationMs = 5000) => {
    const id = ++nextId;
    setToasts((current) => [...current, { id, message, tone }]);
    if (durationMs > 0) {
      timers.current.set(id, setTimeout(() => dismiss(id), durationMs));
    }
    return id;
  }, [dismiss]);

  const api = useMemo(() => ({
    info: (m, d) => push(m, 'info', d),
    success: (m, d) => push(m, 'success', d),
    // Errors stay until dismissed. A message the user missed is worse than
    // one they have to close.
    error: (m, d = 0) => push(m, 'error', d),
    dismiss,
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            <span className="toast-message">{toast.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Read the toast API.
 *
 * @returns {{info: Function, success: Function, error: Function, dismiss: Function}}
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside a ToastProvider');
  }
  return context;
}
