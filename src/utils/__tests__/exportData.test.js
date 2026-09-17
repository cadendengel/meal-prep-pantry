import { describe, it, expect } from 'vitest';
import { mealsToCsv, mealsToJson, datedFilename } from '../exportData.js';

const meal = {
  name: 'Bowl, Big',
  servingsPerMeal: 4,
  notes: 'weeknight',
  userId: 'should-not-appear',
  ingredients: [
    { name: 'Rice "jasmine"', servingSizeQuantity: 100, servingSizeUnit: 'g', servingsUsed: 2,
      caloriesPerServing: 130, proteinPerServing: 2.7, carbsPerServing: 28, fatPerServing: 0.3,
      price: 3.5, productUrl: 'https://heb.com/r', notes: '' },
  ],
};

describe('mealsToCsv', () => {
  it('writes a header row', () => {
    expect(mealsToCsv([]).split('\n')[0]).toContain('Meal,Servings Per Meal,Ingredient');
  });

  it('quotes a field containing a comma', () => {
    expect(mealsToCsv([meal])).toContain('"Bowl, Big"');
  });

  it('doubles inner quotes', () => {
    expect(mealsToCsv([meal])).toContain('"Rice ""jasmine"""');
  });

  it('quotes a field containing a newline', () => {
    const withNewline = { ...meal, ingredients: [{ name: 'Line\nbreak', servingsUsed: 1 }] };
    expect(mealsToCsv([withNewline])).toContain('"Line\nbreak"');
  });

  it('multiplies macros by servings used', () => {
    const row = mealsToCsv([meal]).split('\n')[1];
    expect(row).toContain('260.0');
  });

  it('emits a placeholder row for a meal with no ingredients', () => {
    const csv = mealsToCsv([{ name: 'Empty', servingsPerMeal: 1, ingredients: [] }]);
    expect(csv).toContain('(no ingredients)');
  });

  it('tolerates a missing ingredients array', () => {
    expect(() => mealsToCsv([{ name: 'X', servingsPerMeal: 1 }])).not.toThrow();
  });
});

describe('mealsToJson', () => {
  it('includes a count and a timestamp', () => {
    const parsed = JSON.parse(mealsToJson([meal]));
    expect(parsed.mealCount).toBe(1);
    expect(typeof parsed.exportedAt).toBe('string');
  });

  it('strips the internal userId', () => {
    const parsed = JSON.parse(mealsToJson([meal]));
    expect(parsed.meals[0]).not.toHaveProperty('userId');
    expect(parsed.meals[0].name).toBe('Bowl, Big');
  });
});

describe('datedFilename', () => {
  it('appends an ISO date and the extension', () => {
    expect(datedFilename('meals', 'csv')).toMatch(/^meals-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
