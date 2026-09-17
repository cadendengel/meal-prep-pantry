/**
 * Open Food Facts lookup.
 *
 * A free, key-less product database. It is more accurate than OCR for
 * packaged groceries, because the values are transcribed rather than read
 * from a photograph.
 *
 * Open Food Facts reports nutrition per 100 g or per 100 ml, and sometimes
 * also per serving. Per-serving values are preferred when present, because
 * the rest of the app works in servings.
 */

const ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product';
const FIELDS = 'product_name,brands,serving_size,serving_quantity,quantity,nutriments,code';

/**
 * Report whether a string looks like a product barcode.
 *
 * @param {string} value - Candidate barcode
 * @returns {boolean} True for 8 to 14 digits
 */
export function isPlausibleBarcode(value) {
  return typeof value === 'string' && /^\d{8,14}$/.test(value.trim());
}

function firstNumber(...values) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }
  return null;
}

/**
 * Parse an Open Food Facts serving_size string such as "55 g" or "1 cup (240ml)".
 *
 * @param {string} text - Raw serving size
 * @returns {{quantity: number | null, unit: string | null}} Parsed components
 */
export function parseServingSize(text) {
  if (!text || typeof text !== 'string') return { quantity: null, unit: null };
  const match = text.trim().toLowerCase().match(/([\d.]+)\s*(g|kg|mg|ml|l|oz|cup|tbsp|tsp)\b/);
  if (!match) return { quantity: null, unit: null };

  let quantity = parseFloat(match[1]);
  let unit = match[2];

  // Normalize to the units the app offers.
  if (unit === 'kg') { quantity *= 1000; unit = 'g'; }
  if (unit === 'mg') { quantity /= 1000; unit = 'g'; }

  return { quantity: Number.isFinite(quantity) ? quantity : null, unit };
}

/**
 * Convert an Open Food Facts product into the app's ingredient shape.
 *
 * @param {object} product - Product node from the API
 * @returns {object} Ingredient fields, with nulls where data is missing
 */
export function toIngredient(product) {
  const n = product?.nutriments || {};
  const serving = parseServingSize(product?.serving_size);

  // Prefer per-serving values. Fall back to per-100g, and say so through
  // the serving size that comes back with it.
  const hasServingValues = firstNumber(n['energy-kcal_serving'], n.proteins_serving, n.carbohydrates_serving, n.fat_serving) !== null;

  const pick = (servingKey, hundredKey) => {
    const value = hasServingValues ? n[servingKey] : n[hundredKey];
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.round(numeric * 10) / 10 : null;
  };

  const servingSizeQuantity = hasServingValues
    ? (serving.quantity ?? Number(product?.serving_quantity) ?? null)
    : 100;
  const servingSizeUnit = hasServingValues
    ? (serving.unit || 'serving')
    : (n.energy_unit === 'ml' || /ml|l\b/.test(product?.quantity || '') ? 'ml' : 'g');

  return {
    name: (product?.product_name || '').trim(),
    brand: (product?.brands || '').split(',')[0].trim(),
    barcode: product?.code || '',
    servingSizeQuantity: Number.isFinite(Number(servingSizeQuantity)) ? Number(servingSizeQuantity) : null,
    servingSizeUnit,
    caloriesPerServing: pick('energy-kcal_serving', 'energy-kcal_100g'),
    proteinPerServing: pick('proteins_serving', 'proteins_100g'),
    carbsPerServing: pick('carbohydrates_serving', 'carbohydrates_100g'),
    fatPerServing: pick('fat_serving', 'fat_100g'),
    perServingSource: hasServingValues ? 'serving' : '100g',
  };
}

/**
 * Look a barcode up in Open Food Facts.
 *
 * @param {string} barcode - Product barcode
 * @param {{signal?: AbortSignal}} [options] - Fetch options
 * @returns {Promise<object | null>} Ingredient fields, or null when not found
 */
export async function lookupBarcode(barcode, options = {}) {
  if (!isPlausibleBarcode(barcode)) {
    throw new Error('That does not look like a barcode. Expect 8 to 14 digits.');
  }

  const url = `${ENDPOINT}/${encodeURIComponent(barcode.trim())}.json?fields=${FIELDS}`;
  const response = await fetch(url, { signal: options.signal });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Open Food Facts returned ${response.status}.`);
  }

  const data = await response.json();
  if (data.status !== 1 || !data.product) return null;

  const ingredient = toIngredient(data.product);
  if (!ingredient.name) {
    // A product with no name is not useful to show.
    ingredient.name = `Barcode ${barcode}`;
  }
  return ingredient;
}
