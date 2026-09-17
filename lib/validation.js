/**
 * Shared request validation helpers for the API routes.
 */

const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Check that a product URL is a well-formed http(s) URL.
 *
 * `new URL()` alone is not enough. It accepts `javascript:alert(1)` and
 * `data:text/html,...`, and the client renders this value into an anchor href.
 *
 * @param {string} value - Raw URL string
 * @returns {boolean} True if the URL is safe to store and render
 */
export function isSafeHttpUrl(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (!ALLOWED_URL_PROTOCOLS.has(parsed.protocol)) {
    return false;
  }

  // A protocol-only URL such as "https:" parses but has no host.
  return Boolean(parsed.hostname);
}

/**
 * Validate every ingredient product URL on a meal payload.
 *
 * @param {Array} ingredients - Ingredient list from the request body
 * @returns {string | null} Error message, or null when every URL is valid
 */
export function findInvalidIngredientUrl(ingredients) {
  if (!Array.isArray(ingredients)) {
    return null;
  }

  for (const ingredient of ingredients) {
    const url = ingredient?.productUrl;
    if (url && typeof url === 'string' && url.trim()) {
      if (!isSafeHttpUrl(url.trim())) {
        return `Invalid URL for ingredient: ${ingredient.name || 'unnamed'}`;
      }
    }
  }

  return null;
}

/**
 * Validate the shared fields of a meal create/update payload.
 *
 * @param {object} mealData - Request body
 * @returns {string | null} Error message, or null when the payload is valid
 */
export function validateMealPayload(mealData) {
  if (!mealData || typeof mealData !== 'object') {
    return 'Meal data is required';
  }

  if (!mealData.name || typeof mealData.name !== 'string' || !mealData.name.trim()) {
    return 'Meal name is required';
  }

  if (!mealData.servingsPerMeal || mealData.servingsPerMeal <= 0) {
    return 'Servings per meal must be greater than 0';
  }

  return findInvalidIngredientUrl(mealData.ingredients);
}

/**
 * Build the stored meal document fields from a validated payload.
 *
 * The API writes only these fields. It never trusts client-supplied
 * `userId`, `_id` or `createdAt` values.
 *
 * @param {object} mealData - Validated request body
 * @returns {object} Fields to persist
 */
export function buildMealFields(mealData) {
  return {
    name: mealData.name.trim(),
    notes: mealData.notes || '',
    servingSize: mealData.servingSize ?? null,
    servingUnit: mealData.servingUnit || 'g',
    servingsPerMeal: mealData.servingsPerMeal,
    ingredients: Array.isArray(mealData.ingredients) ? mealData.ingredients : [],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Validate a pantry ingredient payload.
 *
 * @param {object} data - Request body
 * @returns {string | null} Error message, or null when the payload is valid
 */
export function validateIngredientPayload(data) {
  if (!data || typeof data !== 'object') {
    return 'Ingredient data is required';
  }

  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    return 'Ingredient name is required';
  }

  if (data.productUrl && typeof data.productUrl === 'string' && data.productUrl.trim()) {
    if (!isSafeHttpUrl(data.productUrl.trim())) {
      return 'Product URL must be a full http:// or https:// address';
    }
  }

  for (const field of ['caloriesPerServing', 'proteinPerServing', 'carbsPerServing', 'fatPerServing', 'price', 'servingSizeQuantity', 'servingsPerContainer']) {
    const value = data[field];
    if (value === null || value === undefined || value === '') continue;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return `${field} must be a number of 0 or more`;
    }
  }

  return null;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * Build the stored fields for a pantry ingredient.
 *
 * @param {object} data - Validated request body
 * @returns {object} Fields to persist
 */
export function buildIngredientFields(data) {
  return {
    name: data.name.trim(),
    brand: typeof data.brand === 'string' ? data.brand.trim() : '',
    barcode: typeof data.barcode === 'string' ? data.barcode.trim() : '',
    servingSizeQuantity: numberOrNull(data.servingSizeQuantity),
    servingSizeUnit: data.servingSizeUnit || 'serving',
    servingsPerContainer: numberOrNull(data.servingsPerContainer),
    caloriesPerServing: numberOrNull(data.caloriesPerServing),
    proteinPerServing: numberOrNull(data.proteinPerServing),
    carbsPerServing: numberOrNull(data.carbsPerServing),
    fatPerServing: numberOrNull(data.fatPerServing),
    price: numberOrNull(data.price),
    productUrl: typeof data.productUrl === 'string' ? data.productUrl.trim() : '',
    notes: typeof data.notes === 'string' ? data.notes : '',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Validate a macro target payload.
 *
 * Every field is optional. A null clears that target.
 *
 * @param {object} data - Request body
 * @returns {string | null} Error message, or null when valid
 */
export function validateTargets(data) {
  if (!data || typeof data !== 'object') {
    return 'Targets are required';
  }

  for (const field of ['calories', 'protein', 'carbs', 'fat']) {
    const value = data[field];
    if (value === null || value === undefined || value === '') continue;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return `${field} target must be a number of 0 or more`;
    }
  }

  return null;
}

/**
 * Build the stored macro target fields.
 *
 * @param {object} data - Validated request body
 * @returns {object} Target fields
 */
export function buildTargets(data) {
  return {
    calories: numberOrNull(data.calories),
    protein: numberOrNull(data.protein),
    carbs: numberOrNull(data.carbs),
    fat: numberOrNull(data.fat),
  };
}
