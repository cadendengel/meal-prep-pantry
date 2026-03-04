/**
 * API Client for Meal Prep Pantry
 * 
 * Handles all API requests to the backend with authentication
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Get stored JWT token
 */
function getToken() {
  return localStorage.getItem('token');
}

/**
 * Store JWT token
 */
function setToken(token) {
  localStorage.setItem('token', token);
}

/**
 * Remove JWT token
 */
function removeToken() {
  localStorage.removeItem('token');
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
  
  // Handle non-JSON responses
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Server error: Invalid response format');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
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
  localStorage.removeItem('user');
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
  return !!getToken();
}

/**
 * Get current user from localStorage
 */
export function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

/**
 * Save current user to localStorage
 */
export function saveCurrentUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
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
  const data = await apiRequest(`/meals/${id}`, {
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
  const data = await apiRequest(`/meals/${id}`, {
    method: 'PUT',
    body: JSON.stringify(mealData),
  });
  
  return data.meal;
}

/**
 * Delete meal
 */
export async function deleteMeal(id) {
  const data = await apiRequest(`/meals/${id}`, {
    method: 'DELETE',
  });
  
  return data;
}
