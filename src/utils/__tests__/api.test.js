import { describe, it, expect, beforeEach, vi } from 'vitest';

// The module reads import.meta.env and localStorage at import time, so the
// environment is installed before the import.
function installStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  return store;
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  };
}

function textResponse(status, body = '<!doctype html>') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'text/html' },
    json: async () => {
      throw new Error('not json');
    },
    text: async () => body,
  };
}

let store;
let api;

beforeEach(async () => {
  store = installStorage();
  vi.resetModules();
  api = await import('../api.js');
});

describe('token storage', () => {
  it('reports no session when nothing is stored', () => {
    expect(api.isAuthenticated()).toBe(false);
    expect(api.getCurrentUser()).toBeNull();
  });

  it('round-trips a saved user', () => {
    api.saveCurrentUser({ id: '1', name: 'Ada', email: 'ada@example.com' });
    expect(api.getCurrentUser()).toEqual({ id: '1', name: 'Ada', email: 'ada@example.com' });
  });

  it('clears corrupt user JSON instead of throwing', () => {
    store.set('user', '{not valid json');
    expect(() => api.getCurrentUser()).not.toThrow();
    expect(api.getCurrentUser()).toBeNull();
    expect(store.has('user')).toBe(false);
  });

  it('rejects a stored user with the wrong shape', () => {
    store.set('user', JSON.stringify({ id: '1' }));
    expect(api.getCurrentUser()).toBeNull();
  });

  it('rejects stored null', () => {
    store.set('user', 'null');
    expect(api.getCurrentUser()).toBeNull();
  });

  it('survives localStorage throwing on read', () => {
    globalThis.localStorage.getItem = () => {
      throw new Error('storage disabled');
    };
    expect(() => api.getCurrentUser()).not.toThrow();
    expect(api.getCurrentUser()).toBeNull();
    expect(api.isAuthenticated()).toBe(false);
  });
});

describe('login and logout', () => {
  it('stores the token returned by the server', async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(200, { token: 'tok-123', user: { id: '1', name: 'Ada', email: 'a@b.co' } })
    );
    const user = await api.login('a@b.co', 'secret');
    expect(user.name).toBe('Ada');
    expect(store.get('token')).toBe('tok-123');
    expect(api.isAuthenticated()).toBe(true);
  });

  it('sends the bearer header once a token exists', async () => {
    store.set('token', 'tok-123');
    globalThis.fetch = vi.fn(async () => jsonResponse(200, { meals: [] }));
    await api.getMeals();
    const [, config] = globalThis.fetch.mock.calls[0];
    expect(config.headers.Authorization).toBe('Bearer tok-123');
  });

  it('sends no bearer header when logged out', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse(200, { meals: [] }));
    await api.getMeals();
    const [, config] = globalThis.fetch.mock.calls[0];
    expect(config.headers.Authorization).toBeUndefined();
  });

  it('clears both keys on logout', () => {
    store.set('token', 'tok-123');
    api.saveCurrentUser({ id: '1', name: 'Ada', email: 'a@b.co' });
    api.logout();
    expect(store.has('token')).toBe(false);
    expect(store.has('user')).toBe(false);
  });
});

describe('401 session expiry', () => {
  it('clears the session and notifies listeners', async () => {
    store.set('token', 'expired-token');
    api.saveCurrentUser({ id: '1', name: 'Ada', email: 'a@b.co' });

    const listener = vi.fn();
    api.onSessionExpired(listener);

    globalThis.fetch = vi.fn(async () => jsonResponse(401, { error: 'Unauthorized' }));

    await expect(api.getMeals()).rejects.toThrow(/session has expired/i);

    expect(store.has('token')).toBe(false);
    expect(store.has('user')).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(api.isAuthenticated()).toBe(false);
  });

  it('does not fire for a 401 when no token was sent', async () => {
    const listener = vi.fn();
    api.onSessionExpired(listener);
    globalThis.fetch = vi.fn(async () => jsonResponse(401, { error: 'Unauthorized' }));

    await expect(api.getMeals()).rejects.toThrow('Unauthorized');
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not fire on a 403 or a 500', async () => {
    store.set('token', 'tok-123');
    const listener = vi.fn();
    api.onSessionExpired(listener);

    globalThis.fetch = vi.fn(async () => jsonResponse(403, { error: 'Forbidden' }));
    await expect(api.getMeals()).rejects.toThrow('Forbidden');

    globalThis.fetch = vi.fn(async () => jsonResponse(500, { error: 'Internal server error' }));
    await expect(api.getMeals()).rejects.toThrow('Internal server error');

    expect(listener).not.toHaveBeenCalled();
    expect(store.get('token')).toBe('tok-123');
  });

  it('stops notifying after unsubscribe', async () => {
    store.set('token', 'tok-123');
    const listener = vi.fn();
    const unsubscribe = api.onSessionExpired(listener);
    unsubscribe();

    globalThis.fetch = vi.fn(async () => jsonResponse(401, { error: 'Unauthorized' }));
    await expect(api.getMeals()).rejects.toThrow(/session has expired/i);
    expect(listener).not.toHaveBeenCalled();
  });

  it('a throwing listener does not break the caller', async () => {
    store.set('token', 'tok-123');
    api.onSessionExpired(() => {
      throw new Error('listener blew up');
    });
    const good = vi.fn();
    api.onSessionExpired(good);

    globalThis.fetch = vi.fn(async () => jsonResponse(401, { error: 'Unauthorized' }));
    await expect(api.getMeals()).rejects.toThrow(/session has expired/i);
    expect(good).toHaveBeenCalledTimes(1);
  });
});

describe('error handling', () => {
  it('surfaces the server error message', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse(400, { error: 'Meal name is required' }));
    await expect(api.createMeal({})).rejects.toThrow('Meal name is required');
  });

  it('reports the status when the body is not JSON', async () => {
    globalThis.fetch = vi.fn(async () => textResponse(502));
    await expect(api.getMeals()).rejects.toThrow('Request failed (502)');
  });

  it('rejects a 200 that is not JSON', async () => {
    globalThis.fetch = vi.fn(async () => textResponse(200));
    await expect(api.getMeals()).rejects.toThrow(/unexpected response format/i);
  });
});

describe('meal endpoints', () => {
  beforeEach(() => {
    store.set('token', 'tok-123');
  });

  it('encodes the id in the query string', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse(200, { meal: { id: 'a b/c' } }));
    await api.getMeal('a b/c');
    expect(globalThis.fetch.mock.calls[0][0]).toBe('/api/meal?id=a%20b%2Fc');
  });

  it('posts to /meals when creating', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse(201, { meal: { id: '1' } }));
    await api.createMeal({ name: 'Bowl', servingsPerMeal: 2 });
    const [url, config] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('/api/meals');
    expect(config.method).toBe('POST');
    expect(JSON.parse(config.body).name).toBe('Bowl');
  });

  it('uses PUT and DELETE against /meal', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse(200, { meal: { id: '1' }, message: 'ok' }));
    await api.updateMeal('1', { name: 'Bowl', servingsPerMeal: 2 });
    expect(globalThis.fetch.mock.calls[0][1].method).toBe('PUT');

    await api.deleteMeal('1');
    expect(globalThis.fetch.mock.calls[1][1].method).toBe('DELETE');
  });
});
