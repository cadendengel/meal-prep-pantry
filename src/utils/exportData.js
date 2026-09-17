/**
 * Export helpers.
 *
 * Data a user typed in should be retrievable without a database client.
 */

import { calculateIngredientTotals } from './mealCalc.js';

function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  // A cell containing a comma, a quote or a newline must be quoted, and
  // inner quotes must be doubled.
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Build a CSV of every ingredient across the given meals.
 *
 * @param {Array} meals - Meals to export
 * @returns {string} CSV text with a header row
 */
export function mealsToCsv(meals) {
  const header = [
    'Meal', 'Servings Per Meal', 'Ingredient', 'Serving Size', 'Serving Unit',
    'Servings Used', 'Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)',
    'Price', 'Store URL', 'Notes',
  ];

  const rows = [header];

  for (const meal of meals) {
    const ingredients = Array.isArray(meal.ingredients) ? meal.ingredients : [];
    if (ingredients.length === 0) {
      rows.push([meal.name, meal.servingsPerMeal, '(no ingredients)', '', '', '', '', '', '', '', '', '', meal.notes || '']);
      continue;
    }
    for (const ingredient of ingredients) {
      const totals = calculateIngredientTotals(ingredient);
      rows.push([
        meal.name,
        meal.servingsPerMeal,
        ingredient.name || '',
        ingredient.servingSizeQuantity ?? '',
        ingredient.servingSizeUnit || '',
        ingredient.servingsUsed ?? '',
        totals.calories.toFixed(1),
        totals.protein.toFixed(1),
        totals.carbs.toFixed(1),
        totals.fat.toFixed(1),
        ingredient.price ?? '',
        ingredient.productUrl || '',
        ingredient.notes || '',
      ]);
    }
  }

  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

/**
 * Serialize meals as readable JSON.
 *
 * @param {Array} meals - Meals to export
 * @returns {string} JSON text
 */
export function mealsToJson(meals) {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      mealCount: meals.length,
      meals: meals.map(({ userId, ...meal }) => meal),
    },
    null,
    2
  );
}

/**
 * Trigger a browser download of text content.
 *
 * @param {string} filename - Suggested file name
 * @param {string} content - File body
 * @param {string} mimeType - Content type
 */
export function downloadText(filename, content, mimeType) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Release on the next tick, so the click has been handled.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Build a dated file name.
 *
 * @param {string} base - Name without an extension
 * @param {string} extension - File extension without a dot
 * @returns {string} File name such as "meals-2026-09-17.csv"
 */
export function datedFilename(base, extension) {
  const date = new Date().toISOString().slice(0, 10);
  return `${base}-${date}.${extension}`;
}
