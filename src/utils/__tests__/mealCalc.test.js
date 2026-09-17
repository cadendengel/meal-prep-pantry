import { describe, it, expect } from 'vitest';
import {
  macroTotal,
  calculateIngredientTotals,
  calculateMealServingSize,
  isSafeHttpUrl,
  generateId,
} from '../mealCalc.js';

describe('macroTotal', () => {
  it('multiplies two numbers', () => {
    expect(macroTotal(110, 2.5)).toBe(275);
  });

  it('treats null as zero', () => {
    expect(macroTotal(null, 2)).toBe(0);
    expect(macroTotal(110, null)).toBe(0);
  });

  it('treats a missing field as zero rather than NaN', () => {
    expect(macroTotal(undefined, undefined)).toBe(0);
    expect(Number.isNaN(macroTotal(undefined, 3))).toBe(false);
  });

  it('treats a non-numeric string as zero', () => {
    expect(macroTotal('abc', 2)).toBe(0);
  });
});

describe('calculateIngredientTotals', () => {
  it('totals a complete ingredient', () => {
    const totals = calculateIngredientTotals({
      caloriesPerServing: 100,
      proteinPerServing: 10,
      carbsPerServing: 20,
      fatPerServing: 5,
      servingsUsed: 2,
    });
    expect(totals).toEqual({ calories: 200, protein: 20, carbs: 40, fat: 10 });
  });

  it('returns zeros for an ingredient missing every macro', () => {
    expect(calculateIngredientTotals({})).toEqual({
      calories: 0, protein: 0, carbs: 0, fat: 0,
    });
  });

  it('returns zeros for null input', () => {
    expect(calculateIngredientTotals(null)).toEqual({
      calories: 0, protein: 0, carbs: 0, fat: 0,
    });
  });
});

describe('calculateMealServingSize', () => {
  it('returns null when servingsPerMeal is missing or not positive', () => {
    expect(calculateMealServingSize([], 0)).toBeNull();
    expect(calculateMealServingSize([], null)).toBeNull();
    expect(calculateMealServingSize([], -1)).toBeNull();
  });

  it('returns null when no ingredient carries a quantity', () => {
    expect(calculateMealServingSize([{ name: 'salt' }], 4)).toBeNull();
  });

  it('divides one unit across the servings', () => {
    const result = calculateMealServingSize(
      [{ servingSizeQuantity: 100, servingSizeUnit: 'g', servingsUsed: 4 }],
      4
    );
    expect(result.totals.g).toBe(400);
    expect(result.perServing.g).toBe(100);
    expect(result.hasMultipleUnits).toBe(false);
  });

  it('groups separate units and flags the mix', () => {
    const result = calculateMealServingSize(
      [
        { servingSizeQuantity: 100, servingSizeUnit: 'g', servingsUsed: 2 },
        { servingSizeQuantity: 1, servingSizeUnit: 'cup', servingsUsed: 3 },
      ],
      2
    );
    expect(result.totals).toEqual({ g: 200, cup: 3 });
    expect(result.perServing).toEqual({ g: 100, cup: 1.5 });
    expect(result.hasMultipleUnits).toBe(true);
  });

  it('defaults a missing unit to "serving"', () => {
    const result = calculateMealServingSize(
      [{ servingSizeQuantity: 2, servingsUsed: 1 }],
      1
    );
    expect(result.perServing.serving).toBe(2);
  });

  it('counts a missing servingsUsed as zero', () => {
    const result = calculateMealServingSize(
      [{ servingSizeQuantity: 100, servingSizeUnit: 'g' }],
      2
    );
    expect(result.perServing.g).toBe(0);
  });

  it('returns null for a non-array ingredient list', () => {
    expect(calculateMealServingSize(undefined, 2)).toBeNull();
  });
});

describe('isSafeHttpUrl', () => {
  it('accepts http and https', () => {
    expect(isSafeHttpUrl('http://example.com')).toBe(true);
    expect(isSafeHttpUrl('https://example.com/a?b=c')).toBe(true);
  });

  it('rejects javascript and data URLs', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('data:text/html,x')).toBe(false);
  });

  it('rejects a scheme with no host', () => {
    expect(isSafeHttpUrl('https:')).toBe(false);
  });

  it('rejects empty and non-string input', () => {
    expect(isSafeHttpUrl('')).toBe(false);
    expect(isSafeHttpUrl(null)).toBe(false);
    expect(isSafeHttpUrl(undefined)).toBe(false);
  });

  it('rejects a bare domain with no scheme', () => {
    expect(isSafeHttpUrl('example.com')).toBe(false);
  });
});

describe('generateId', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateId()).toBe('string');
    expect(generateId().length).toBeGreaterThan(0);
  });

  it('does not collide across many rapid calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, generateId));
    expect(ids.size).toBe(1000);
  });
});
