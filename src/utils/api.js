/**
 * API Client for Meal Prep Pantry
 *
 * Handles all API requests to the backend with authentication
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

// Listeners fire when the stored session stops being valid, so the app can
// drop back to the landing page instead of showing "Unauthorized" forever.
const sessionExpiredListeners = new Set();

/**
 * Subscribe to session expiry.
 *
 * @param {Function} listener - Called when the server rejects the token
 * @returns {Function} Unsubscribe function
 */
export function onSessionExpired(listener) {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function notifySessionExpired() {
  for (const listener of sessionExpiredListeners) {
    try {
      listener();
    } catch (error) {
      console.error('Session expiry listener failed:', error);
    }
  }
}

/**
 * Get stored JWT token
 */
function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    // Private browsing modes can throw on storage access.
    return null;
  }
}

/**
 * Store JWT token
 */
function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error('Could not persist session token:', error);
  }
}

/**
 * Remove JWT token
 */
function removeToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing to do. The token is unreachable either way.
  }
}

/**
 * Make authenticated API request
 */
async function apiRequest(endpoint, options = {}) {
  const token = getToken();

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  // Add authorization header if token exists
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    // An expired or rejected token cannot be recovered by retrying. Clear
    // the session so the app returns to the landing page.
    if (response.status === 401 && token) {
      logout();
      notifySessionExpired();
      throw new Error('Your session has expired. Please log in again.');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    if (!isJson) {
      throw new Error(`Request failed (${response.status})`);
    }

    throw new Error('Request failed');
  }

  if (!isJson) {
    throw new Error('Server returned an unexpected response format');
  }

  return data;
}

// ============================================================================
// Auth API
// ============================================================================

/**
 * Register new user
 */
export async function register(name, email, password) {
  const data = await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });

  // Store token
  setToken(data.token);

  return data.user;
}

/**
 * Login user
 */
export async function login(email, password) {
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  // Store token
  setToken(data.token);

  return data.user;
}

/**
 * Logout user
 */
export function logout() {
  removeToken();
  try {
    localStorage.removeItem(USER_KEY);
  } catch {
    // Nothing to do.
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
  return !!getToken();
}

/**
 * Get current user from localStorage
 *
 * Corrupt storage must not crash the app, so a parse failure clears the
 * broken value and reports a logged-out user.
 */
export function getCurrentUser() {
  let userStr;
  try {
    userStr = localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }

  if (!userStr) {
    return null;
  }

  try {
    const user = JSON.parse(userStr);
    if (!user || typeof user !== 'object' || typeof user.name !== 'string') {
      logout();
      return null;
    }
    return user;
  } catch {
    console.warn('Stored user data was unreadable and has been cleared.');
    logout();
    return null;
  }
}

/**
 * Save current user to localStorage
 */
export function saveCurrentUser(user) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Could not persist user profile:', error);
  }
}

// ============================================================================
// Meals API
// ============================================================================

/**
 * Get all meals for current user
 */
export async function getMeals() {
  const data = await apiRequest('/meals', {
    method: 'GET',
  });

  return data.meals;
}

/**
 * Get single meal by ID
 */
export async function getMeal(id) {
  const encodedId = encodeURIComponent(id);
  const data = await apiRequest(`/meal?id=${encodedId}`, {
    method: 'GET',
  });

  return data.meal;
}

/**
 * Create new meal
 */
export async function createMeal(mealData) {
  const data = await apiRequest('/meals', {
    method: 'POST',
    body: JSON.stringify(mealData),
  });

  return data.meal;
}

/**
 * Update existing meal
 */
export async function updateMeal(id, mealData) {
  const encodedId = encodeURIComponent(id);
  const data = await apiRequest(`/meal?id=${encodedId}`, {
    method: 'PUT',
    body: JSON.stringify(mealData),
  });

  return data.meal;
}

/**
 * Delete meal
 */
export async function deleteMeal(id) {
  const encodedId = encodeURIComponent(id);
  const data = await apiRequest(`/meal?id=${encodedId}`, {
    method: 'DELETE',
  });

  return data;
}

// ============================================================================
// Pantry API
// ============================================================================

/**
 * List every saved pantry ingredient.
 *
 * @returns {Promise<Array>} Ingredients, sorted by name
 */
export async function getPantry() {
  const data = await apiRequest('/ingredients', { method: 'GET' });
  return data.ingredients;
}

/**
 * Find a saved ingredient by barcode.
 *
 * @param {string} barcode - Product barcode
 * @returns {Promise<object | null>} The ingredient, or null when not saved
 */
export async function findPantryByBarcode(barcode) {
  const data = await apiRequest(`/ingredients?barcode=${encodeURIComponent(barcode)}`, { method: 'GET' });
  return data.ingredients[0] || null;
}

/**
 * Save a new pantry ingredient.
 *
 * @param {object} ingredient - Ingredient fields
 * @returns {Promise<object>} The saved ingredient
 */
export async function createPantryIngredient(ingredient) {
  const data = await apiRequest('/ingredients', {
    method: 'POST',
    body: JSON.stringify(ingredient),
  });
  return data.ingredient;
}

/**
 * Update a pantry ingredient.
 *
 * @param {string} id - Ingredient id
 * @param {object} ingredient - Ingredient fields
 * @returns {Promise<object>} The updated ingredient
 */
export async function updatePantryIngredient(id, ingredient) {
  const data = await apiRequest(`/ingredient?id=${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(ingredient),
  });
  return data.ingredient;
}

/**
 * Delete a pantry ingredient.
 *
 * @param {string} id - Ingredient id
 * @returns {Promise<object>} Server acknowledgement
 */
export async function deletePantryIngredient(id) {
  return apiRequest(`/ingredient?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ============================================================================
// Profile API
// ============================================================================

/**
 * Read the signed-in user's profile and macro targets.
 *
 * @returns {Promise<object>} Profile with a targets object
 */
export async function getProfile() {
  const data = await apiRequest('/user/profile', { method: 'GET' });
  return data.user;
}

/**
 * Update the profile name, the macro targets, or both.
 *
 * @param {{name?: string, targets?: object}} update - Fields to change
 * @returns {Promise<object>} The updated profile
 */
export async function updateProfile(update) {
  const data = await apiRequest('/user/profile', {
    method: 'PUT',
    body: JSON.stringify(update),
  });
  return data.user;
}

// ============================================================================
// Password reset
// ============================================================================

/**
 * Ask for a password reset link.
 *
 * The response is the same whether or not the address has an account.
 *
 * @param {string} email - Email address
 * @returns {Promise<object>} Generic acknowledgement
 */
export async function requestPasswordReset(email) {
  return apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/**
 * Set a new password using a reset token, then sign in.
 *
 * @param {string} token - Token from the emailed link
 * @param {string} password - New password
 * @returns {Promise<object>} The signed-in user
 */
export async function resetPassword(token, password) {
  const data = await apiRequest('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
  setToken(data.token);
  return data.user;
}
