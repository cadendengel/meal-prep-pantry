import { test, expect, seedMeal, seedPantryItem } from '../fixtures.js';

/**
 * Narrow-screen behaviour. Runs under the "mobile" project, at iPhone size.
 *
 * Scanning a label happens in a kitchen or a shop, on a phone, so this is
 * not a secondary case. The nine-column ingredient table cannot fit, and
 * used to overflow the viewport.
 */
test.describe('mobile layout', () => {
  test('replaces the ingredient table with cards', async ({ signedInPage: page, api, account }) => {
    const meal = await seedMeal(api, account.token, { name: 'Mobile Meal' });
    await page.goto(`/meal/${meal.id}`);

    await expect(page.locator('.ingredients-table')).toBeHidden();
    await expect(page.locator('.ingredient-cards')).toBeVisible();
    await expect(page.locator('.ingredient-card').first()).toContainText('E2E Peanut Butter');
  });

  test('never scrolls sideways', async ({ signedInPage: page, api, account }) => {
    const meal = await seedMeal(api, account.token, { name: 'Overflow Check' });
    await seedPantryItem(api, account.token);

    for (const route of ['/dashboard', '/pantry', '/shopping-list', '/settings', `/meal/${meal.id}`, '/meal/new']) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(
        overflow.scrollWidth,
        `${route} overflows: ${overflow.scrollWidth} > ${overflow.innerWidth}`
      ).toBeLessThanOrEqual(overflow.innerWidth + 1);
    }
  });

  test('collapses the navigation behind a toggle', async ({ signedInPage: page }) => {
    await page.goto('/dashboard');

    const toggle = page.locator('.nav-toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    const pantryLink = page.getByRole('link', { name: 'Pantry' });
    await expect(pantryLink).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(pantryLink).toBeVisible();

    await pantryLink.click();
    await expect(page).toHaveURL(/\/pantry$/);
  });

  test('still saves a meal on a phone', async ({ signedInPage: page, api, account }) => {
    await seedPantryItem(api, account.token);
    await page.goto('/meal/new');

    await page.getByLabel('Meal Name').fill('Phone Meal');
    await page.getByLabel('Servings Per Meal').fill('2');
    await page.getByRole('button', { name: 'Add from pantry' }).click();
    await page.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: /Add 1 to meal/ }).click();
    await page.getByLabel('Amount used (g)').fill('45');

    const save = page.waitForResponse(
      (r) => r.url().includes('/api/meals') && r.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Save Meal' }).click();
    expect((await save).status()).toBe(201);
  });
});
