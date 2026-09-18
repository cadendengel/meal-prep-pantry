import { test, expect, seedPantryItem, PANTRY_ITEM, fillAndSettle } from '../fixtures.js';

test.describe('pantry', () => {
  test('saves an ingredient and lists it', async ({ signedInPage: page }) => {
    await page.goto('/pantry');
    await expect(page.getByText('Nothing saved yet')).toBeVisible();

    await fillAndSettle(page.getByLabel('Name', { exact: false }).first(), '  Rolled Oats  ');
    await fillAndSettle(page.getByLabel('Brand'), 'Testbrand');
    await fillAndSettle(page.getByLabel('Serving size', { exact: true }), '40');
    await fillAndSettle(page.getByLabel('Calories'), '150');
    await fillAndSettle(page.getByLabel('Protein (g)'), '5');
    await page.getByRole('button', { name: 'Add to pantry' }).click();

    await expect(page.getByText(/Saved Rolled Oats/)).toBeVisible();
    // The name is trimmed on the way in.
    await expect(page.getByRole('heading', { name: 'Rolled Oats', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Saved ingredients \(1\)/ })).toBeVisible();
  });

  test('fills the form from a barcode lookup', async ({ signedInPage: page }) => {
    await page.goto('/pantry');

    await fillAndSettle(page.getByLabel('Barcode').first(), '9999999999999');
    await page.getByRole('button', { name: 'Look up' }).click();

    await expect(page.getByText(/Found E2E Stub Oats/)).toBeVisible();
    await expect(page.getByLabel('Name', { exact: false }).first()).toHaveValue('E2E Stub Oats');
    // Only the first brand is kept.
    await expect(page.getByLabel('Brand')).toHaveValue('Stubbco');
    await expect(page.getByLabel('Calories')).toHaveValue('150');
    await expect(page.getByLabel('Serving size', { exact: true })).toHaveValue('40');
  });

  test('refuses a barcode that is not a barcode', async ({ signedInPage: page }) => {
    await page.goto('/pantry');
    await fillAndSettle(page.getByLabel('Barcode').first(), '123');
    await page.getByRole('button', { name: 'Look up' }).click();
    await expect(page.locator('.toast-error')).toContainText(/8 to 14 digits/);
  });

  test('warns about a product URL that is not http', async ({ signedInPage: page }) => {
    await page.goto('/pantry');
    await fillAndSettle(page.getByLabel('Product URL'), 'javascript:alert(1)');
    await expect(page.locator('.field-hint-error')).toBeVisible();

    await fillAndSettle(page.getByLabel('Name', { exact: false }).first(), 'Bad URL Item');
    await page.getByRole('button', { name: 'Add to pantry' }).click();
    await expect(page.locator('.toast-error')).toContainText(/http/);
  });

  test('edits a saved ingredient', async ({ signedInPage: page, api, account }) => {
    await seedPantryItem(api, account.token);
    await page.goto('/pantry');

    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByRole('heading', { name: 'Edit ingredient' })).toBeVisible();
    await fillAndSettle(page.getByLabel('Calories'), '275');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByText(/Updated/)).toBeVisible();
    await expect(page.getByText('275 cal', { exact: false })).toBeVisible();
  });

  test('deletes only after the confirmation is accepted', async ({
    signedInPage: page, api, account,
  }) => {
    await seedPantryItem(api, account.token);
    await page.goto('/pantry');

    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();

    // Backing out must leave the ingredient alone.
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: PANTRY_ITEM.name })).toBeVisible();

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
    await expect(page.getByText('Nothing saved yet')).toBeVisible();
  });

  test('searches by name and by brand', async ({ signedInPage: page, api, account }) => {
    await seedPantryItem(api, account.token, { name: 'Almond Butter', brand: 'Nutco' });
    await seedPantryItem(api, account.token, { name: 'Brown Rice', brand: 'Grainco' });
    await page.goto('/pantry');

    const search = page.getByLabel('Search saved ingredients');
    await fillAndSettle(search, 'almond');
    await expect(page.getByRole('heading', { name: 'Almond Butter' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Brown Rice' })).toHaveCount(0);

    await fillAndSettle(search, 'grainco');
    await expect(page.getByRole('heading', { name: 'Brown Rice' })).toBeVisible();

    await fillAndSettle(search, 'nothing matches this');
    await expect(page.getByText('No match for that search')).toBeVisible();
  });

  test('keeps one account out of another account pantry', async ({ page, api, account }) => {
    await seedPantryItem(api, account.token, { name: 'Private Item' });

    // A second, unrelated account.
    const other = await api.post('/api/auth/register', {
      data: { name: 'Other', email: `other-${Date.now()}@example.invalid`, password: 'e2e-password-123' },
    });
    const { token, user } = await other.json();

    await page.goto('/');
    await page.evaluate(([t, u]) => {
      localStorage.setItem('token', t);
      localStorage.setItem('user', JSON.stringify(u));
    }, [token, user]);

    await page.goto('/pantry');
    await expect(page.getByText('Nothing saved yet')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Private Item' })).toHaveCount(0);
  });
});
