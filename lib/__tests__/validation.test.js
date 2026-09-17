import { describe, it, expect } from 'vitest';
import {
  isSafeHttpUrl,
  findInvalidIngredientUrl,
  validateMealPayload,
  buildMealFields,
} from '../validation.js';

describe('isSafeHttpUrl', () => {
  it('accepts http and https URLs with a host', () => {
    expect(isSafeHttpUrl('https://heb.com/p/1')).toBe(true);
    expect(isSafeHttpUrl('http://localhost:3000/x')).toBe(true);
  });

  it('rejects the schemes that parse but are not links', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeHttpUrl('vbscript:msgbox(1)')).toBe(false);
    expect(isSafeHttpUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isSafeHttpUrl('https:')).toBe(false);
    expect(isSafeHttpUrl('nonsense')).toBe(false);
    expect(isSafeHttpUrl('')).toBe(false);
    expect(isSafeHttpUrl(null)).toBe(false);
  });
});

describe('findInvalidIngredientUrl', () => {
  it('passes a list with no URLs', () => {
    expect(findInvalidIngredientUrl([{ name: 'salt' }])).toBeNull();
  });

  it('passes a list with valid URLs', () => {
    expect(findInvalidIngredientUrl([{ name: 'rice', productUrl: 'https://heb.com/x' }])).toBeNull();
  });

  it('ignores a blank URL', () => {
    expect(findInvalidIngredientUrl([{ name: 'rice', productUrl: '   ' }])).toBeNull();
  });

  it('names the offending ingredient', () => {
    const message = findInvalidIngredientUrl([
      { name: 'rice', productUrl: 'https://heb.com/x' },
      { name: 'chicken', productUrl: 'javascript:alert(1)' },
    ]);
    expect(message).toBe('Invalid URL for ingredient: chicken');
  });

  it('handles an unnamed ingredient', () => {
    expect(findInvalidIngredientUrl([{ productUrl: 'javascript:alert(1)' }]))
      .toBe('Invalid URL for ingredient: unnamed');
  });

  it('tolerates a non-array value', () => {
    expect(findInvalidIngredientUrl(undefined)).toBeNull();
    expect(findInvalidIngredientUrl(null)).toBeNull();
  });
});

describe('validateMealPayload', () => {
  const valid = { name: 'Chicken Bowl', servingsPerMeal: 4, ingredients: [] };

  it('accepts a valid payload', () => {
    expect(validateMealPayload(valid)).toBeNull();
  });

  it('rejects a missing body', () => {
    expect(validateMealPayload(null)).toBe('Meal data is required');
  });

  it('rejects a blank or missing name', () => {
    expect(validateMealPayload({ ...valid, name: '   ' })).toBe('Meal name is required');
    expect(validateMealPayload({ ...valid, name: undefined })).toBe('Meal name is required');
  });

  it('rejects a non-string name', () => {
    expect(validateMealPayload({ ...valid, name: 42 })).toBe('Meal name is required');
  });

  it('rejects servingsPerMeal that is zero, negative or missing', () => {
    const message = 'Servings per meal must be greater than 0';
    expect(validateMealPayload({ ...valid, servingsPerMeal: 0 })).toBe(message);
    expect(validateMealPayload({ ...valid, servingsPerMeal: -2 })).toBe(message);
    expect(validateMealPayload({ ...valid, servingsPerMeal: null })).toBe(message);
  });

  it('rejects an unsafe ingredient URL', () => {
    expect(validateMealPayload({
      ...valid,
      ingredients: [{ name: 'rice', productUrl: 'javascript:alert(1)' }],
    })).toBe('Invalid URL for ingredient: rice');
  });
});

describe('buildMealFields', () => {
  it('trims the name and applies defaults', () => {
    const fields = buildMealFields({ name: '  Bowl  ', servingsPerMeal: 2 });
    expect(fields.name).toBe('Bowl');
    expect(fields.notes).toBe('');
    expect(fields.servingSize).toBeNull();
    expect(fields.servingUnit).toBe('g');
    expect(fields.ingredients).toEqual([]);
    expect(typeof fields.updatedAt).toBe('string');
  });

  it('keeps a servingSize of 0 instead of nulling it', () => {
    expect(buildMealFields({ name: 'x', servingsPerMeal: 1, servingSize: 0 }).servingSize).toBe(0);
  });

  it('never carries client-supplied ownership fields', () => {
    const fields = buildMealFields({
      name: 'x',
      servingsPerMeal: 1,
      userId: 'someone-else',
      _id: 'forged',
      createdAt: '1999-01-01',
    });
    expect(fields).not.toHaveProperty('userId');
    expect(fields).not.toHaveProperty('_id');
    expect(fields).not.toHaveProperty('createdAt');
  });

  it('replaces a non-array ingredients value with an empty list', () => {
    expect(buildMealFields({ name: 'x', servingsPerMeal: 1, ingredients: 'bad' }).ingredients).toEqual([]);
  });
});
