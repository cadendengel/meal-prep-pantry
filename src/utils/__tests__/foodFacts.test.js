import { describe, it, expect } from 'vitest';
import { isPlausibleBarcode, parseServingSize, toIngredient } from '../foodFacts.js';

describe('isPlausibleBarcode', () => {
  it('accepts 8 to 14 digits', () => {
    expect(isPlausibleBarcode('12345678')).toBe(true);
    expect(isPlausibleBarcode('0123456789012')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isPlausibleBarcode('1234567')).toBe(false);
    expect(isPlausibleBarcode('123456789012345')).toBe(false);
    expect(isPlausibleBarcode('abc')).toBe(false);
    expect(isPlausibleBarcode('')).toBe(false);
    expect(isPlausibleBarcode(null)).toBe(false);
  });
});

describe('parseServingSize', () => {
  it('reads a plain gram size', () => {
    expect(parseServingSize('55 g')).toEqual({ quantity: 55, unit: 'g' });
  });

  it('reads the leading unit of a compound size', () => {
    expect(parseServingSize('1 cup (240ml)')).toEqual({ quantity: 1, unit: 'cup' });
  });

  it('normalizes kilograms to grams', () => {
    expect(parseServingSize('0.5 kg')).toEqual({ quantity: 500, unit: 'g' });
  });

  it('normalizes milligrams to grams', () => {
    expect(parseServingSize('500 mg')).toEqual({ quantity: 0.5, unit: 'g' });
  });

  it('returns nulls when nothing parses', () => {
    expect(parseServingSize('one scoop')).toEqual({ quantity: null, unit: null });
    expect(parseServingSize('')).toEqual({ quantity: null, unit: null });
    expect(parseServingSize(null)).toEqual({ quantity: null, unit: null });
  });
});

describe('toIngredient', () => {
  it('prefers per-serving values when the product has them', () => {
    const result = toIngredient({
      product_name: 'Greek Yogurt', brands: 'Chobani, Inc', code: '123', serving_size: '170 g',
      nutriments: {
        'energy-kcal_serving': 120, proteins_serving: 16, carbohydrates_serving: 7, fat_serving: 0,
        'energy-kcal_100g': 71,
      },
    });
    expect(result.perServingSource).toBe('serving');
    expect(result.caloriesPerServing).toBe(120);
    expect(result.servingSizeQuantity).toBe(170);
    expect(result.servingSizeUnit).toBe('g');
  });

  it('falls back to per-100g and says so', () => {
    const result = toIngredient({
      product_name: 'Oats', brands: 'Quaker', code: '456',
      nutriments: { 'energy-kcal_100g': 389, proteins_100g: 16.9, carbohydrates_100g: 66.3, fat_100g: 6.9 },
    });
    expect(result.perServingSource).toBe('100g');
    expect(result.servingSizeQuantity).toBe(100);
    expect(result.caloriesPerServing).toBe(389);
  });

  it('keeps only the first brand', () => {
    expect(toIngredient({ product_name: 'X', brands: 'Alpha, Beta', nutriments: {} }).brand).toBe('Alpha');
  });

  it('returns nulls rather than NaN for missing nutriments', () => {
    const result = toIngredient({ product_name: 'Mystery', nutriments: {} });
    expect(result.caloriesPerServing).toBeNull();
    expect(result.proteinPerServing).toBeNull();
  });

  it('tolerates a completely empty product', () => {
    expect(() => toIngredient({})).not.toThrow();
    expect(toIngredient({}).name).toBe('');
  });
});
