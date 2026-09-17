import { describe, it, expect } from 'vitest';
import {
  convert, canConvert, dimensionOf, isCountUnit, toBase, systemOf,
  pickDisplayUnit, sumQuantities, formatQuantity, listUnits, MASS, VOLUME,
} from '../units.js';

describe('dimensions', () => {
  it('groups mass units together', () => {
    expect(dimensionOf('g')).toBe(MASS);
    expect(dimensionOf('oz')).toBe(MASS);
    expect(dimensionOf('lb')).toBe(MASS);
  });

  it('groups volume units together', () => {
    for (const unit of ['ml', 'l', 'cup', 'tbsp', 'tsp']) {
      expect(dimensionOf(unit)).toBe(VOLUME);
    }
  });

  it('gives each count unit its own dimension', () => {
    expect(dimensionOf('slice')).not.toBe(dimensionOf('piece'));
    expect(isCountUnit('serving')).toBe(true);
    expect(isCountUnit('g')).toBe(false);
  });

  it('returns null for an unknown unit', () => {
    expect(dimensionOf('furlong')).toBeNull();
  });

  it('lists the units the UI offers', () => {
    expect(listUnits()).toContain('g');
    expect(listUnits()).toContain('cup');
  });
});

describe('convert', () => {
  it('converts within mass', () => {
    expect(convert(1, 'lb', 'g')).toBeCloseTo(453.59237, 5);
    expect(convert(16, 'oz', 'lb')).toBeCloseTo(1, 10);
    expect(convert(1000, 'g', 'g')).toBe(1000);
  });

  it('converts within volume', () => {
    expect(convert(1, 'l', 'ml')).toBe(1000);
    expect(convert(1, 'cup', 'tbsp')).toBeCloseTo(16, 6);
    expect(convert(3, 'tsp', 'tbsp')).toBeCloseTo(1, 6);
  });

  it('refuses to cross dimensions', () => {
    expect(convert(1, 'g', 'ml')).toBeNull();
    expect(convert(1, 'cup', 'oz')).toBeNull();
  });

  it('refuses count units', () => {
    expect(convert(1, 'serving', 'slice')).toBeNull();
    expect(convert(1, 'g', 'serving')).toBeNull();
  });

  it('rejects non-numeric input', () => {
    expect(convert('abc', 'g', 'oz')).toBeNull();
    expect(convert(undefined, 'g', 'oz')).toBeNull();
  });

  it('round-trips without drift', () => {
    const there = convert(250, 'g', 'lb');
    expect(convert(there, 'lb', 'g')).toBeCloseTo(250, 9);
  });
});

describe('canConvert', () => {
  it('is true within a dimension and false across one', () => {
    expect(canConvert('g', 'lb')).toBe(true);
    expect(canConvert('g', 'cup')).toBe(false);
    expect(canConvert('g', 'nonsense')).toBe(false);
  });
});

describe('toBase', () => {
  it('uses grams for mass and millilitres for volume', () => {
    expect(toBase(2, 'lb')).toBeCloseTo(907.18474, 5);
    expect(toBase(2, 'l')).toBe(2000);
  });

  it('returns null for an unknown unit', () => {
    expect(toBase(1, 'furlong')).toBeNull();
  });
});

describe('systemOf', () => {
  it('separates metric from imperial', () => {
    expect(systemOf('g')).toBe('metric');
    expect(systemOf('ml')).toBe('metric');
    expect(systemOf('lb')).toBe('imperial');
    expect(systemOf('cup')).toBe('imperial');
  });

  it('returns null for a count unit', () => {
    expect(systemOf('slice')).toBeNull();
  });
});

describe('pickDisplayUnit', () => {
  it('keeps metric mass in grams', () => {
    expect(pickDisplayUnit(900, MASS, 'metric').unit).toBe('g');
    expect(pickDisplayUnit(5000, MASS, 'metric').quantity).toBe(5000);
  });

  it('picks the largest imperial unit that leaves at least 1', () => {
    expect(pickDisplayUnit(100, MASS, 'imperial').unit).toBe('oz');
    expect(pickDisplayUnit(5000, MASS, 'imperial').unit).toBe('lb');
  });

  it('defaults to metric', () => {
    expect(pickDisplayUnit(900, MASS).unit).toBe('g');
  });

  it('falls back to the smallest unit for a tiny amount', () => {
    expect(pickDisplayUnit(0.5, VOLUME, 'metric').unit).toBe('ml');
    expect(pickDisplayUnit(0.5, VOLUME, 'imperial').unit).toBe('tsp');
  });
});

describe('sumQuantities', () => {
  it('adds mixed mass units into one total', () => {
    const result = sumQuantities([{ quantity: 500, unit: 'g' }, { quantity: 1, unit: 'lb' }]);
    expect(result).toHaveLength(1);
    expect(result[0].dimension).toBe(MASS);
    // One metric entry and one imperial entry. Metric wins the tie.
    expect(result[0].unit).toBe('g');
    expect(result[0].quantity).toBeCloseTo(953.592, 2);
  });

  it('reports a metric total in metric units', () => {
    const result = sumQuantities([{ quantity: 500, unit: 'g' }, { quantity: 300, unit: 'g' }]);
    expect(result[0].unit).toBe('g');
    expect(result[0].quantity).toBe(800);
  });

  it('reports an imperial total in imperial units', () => {
    const result = sumQuantities([{ quantity: 8, unit: 'oz' }, { quantity: 1, unit: 'lb' }]);
    expect(result[0].unit).toBe('lb');
    expect(result[0].quantity).toBeCloseTo(1.5, 6);
  });

  it('follows the majority system when units are mixed', () => {
    const result = sumQuantities([
      { quantity: 500, unit: 'g' }, { quantity: 200, unit: 'g' }, { quantity: 1, unit: 'lb' },
    ]);
    expect(result[0].unit).toBe('g');
  });

  it('keeps mass and volume apart', () => {
    const result = sumQuantities([{ quantity: 100, unit: 'g' }, { quantity: 2, unit: 'cup' }]);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.dimension).sort()).toEqual([MASS, VOLUME]);
  });

  it('keeps different count units apart', () => {
    const result = sumQuantities([{ quantity: 2, unit: 'slice' }, { quantity: 3, unit: 'piece' }]);
    expect(result).toHaveLength(2);
  });

  it('adds the same count unit', () => {
    const result = sumQuantities([{ quantity: 2, unit: 'slice' }, { quantity: 3, unit: 'slice' }]);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(5);
  });

  it('skips unknown units and bad quantities', () => {
    const result = sumQuantities([
      { quantity: 1, unit: 'furlong' },
      { quantity: 'abc', unit: 'g' },
      { quantity: 100, unit: 'g' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].unit).toBe('g');
    expect(result[0].quantity).toBe(100);
  });

  it('returns an empty list for no input', () => {
    expect(sumQuantities([])).toEqual([]);
  });
});

describe('formatQuantity', () => {
  it('trims trailing zeros', () => {
    expect(formatQuantity(1.5, 'cup')).toBe('1.5 cup');
    expect(formatQuantity(2.0, 'g')).toBe('2 g');
    expect(formatQuantity(1.23456, 'g')).toBe('1.23 g');
  });

  it('returns an empty string for a bad number', () => {
    expect(formatQuantity('abc', 'g')).toBe('');
  });
});
