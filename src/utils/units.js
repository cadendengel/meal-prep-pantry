/**
 * Unit handling for ingredient quantities.
 *
 * Units fall into dimensions. Quantities convert freely inside a dimension
 * and never across one. Count units ("slice", "piece") are each their own
 * dimension, because a slice of bread and a piece of chicken do not relate.
 */

export const MASS = 'mass';
export const VOLUME = 'volume';
export const COUNT = 'count';

// Factors convert one unit into the dimension's base unit.
// Mass base is the gram. Volume base is the millilitre.
const UNITS = {
  g: { dimension: MASS, factor: 1, label: 'g' },
  oz: { dimension: MASS, factor: 28.349523125, label: 'oz' },
  lb: { dimension: MASS, factor: 453.59237, label: 'lb' },

  ml: { dimension: VOLUME, factor: 1, label: 'ml' },
  l: { dimension: VOLUME, factor: 1000, label: 'l' },
  cup: { dimension: VOLUME, factor: 236.5882365, label: 'cup' },
  tbsp: { dimension: VOLUME, factor: 14.78676478125, label: 'tbsp' },
  tsp: { dimension: VOLUME, factor: 4.92892159375, label: 'tsp' },

  // Count units do not convert. Each is its own dimension so that summing
  // never mixes them.
  serving: { dimension: 'count:serving', factor: 1, label: 'serving' },
  slice: { dimension: 'count:slice', factor: 1, label: 'slice' },
  piece: { dimension: 'count:piece', factor: 1, label: 'piece' },
  item: { dimension: 'count:item', factor: 1, label: 'item' },
};

// Which measuring system each unit belongs to. A total is reported in the
// system the user actually typed, so a recipe written in grams does not
// come back in ounces.
const SYSTEM = {
  g: 'metric', ml: 'metric', l: 'metric',
  oz: 'imperial', lb: 'imperial', cup: 'imperial', tbsp: 'imperial', tsp: 'imperial',
};

// Preferred display units per dimension and system, largest first. A total
// picks the largest unit that leaves a value of at least 1.
const DISPLAY_LADDER = {
  [MASS]: {
    metric: ['g'],
    imperial: ['lb', 'oz'],
  },
  [VOLUME]: {
    metric: ['l', 'ml'],
    imperial: ['cup', 'tbsp', 'tsp'],
  },
};

/**
 * List every supported unit key.
 *
 * @returns {string[]} Unit keys
 */
export function listUnits() {
  return Object.keys(UNITS);
}

/**
 * Look up the dimension of a unit.
 *
 * @param {string} unit - Unit key
 * @returns {string | null} Dimension name, or null when the unit is unknown
 */
export function dimensionOf(unit) {
  return UNITS[unit]?.dimension ?? null;
}

/**
 * Report whether a unit belongs to a count dimension.
 *
 * @param {string} unit - Unit key
 * @returns {boolean} True for serving, slice, piece and item
 */
export function isCountUnit(unit) {
  const dimension = dimensionOf(unit);
  return typeof dimension === 'string' && dimension.startsWith('count:');
}

/**
 * Report whether two units can convert into each other.
 *
 * @param {string} from - Source unit
 * @param {string} to - Target unit
 * @returns {boolean} True when both share a dimension
 */
export function canConvert(from, to) {
  const a = dimensionOf(from);
  const b = dimensionOf(to);
  return a !== null && a === b;
}

/**
 * Convert a quantity between two units of one dimension.
 *
 * @param {number} quantity - Amount in the source unit
 * @param {string} from - Source unit
 * @param {string} to - Target unit
 * @returns {number | null} Converted amount, or null when conversion is impossible
 */
export function convert(quantity, from, to) {
  const amount = Number(quantity);
  if (!Number.isFinite(amount)) return null;
  if (!canConvert(from, to)) return null;
  if (from === to) return amount;
  return (amount * UNITS[from].factor) / UNITS[to].factor;
}

/**
 * Convert a quantity into its dimension's base unit.
 *
 * @param {number} quantity - Amount
 * @param {string} unit - Unit key
 * @returns {number | null} Amount in the base unit
 */
export function toBase(quantity, unit) {
  const amount = Number(quantity);
  if (!Number.isFinite(amount) || !UNITS[unit]) return null;
  return amount * UNITS[unit].factor;
}

/**
 * Report which measuring system a unit belongs to.
 *
 * @param {string} unit - Unit key
 * @returns {string | null} "metric", "imperial", or null for count units
 */
export function systemOf(unit) {
  return SYSTEM[unit] ?? null;
}

/**
 * Choose a readable unit for a total expressed in a dimension's base unit.
 *
 * @param {number} baseAmount - Amount in the base unit
 * @param {string} dimension - Dimension name
 * @param {string} [system='metric'] - Measuring system to report in
 * @returns {{quantity: number, unit: string}} Display quantity and unit
 */
export function pickDisplayUnit(baseAmount, dimension, system = 'metric') {
  const ladders = DISPLAY_LADDER[dimension];
  if (!ladders) {
    // Count dimensions have exactly one unit.
    const unit = Object.keys(UNITS).find((u) => UNITS[u].dimension === dimension);
    return { quantity: baseAmount, unit: unit || 'serving' };
  }

  const ladder = ladders[system] || ladders.metric;

  for (const unit of ladder) {
    const value = baseAmount / UNITS[unit].factor;
    if (value >= 1) {
      return { quantity: value, unit };
    }
  }

  const smallest = ladder[ladder.length - 1];
  return { quantity: baseAmount / UNITS[smallest].factor, unit: smallest };
}

/**
 * Sum quantities that may use different units, grouping by dimension.
 *
 * Mixed mass units collapse into one total. Mass and volume stay apart,
 * because no conversion between them exists without a density.
 *
 * @param {Array<{quantity: number, unit: string}>} entries - Quantities to add
 * @returns {Array<{dimension: string, quantity: number, unit: string}>} One total per dimension
 */
export function sumQuantities(entries) {
  const byDimension = new Map();

  for (const entry of entries) {
    const dimension = dimensionOf(entry?.unit);
    if (dimension === null) continue;

    const base = toBase(entry.quantity, entry.unit);
    if (base === null) continue;

    if (!byDimension.has(dimension)) {
      byDimension.set(dimension, { total: 0, metric: 0, imperial: 0 });
    }

    const bucket = byDimension.get(dimension);
    bucket.total += base;

    // Remember which system the inputs used, so the total is reported the
    // same way round.
    const system = systemOf(entry.unit);
    if (system) bucket[system] += 1;
  }

  return Array.from(byDimension.entries()).map(([dimension, bucket]) => {
    const system = bucket.imperial > bucket.metric ? 'imperial' : 'metric';
    const display = pickDisplayUnit(bucket.total, dimension, system);
    return { dimension, quantity: display.quantity, unit: display.unit };
  });
}

/**
 * Format a quantity for display, trimming trailing zeros.
 *
 * @param {number} quantity - Amount
 * @param {string} unit - Unit key
 * @param {number} [decimals=2] - Maximum decimal places
 * @returns {string} Formatted text such as "1.5 cup"
 */
export function formatQuantity(quantity, unit, decimals = 2) {
  const amount = Number(quantity);
  if (!Number.isFinite(amount)) return '';
  const rounded = Number(amount.toFixed(decimals));
  return `${rounded} ${unit}`;
}
