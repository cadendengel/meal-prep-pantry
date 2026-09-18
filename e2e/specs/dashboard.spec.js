import {
  test, expect, seedMeal, fillAndSettle,
} from '../fixtures.js';

function ingredient(overrides) {
  return {
    id: `ing-${Math.random().toString(36).slice(2)}`,
    name: 'Thing', servingSizeQuantity: 100, servingSizeUnit: 'g',
    servingsPerContainer: 10, caloriesPerServing: 100, proteinPerServing: 10,
    carbsPerServing: 10, fatPerServing: 1, price: 5, servingsUsed: 1,
    productUrl: '', ...overrides,
  };
}

test.describe('dashboard', () => {
  test('shows per-serving macros rather than a blank serving size', async ({
    signedInPage: page, api, account,
  }) => {
    await seedMeal(api, account.token, {
      name: 'Macro Card',
      servingsPerMeal: 2,
      ingredients: [ingredient({ caloriesPerServing: 200, proteinPerServing: 20, servingsUsed: 2 })],
    });

    await page.goto('/dashboard');
    const card = page.locator('.meal-card', { hasText: 'Macro Card' });

    // 200 cal times 2 servings used, divided by 2 servings per meal.
    await expect(card.locator('.meal-macros')).toContainText('200');
    await expect(card.locator('.meal-macros')).toContainText('20');
    await expect(card).toContainText('per serving');
    // The old card printed a stray leading space from a null serving size.
    await expect(card).not.toContainText('null');
  });

  test('says "1 ingredient", not "1 ingredients"', async ({
    signedInPage: page, api, account,
  }) => {
    await seedMeal(api, account.token, { name: 'Single', ingredients: [ingredient({})] });
    await page.goto('/dashboard');
    await expect(page.locator('.meal-card', { hasText: 'Single' })).toContainText('1 ingredient');
    await expect(page.locator('.meal-card', { hasText: 'Single' })).not.toContainText('1 ingredients');
  });

  test('searches, sorts and filters', async ({ signedInPage: page, api, account }) => {
    await seedMeal(api, account.token, {
      name: 'Low Protein Meal', servingsPerMeal: 1,
      ingredients: [ingredient({ proteinPerServing: 2, caloriesPerServing: 50, servingsUsed: 1 })],
    });
    await seedMeal(api, account.token, {
      name: 'High Protein Meal', servingsPerMeal: 1,
      ingredients: [ingredient({ proteinPerServing: 40, caloriesPerServing: 400, servingsUsed: 1 })],
    });

    await page.goto('/dashboard');
    await expect(page.locator('.meal-card')).toHaveCount(2);

    await fillAndSettle(page.getByLabel('Search meals'), 'high');
    await expect(page.locator('.meal-card')).toHaveCount(1);
    await fillAndSettle(page.getByLabel('Search meals'), '');

    await page.getByLabel('High protein only (30g+)').check();
    await expect(page.locator('.meal-card')).toHaveCount(1);
    await expect(page.locator('.meal-card').first()).toContainText('High Protein Meal');
    await page.getByLabel('High protein only (30g+)').uncheck();

    await page.getByLabel('Sort by').selectOption('protein');
    const names = await page.locator('.meal-card h3').allInnerTexts();
    expect(names[0]).toBe('High Protein Meal');

    await page.getByLabel('Sort by').selectOption('name');
    const byName = await page.locator('.meal-card h3').allInnerTexts();
    expect(byName).toEqual([...byName].sort());
  });

  test('duplicates a meal', async ({ signedInPage: page, api, account }) => {
    await seedMeal(api, account.token, { name: 'Original' });
    await page.goto('/dashboard');

    await page.getByRole('button', { name: 'Duplicate' }).click();
    await expect(page.getByText(/Created Original \(copy\)/)).toBeVisible();
    await expect(page.locator('.meal-card')).toHaveCount(2);
    await expect(page.locator('.meal-card', { hasText: 'Original (copy)' })).toBeVisible();
  });

  test('deletes only after confirmation', async ({ signedInPage: page, api, account }) => {
    await seedMeal(api, account.token, { name: 'Doomed' });
    await page.goto('/dashboard');

    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Keep editing' }).or(
      page.getByRole('button', { name: 'Cancel' })).click();
    await expect(page.locator('.meal-card')).toHaveCount(1);

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('No meals yet')).toBeVisible();
  });

  test('shows the share of the protein goal once a target is set', async ({
    signedInPage: page, api, account,
  }) => {
    await api.put('/api/user/profile', {
      headers: { authorization: `Bearer ${account.token}` },
      data: { targets: { protein: 100 } },
    });
    await seedMeal(api, account.token, {
      name: 'Goal Meal', servingsPerMeal: 1,
      ingredients: [ingredient({ proteinPerServing: 25, servingsUsed: 1 })],
    });

    await page.goto('/dashboard');
    await expect(page.locator('.meal-card', { hasText: 'Goal Meal' }))
      .toContainText('25% of protein goal');
  });
});
