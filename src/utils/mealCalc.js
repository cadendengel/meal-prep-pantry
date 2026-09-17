/**
 * Meal calculation helpers.
 *
 * These were duplicated in MealEdit.jsx and MealForm.jsx. One copy keeps the
 * saved serving size and the displayed serving size in agreement.
 */

/**
 * Generate a client-side ingredient row id.
 *
 * @returns {string} Unique-enough id for React keys and row updates
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * Multiply a per-serving macro by the servings used.
 *
 * Missing or null fields count as zero. Without the guard the product is
 * NaN and the UI prints "NaN".
 *
 * @param {number | null | undefined} perServing - Macro per serving
 * @param {number | null | undefined} servingsUsed - Servings used
 * @returns {number} Total for this ingredient
 */
export function macroTotal(perServing, servingsUsed) {
  const amount = Number(perServing) || 0;
  const servings = Number(servingsUsed) || 0;
  return amount * servings;
}

/**
 * Total the four macros for one ingredient.
 *
 * @param {object} ingredient - Ingredient record
 * @returns {{calories: number, protein: number, carbs: number, fat: number}}
 */
export function calculateIngredientTotals(ingredient) {
  return {
    calories: macroTotal(ingredient?.caloriesPerServing, ingredient?.servingsUsed),
    protein: macroTotal(ingredient?.proteinPerServing, ingredient?.servingsUsed),
    carbs: macroTotal(ingredient?.carbsPerServing, ingredient?.servingsUsed),
    fat: macroTotal(ingredient?.fatPerServing, ingredient?.servingsUsed),
  };
}

/**
 * Calculate meal serving size based on ingredients.
 *
 * @param {Array} ingredients - Ingredient list
 * @param {number} servingsPerMeal - Servings the meal yields
 * @returns {{totals: object, perServing: object, hasMultipleUnits: boolean} | null}
 */
export function calculateMealServingSize(ingredients, servingsPerMeal) {
  if (!servingsPerMeal || servingsPerMeal <= 0) return null;
  if (!Array.isArray(ingredients)) return null;

  // Group ingredients by unit and sum total quantities used
  const byUnit = {};

  for (const ingredient of ingredients) {
    if (ingredient.servingSizeQuantity !== null && ingredient.servingSizeQuantity !== undefined) {
      const unit = ingredient.servingSizeUnit || 'serving';
      // Calculate total amount of this ingredient used in the meal
      const servingsUsed = Number(ingredient.servingsUsed) || 0;
      const totalQuantity = (Number(ingredient.servingSizeQuantity) || 0) * servingsUsed;

      if (!byUnit[unit]) {
        byUnit[unit] = 0;
      }
      byUnit[unit] += totalQuantity;
    }
  }

  // If no ingredients with quantities, return null
  if (Object.keys(byUnit).length === 0) return null;

  // Divide by servings per meal for per-serving amount
  const perServing = {};
  for (const unit in byUnit) {
    perServing[unit] = byUnit[unit] / servingsPerMeal;
  }

  return {
    totals: byUnit,
    perServing,
    hasMultipleUnits: Object.keys(byUnit).length > 1,
  };
}

/**
 * Check that a product URL is safe to place in an anchor href.
 *
 * Mirrors the API-side check in lib/validation.js. A "javascript:" URL
 * parses cleanly, so the protocol must be tested explicitly.
 *
 * @param {string} value - Raw URL string
 * @returns {boolean} True when the URL is http(s) with a host
 */
export function isSafeHttpUrl(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}
