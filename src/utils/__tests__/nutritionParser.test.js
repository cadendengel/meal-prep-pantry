import { describe, it, expect } from 'vitest';
import {
  getStoreFromUrl,
  parseNutritionLabel,
  hasValidNutritionData,
  formatNutritionSummary,
} from '../nutritionParser.js';

const FULL_LABEL = `Nutrition Facts
Serving size 1 cup (240g)
Servings Per Container 4
Calories 150
Total Fat 8g
Saturated Fat 1.5g
Trans Fat 0g
Total Carbohydrate 30g
Dietary Fiber 2g
Total Sugars 12g
Protein 9g`;

describe('getStoreFromUrl', () => {
  it('names a known store from an exact host', () => {
    expect(getStoreFromUrl('https://heb.com/product/1')).toBe('HEB');
  });

  it('strips a www prefix', () => {
    expect(getStoreFromUrl('https://www.amazon.com/dp/B000')).toBe('Amazon');
  });

  it('matches a subdomain of a known store', () => {
    expect(getStoreFromUrl('https://smile.amazon.com/dp/B000')).toBe('Amazon');
  });

  it('does not match a look-alike host that merely contains the domain', () => {
    expect(getStoreFromUrl('https://evil-amazon.com.attacker.net/x')).not.toBe('Amazon');
  });

  it('rejects a javascript: URL instead of naming a store', () => {
    expect(getStoreFromUrl('javascript:alert(1)')).toBeNull();
  });

  it('rejects a data: URL', () => {
    expect(getStoreFromUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('rejects a non-http scheme', () => {
    expect(getStoreFromUrl('ftp://files.example.com/x')).toBeNull();
  });

  it('falls back to the capitalized first label for an unknown store', () => {
    expect(getStoreFromUrl('https://www.mygrocer.net/item')).toBe('Mygrocer');
  });

  it('returns null for empty and non-string input', () => {
    expect(getStoreFromUrl('')).toBeNull();
    expect(getStoreFromUrl(null)).toBeNull();
    expect(getStoreFromUrl(42)).toBeNull();
  });

  it('returns null for an unparseable string', () => {
    expect(getStoreFromUrl('not a url at all')).toBeNull();
  });
});

describe('parseNutritionLabel', () => {
  it('extracts every field from a standard label', () => {
    const result = parseNutritionLabel(FULL_LABEL);
    expect(result.servingSize).toBe('1 cup (240g)');
    expect(result.servingSizeQuantity).toBe(1);
    expect(result.servingSizeUnit).toBe('cup');
    expect(result.servingsPerContainer).toBe(4);
    expect(result.calories).toBe(150);
    expect(result.fat).toBe(8);
    expect(result.carbs).toBe(30);
    expect(result.protein).toBe(9);
  });

  it('does not report saturated fat as total fat', () => {
    const result = parseNutritionLabel('Calories 150\nSaturated Fat 1.5g\nProtein 9g');
    expect(result.fat).not.toBe(1.5);
  });

  it('does not report trans fat as total fat', () => {
    const result = parseNutritionLabel('Calories 150\nTrans Fat 3g\nProtein 9g');
    expect(result.fat).not.toBe(3);
  });

  it('still reads an unqualified Fat line', () => {
    const result = parseNutritionLabel('Calories 100\nFat 5g\nProtein 2g');
    expect(result.fat).toBe(5);
  });

  it('prefers Total Fat over the saturated line that follows it', () => {
    const result = parseNutritionLabel('Total Fat 12g\nSaturated Fat 2g');
    expect(result.fat).toBe(12);
  });

  it('prefers Total Carbohydrate over fiber and sugar lines', () => {
    const result = parseNutritionLabel('Total Carbohydrate 27g\nDietary Fiber 4g\nTotal Sugars 1g');
    expect(result.carbs).toBe(27);
  });

  it('parses a fractional serving size', () => {
    const result = parseNutritionLabel('Serving size 1/2 cup\nCalories 80');
    expect(result.servingSizeQuantity).toBe(0.5);
    expect(result.servingSizeUnit).toBe('cup');
  });

  it('parses a decimal serving size in grams', () => {
    const result = parseNutritionLabel('Serving size 62.5 g\nCalories 80');
    expect(result.servingSizeQuantity).toBe(62.5);
    expect(result.servingSizeUnit).toBe('g');
  });

  it('normalizes liter spellings', () => {
    expect(parseNutritionLabel('Serving size 1 liter').servingSizeUnit).toBe('l');
    expect(parseNutritionLabel('Serving size 2 ml').servingSizeUnit).toBe('ml');
  });

  it('reads "about N servings" for servings per container', () => {
    const result = parseNutritionLabel('about 3.5 servings per container\nCalories 90');
    expect(result.servingsPerContainer).toBe(3.5);
  });

  it('returns all-null for text with no nutrition data', () => {
    const result = parseNutritionLabel('Ingredients: water, salt, natural flavor.');
    expect(result.calories).toBeNull();
    expect(result.protein).toBeNull();
    expect(result.carbs).toBeNull();
    expect(result.fat).toBeNull();
  });

  it('handles a single-line OCR result with no newlines', () => {
    const result = parseNutritionLabel('Calories 210 Total Fat 11g Total Carbohydrate 22g Protein 5g');
    expect(result.calories).toBe(210);
    expect(result.fat).toBe(11);
    expect(result.carbs).toBe(22);
    expect(result.protein).toBe(5);
  });
});

describe('hasValidNutritionData', () => {
  it('is true when one macro is present', () => {
    expect(hasValidNutritionData(parseNutritionLabel('Calories 100'))).toBe(true);
  });

  it('is false when no macro is present', () => {
    expect(hasValidNutritionData(parseNutritionLabel('Ingredients: water'))).toBe(false);
  });
});

describe('formatNutritionSummary', () => {
  it('lists every field it was given', () => {
    const summary = formatNutritionSummary(parseNutritionLabel(FULL_LABEL));
    expect(summary).toContain('150 cal per serving');
    expect(summary).toContain('9g protein');
    expect(summary).toContain('30g carbs');
    expect(summary).toContain('8g fat');
  });

  it('returns an empty string when nothing was parsed', () => {
    expect(formatNutritionSummary(parseNutritionLabel('nothing here'))).toBe('');
  });
});
