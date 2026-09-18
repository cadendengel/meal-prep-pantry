import {
  test, expect, seedMeal, seedPantryItem, fillAndSettle,
} from '../fixtures.js';

test.describe('unsaved changes', () => {
  test('warns before leaving a meal with edits', async ({ signedInPage: page }) => {
    await page.goto('/meal/new');
    await fillAndSettle(page.getByLabel('Meal Name'), 'Half Finished');

    await page.getByRole('button', { name: 'Cancel' }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/have not saved/i);

    // Choosing to stay keeps both the page and the typed value.
    await page.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page).toHaveURL(/\/meal\/new$/);
    await expect(page.getByLabel('Meal Name')).toHaveValue('Half Finished');
  });

  test('leaves when the warning is accepted', async ({ signedInPage: page }) => {
    await page.goto('/meal/new');
    await fillAndSettle(page.getByLabel('Meal Name'), 'Abandoned');

    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'Discard and leave' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('does not warn when nothing was changed', async ({ signedInPage: page }) => {
    await page.goto('/meal/new');
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Straight out, no dialog.
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });

  test('does not warn after a successful save', async ({ signedInPage: page, api, account }) => {
    await seedPantryItem(api, account.token);
    await page.goto('/meal/new');
    await fillAndSettle(page.getByLabel('Meal Name'), 'Saved Then Left');
    await fillAndSettle(page.getByLabel('Servings Per Meal'), '2');

    await page.getByRole('button', { name: 'Save Meal' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    // Saving clears the dirty state, so no prompt appeared on the way out.
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });

  test('registers a beforeunload guard while dirty', async ({ signedInPage: page }) => {
    await page.goto('/meal/new');

    const before = await page.evaluate(() => {
      let registered = false;
      const original = window.addEventListener;
      window.addEventListener = function (type, ...rest) {
        if (type === 'beforeunload') registered = true;
        return original.call(this, type, ...rest);
      };
      window.__checkRegistered = () => registered;
      return true;
    });
    expect(before).toBe(true);

    await fillAndSettle(page.getByLabel('Meal Name'), 'Dirty Now');
    // The effect runs on the change, so the listener is added by now.
    await expect
      .poll(() => page.evaluate(() => window.__checkRegistered()))
      .toBe(true);
  });

  test('warns when editing an existing meal too', async ({ signedInPage: page, api, account }) => {
    const meal = await seedMeal(api, account.token, { name: 'Existing' });
    await page.goto(`/meal/${meal.id}/edit`);

    await fillAndSettle(page.getByLabel('Meal Name'), 'Existing Edited');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
  });
});
