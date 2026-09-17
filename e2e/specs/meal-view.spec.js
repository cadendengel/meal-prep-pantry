import { test, expect, seedMeal } from '../fixtures.js';

function ingredient(overrides) {
  return {
    id: `ing-${Math.random().toString(36).slice(2)}`,
    name: 'Thing', servingSizeQuantity: 100, servingSizeUnit: 'g',
    servingsPerContainer: 10, caloriesPerServing: 100, proteinPerServing: 10,
    carbsPerServing: 10, fatPerServing: 1, price: 5, servingsUsed: 1,
    productUrl: '', ...overrides,
  };
}

test.describe('meal view', () => {
  test('totals macros per meal and per serving', async ({ signedInPage: page, api, account }) => {
    const meal = await seedMeal(api, account.token, {
      name: 'Totals Meal',
      servingsPerMeal: 4,
      ingredients: [ingredient({ caloriesPerServing: 200, proteinPerServing: 20, servingsUsed: 2 })],
    });

    await page.goto(`/meal/${meal.id}`);

    const mealTotals = page.locator('.totals-section', { hasText: 'Meal Totals' });
    await expect(mealTotals).toContainText('400.0');

    const perServing = page.locator('.totals-section').filter({
      has: page.getByRole('heading', { level: 4, name: /^Per Serving/ }),
    });
    await expect(perServing).toContainText('100.0');
  });

  test('compares against daily targets when they are set', async ({
    signedInPage: page, api, account,
  }) => {
    await api.put('/api/user/profile', {
      headers: { authorization: `Bearer ${account.token}` },
      data: { targets: { calories: 2000, protein: 100 } },
    });
    const meal = await seedMeal(api, account.token, {
      name: 'Target Meal', servingsPerMeal: 1,
      ingredients: [ingredient({ caloriesPerServing: 500, proteinPerServing: 25, servingsUsed: 1 })],
    });

    await page.goto(`/meal/${meal.id}`);
    const goals = page.locator('.totals-section', { hasText: 'Against your daily goals' });
    await expect(goals).toContainText('25%');
    await expect(goals).toContainText('(500 of 2000)');
  });

  test('hides the targets section when no target is set', async ({
    signedInPage: page, api, account,
  }) => {
    const meal = await seedMeal(api, account.token, { name: 'No Targets' });
    await page.goto(`/meal/${meal.id}`);
    await expect(page.getByText('Against your daily goals')).toHaveCount(0);
  });

  test('shows per-100g figures only when asked', async ({ signedInPage: page, api, account }) => {
    const meal = await seedMeal(api, account.token, {
      name: 'Per Hundred',
      ingredients: [ingredient({
        name: 'Dense Thing', servingSizeQuantity: 50, servingSizeUnit: 'g',
        caloriesPerServing: 100, servingsUsed: 1,
      })],
    });

    await page.goto(`/meal/${meal.id}`);
    // Scoped to the table: the toggle's own label also says "per 100 g".
    await expect(page.locator('.ingredients-table')).not.toContainText('per 100 g');

    await page.getByLabel(/Show per 100 g/).check();
    // 100 cal per 50 g is 200 cal per 100 g.
    await expect(page.locator('.ingredients-table')).toContainText('200 per 100 g');
  });

  test('omits the serving size row when there is nothing to show', async ({
    signedInPage: page, api, account,
  }) => {
    const meal = await seedMeal(api, account.token, {
      name: 'No Serving Size',
      ingredients: [ingredient({ servingSizeQuantity: null, servingSizeUnit: 'serving' })],
    });

    await page.goto(`/meal/${meal.id}`);
    // The old view printed "Serving Size:" with a blank value beside it.
    await expect(page.locator('.meal-info')).not.toContainText('Serving Size:');
    await expect(page.locator('.meal-info')).toContainText('Servings Per Meal:');
  });

  test('never renders a javascript: link, even from stored data', async ({
    signedInPage: page, api, account,
  }) => {
    const meal = await seedMeal(api, account.token, {
      name: 'Legacy Link View',
      ingredients: [
        ingredient({ name: 'Safe One', productUrl: 'https://www.heb.com/safe' }),
        ingredient({ name: 'Legacy One', productUrl: '' }),
      ],
    });

    // The API rejects an unsafe URL, so it cannot be stored through the
    // front door. A record written before that validation existed still
    // could hold one, which is what the render-time guard is for.
    await page.route('**/api/meal?*', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const response = await route.fetch();
      const body = await response.json();
      for (const ing of body.meal?.ingredients || []) {
        if (ing.name === 'Legacy One') ing.productUrl = 'javascript:alert(1)';
      }
      await route.fulfill({ response, json: body });
    });

    await page.goto(`/meal/${meal.id}`);
    await expect(page.locator('.ingredients-table')).toContainText('Legacy One');

    // The safe row links; the unsafe row does not.
    const rows = page.locator('.ingredients-table tbody tr');
    await expect(rows.filter({ hasText: 'Safe One' }).getByRole('link')).toHaveCount(1);
    await expect(rows.filter({ hasText: 'Legacy One' }).getByRole('link')).toHaveCount(0);

    expect(await page.locator('a[href^="javascript:"]').count()).toBe(0);
  });

  test('reports a missing meal instead of failing silently', async ({ signedInPage: page }) => {
    await page.goto('/meal/507f1f77bcf86cd799439011');
    await expect(page.getByText(/Meal not found/i)).toBeVisible();
    await page.getByRole('button', { name: 'Back to Dashboard' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('exports the meal as a CSV download', async ({ signedInPage: page, api, account }) => {
    const meal = await seedMeal(api, account.token, { name: 'Export Meal' });
    await page.goto(`/meal/${meal.id}`);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/export-meal-\d{4}-\d{2}-\d{2}\.csv$/);

    const stream = await download.createReadStream();
    const content = await new Promise((resolve, reject) => {
      let text = '';
      stream.on('data', (c) => { text += c; });
      stream.on('end', () => resolve(text));
      stream.on('error', reject);
    });

    expect(content).toContain('Meal,Servings Per Meal,Ingredient');
    expect(content).toContain('Export Meal');
    expect(content).toContain('E2E Peanut Butter');
  });
});
