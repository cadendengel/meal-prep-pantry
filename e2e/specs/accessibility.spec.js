import { test, expect, seedMeal, seedPantryItem } from '../fixtures.js';

/**
 * Accessibility regressions.
 *
 * These all describe defects the app actually had: inputs with no
 * associated label, and sortable column headers that were click handlers on
 * bare th elements, so sorting was mouse-only.
 */
test.describe('accessibility', () => {
  test('every visible form control has an accessible name', async ({
    signedInPage: page, api, account,
  }) => {
    await seedPantryItem(api, account.token);

    for (const route of ['/pantry', '/settings', '/meal/new']) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      const unnamed = await page.evaluate(() => {
        const controls = [...document.querySelectorAll('input, select, textarea')];
        return controls
          .filter((el) => el.type !== 'hidden' && el.offsetParent !== null)
          .filter((el) => {
            const byFor = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
            const byWrap = el.closest('label');
            const byAria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
            return !byFor && !byWrap && !byAria;
          })
          .map((el) => ({ tag: el.tagName, type: el.type, id: el.id, name: el.name }));
      });

      expect(unnamed, `unnamed controls on ${route}`).toEqual([]);
    }
  });

  test('ingredient row fields are labelled once expanded', async ({
    signedInPage: page, api, account,
  }) => {
    await seedPantryItem(api, account.token);
    await page.goto('/meal/new');
    await page.getByRole('button', { name: 'Add from pantry' }).click();
    await page.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: /Add 1 to meal/ }).click();

    // The row auto-expands, so its fields are on screen.
    for (const label of ['Serving size', 'Calories', 'Protein (g)', 'Servings used', 'Notes']) {
      await expect(page.getByLabel(label, { exact: true }).first()).toBeVisible();
    }
  });

  test('the expand toggle reports its state', async ({ signedInPage: page, api, account }) => {
    await seedPantryItem(api, account.token);
    await page.goto('/meal/new');
    await page.getByRole('button', { name: 'Add from pantry' }).click();
    await page.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: /Add 1 to meal/ }).click();

    const toggle = page.locator('.expand-button').first();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('ingredient table sorts from the keyboard and reports aria-sort', async ({
    signedInPage: page, api, account,
  }) => {
    const meal = await seedMeal(api, account.token, { name: 'Sortable' });
    await page.goto(`/meal/${meal.id}`);

    const headers = page.locator('.ingredients-table thead th');
    await expect(headers.first()).toHaveAttribute('aria-sort', 'ascending');

    const proteinHeader = page.locator('.ingredients-table thead th', { hasText: 'Protein' });
    await expect(proteinHeader).toHaveAttribute('aria-sort', 'none');

    // Reached and activated with the keyboard alone.
    const button = proteinHeader.getByRole('button');
    await button.focus();
    await expect(button).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(proteinHeader).toHaveAttribute('aria-sort', 'ascending');
    await expect(headers.first()).toHaveAttribute('aria-sort', 'none');

    // A second press reverses it.
    await page.keyboard.press('Enter');
    await expect(proteinHeader).toHaveAttribute('aria-sort', 'descending');
  });

  test('the confirm dialog traps focus and closes on Escape', async ({
    signedInPage: page, api, account,
  }) => {
    await seedMeal(api, account.token, { name: 'Focus Test' });
    await page.goto('/dashboard');

    const trigger = page.getByRole('button', { name: 'Delete' });
    await trigger.click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    // Focus moves into the dialog rather than staying behind it.
    await expect(dialog.getByRole('button', { name: 'Delete' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    // Focus returns to whatever opened it.
    await expect(trigger).toBeFocused();
  });

  test('each page has exactly one h1 and a document title', async ({ signedInPage: page }) => {
    for (const route of ['/dashboard', '/pantry', '/shopping-list', '/settings']) {
      await page.goto(route);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page).toHaveTitle(/Meal Prep Pantry/);
    }
  });
});
