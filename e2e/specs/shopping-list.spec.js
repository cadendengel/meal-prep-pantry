import { test, expect, seedMeal } from '../fixtures.js';

/** Build one ingredient for a seeded meal. */
function ingredient(overrides) {
  return {
    id: `ing-${Math.random().toString(36).slice(2)}`,
    name: 'Thing',
    servingSizeQuantity: 100,
    servingSizeUnit: 'g',
    servingsPerContainer: 10,
    caloriesPerServing: 100,
    proteinPerServing: 10,
    carbsPerServing: 10,
    fatPerServing: 1,
    price: 5,
    servingsUsed: 1,
    productUrl: '',
    ...overrides,
  };
}

test.describe('shopping list', () => {
  test('shows nothing until a meal is chosen', async ({ signedInPage: page, api, account }) => {
    await seedMeal(api, account.token, { name: 'Some Meal' });
    await page.goto('/shopping-list');

    await expect(page.getByText('Select a meal above to build the list')).toBeVisible();
  });

  test('groups by store and keeps unlinked items separate', async ({
    signedInPage: page, api, account,
  }) => {
    await seedMeal(api, account.token, {
      name: 'Store Grouping Meal',
      ingredients: [
        ingredient({ name: 'HEB Rice', productUrl: 'https://www.heb.com/rice' }),
        ingredient({ name: 'Amazon Salt', productUrl: 'https://www.amazon.com/salt' }),
        ingredient({ name: 'Unlinked Herbs', productUrl: '' }),
      ],
    });

    await page.goto('/shopping-list');
    await page.getByRole('checkbox').first().check();

    await expect(page.getByRole('heading', { name: 'HEB' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Amazon' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Other \/ no link/ })).toBeVisible();

    // The unlinked bucket sorts last.
    const headings = await page.locator('main section.form-section h3').allInnerTexts();
    expect(headings[headings.length - 1]).toMatch(/Other \/ no link/);
  });

  test('combines the same ingredient across meals and converts units', async ({
    signedInPage: page, api, account,
  }) => {
    await seedMeal(api, account.token, {
      name: 'Meal One',
      ingredients: [ingredient({
        name: 'Shared Oats', servingSizeQuantity: 100, servingSizeUnit: 'g', servingsUsed: 3,
        productUrl: 'https://www.heb.com/oats',
      })],
    });
    await seedMeal(api, account.token, {
      name: 'Meal Two',
      ingredients: [ingredient({
        name: 'Shared Oats', servingSizeQuantity: 200, servingSizeUnit: 'g', servingsUsed: 1,
        productUrl: 'https://www.heb.com/oats',
      })],
    });

    await page.goto('/shopping-list');
    // .all() takes an immediate snapshot and does not auto-wait, so the
    // list must be known to have rendered before iterating it.
    const boxes = page.locator('.picker-list input[type="checkbox"]');
    await expect(boxes).toHaveCount(2);
    for (const box of await boxes.all()) {
      await box.check();
    }

    // 300 g plus 200 g is one line of 500 g, not two lines.
    const row = page.locator('.shopping-item', { hasText: 'Shared Oats' });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('500 g');
    await expect(row).toContainText('Meal One');
    await expect(row).toContainText('Meal Two');
  });

  test('reports a metric total in metric units', async ({ signedInPage: page, api, account }) => {
    await seedMeal(api, account.token, {
      name: 'Metric Meal',
      ingredients: [ingredient({
        name: 'Metric Flour', servingSizeQuantity: 250, servingSizeUnit: 'g', servingsUsed: 1,
      })],
    });

    await page.goto('/shopping-list');
    await page.getByRole('checkbox').first().check();

    // 250 g must not come back as 8.82 oz.
    await expect(page.locator('.shopping-item', { hasText: 'Metric Flour' })).toContainText('250 g');
  });

  test('prorates cost by the fraction of each container used', async ({
    signedInPage: page, api, account,
  }) => {
    await seedMeal(api, account.token, {
      name: 'Cost Meal',
      ingredients: [ingredient({
        name: 'Costly Thing', price: 10, servingsPerContainer: 4, servingsUsed: 1,
      })],
    });

    await page.goto('/shopping-list');
    await page.getByRole('checkbox').first().check();

    // One of four servings of a $10 container is $2.50.
    await expect(page.locator('.shopping-item', { hasText: 'Costly Thing' })).toContainText('$2.50');
    await expect(page.locator('.macro-totals')).toContainText('$2.50');
  });

  test('ticks an item off without removing it', async ({ signedInPage: page, api, account }) => {
    await seedMeal(api, account.token, { name: 'Tickable' });
    await page.goto('/shopping-list');
    await page.getByRole('checkbox').first().check();

    const item = page.locator('.shopping-item').first();
    await item.getByRole('checkbox').check();
    await expect(item).toHaveClass(/checked/);
    await expect(item).toBeVisible();
  });

  test('the API refuses to store an unsafe product URL', async ({ api, account }) => {
    const response = await api.post('/api/meals', {
      headers: { authorization: `Bearer ${account.token}` },
      data: {
        name: 'Unsafe Meal',
        servingsPerMeal: 1,
        ingredients: [ingredient({ name: 'XSS', productUrl: 'javascript:alert(1)' })],
      },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toMatch(/Invalid URL/i);
  });

  test('never renders a javascript: link, even from stored data', async ({
    signedInPage: page, api, account,
  }) => {
    await seedMeal(api, account.token, {
      name: 'Legacy Link Meal',
      ingredients: [
        ingredient({ name: 'Safe Link', productUrl: 'https://www.heb.com/safe' }),
        ingredient({ name: 'Legacy Unsafe', productUrl: '' }),
      ],
    });

    // The API rejects an unsafe URL, so it cannot be planted through the
    // front door. A record predating that validation still could exist,
    // which is what the render-time guard defends against. The response is
    // rewritten on the way in to reproduce exactly that.
    await page.route('**/api/meals', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const response = await route.fetch();
      const body = await response.json();
      for (const meal of body.meals || []) {
        for (const ing of meal.ingredients || []) {
          if (ing.name === 'Legacy Unsafe') ing.productUrl = 'javascript:alert(1)';
        }
      }
      await route.fulfill({ response, json: body });
    });

    await page.goto('/shopping-list');
    await page.getByRole('checkbox').first().check();

    await expect(page.locator('.shopping-item', { hasText: 'Safe Link' })
      .getByRole('link', { name: 'Open' })).toBeVisible();
    await expect(page.locator('.shopping-item', { hasText: 'Legacy Unsafe' })
      .getByRole('link')).toHaveCount(0);

    expect(await page.locator('a[href^="javascript:"]').count()).toBe(0);
  });
});
