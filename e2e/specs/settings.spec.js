import { test, expect, seedMeal, fillAndSettle } from '../fixtures.js';

test.describe('settings', () => {
  test('saves macro targets and applies them elsewhere', async ({
    signedInPage: page, api, account,
  }) => {
    await seedMeal(api, account.token, {
      name: 'Goal Check', servingsPerMeal: 1,
      ingredients: [{
        id: 'g1', name: 'Protein Source', servingSizeQuantity: 100, servingSizeUnit: 'g',
        caloriesPerServing: 400, proteinPerServing: 50, carbsPerServing: 0, fatPerServing: 0,
        servingsUsed: 1, price: null, productUrl: '',
      }],
    });

    await page.goto('/settings');
    // Confirm the profile finished loading before typing into the form.
    await expect(page.getByLabel('Display name')).toHaveValue('E2E User');
    await fillAndSettle(page.getByLabel('Daily calories'), '2000');
    await fillAndSettle(page.getByLabel('Daily protein (g)'), '100');

    // These are controlled inputs. Reading the value back confirms React
    // has committed the state that the save handler will read, rather than
    // racing it and sending an empty target.
    await expect(page.getByLabel('Daily calories')).toHaveValue('2000');
    await expect(page.getByLabel('Daily protein (g)')).toHaveValue('100');

    const request = page.waitForRequest(
      (r) => r.url().includes('/api/user/profile') && r.method() === 'PUT'
    );
    const save = page.waitForResponse(
      (r) => r.url().includes('/api/user/profile') && r.request().method() === 'PUT'
    );
    await page.getByRole('button', { name: 'Save settings' }).click();

    // Assert on what was actually sent, so a stale value is reported here
    // rather than as a puzzling empty field after the reload.
    const sent = JSON.parse((await request).postData());
    // The client sends the raw input string; the server coerces it.
    expect(Number(sent.targets.protein), 'the typed target must reach the server').toBe(100);
    expect((await save).status()).toBe(200);

    // Persisted across a reload.
    await page.reload();
    await expect(page.getByLabel('Daily protein (g)')).toHaveValue('100');

    await page.goto('/dashboard');
    await expect(page.locator('.meal-card', { hasText: 'Goal Check' }))
      .toContainText('50% of protein goal');
  });

  test('rejects a target that is not a number', async ({ signedInPage: page }) => {
    await page.goto('/settings');
    // The field is type=number, so the browser refuses letters outright.
    await fillAndSettle(page.getByLabel('Daily protein (g)'), '-5');
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.locator('.toast-error')).toBeVisible();
  });

  test('renames the account and updates the header', async ({ signedInPage: page }) => {
    await page.goto('/settings');
    // The profile loads asynchronously. Waiting for the loaded value keeps
    // the fetch from landing on top of what the test types.
    await expect(page.getByLabel('Display name')).toHaveValue('E2E User');
    await fillAndSettle(page.getByLabel('Display name'), 'Renamed Person');

    // Wait on the request rather than on a toast, so a slow save reads as
    // slow rather than as a missing element.
    const request = page.waitForRequest(
      (r) => r.url().includes('/api/user/profile') && r.method() === 'PUT'
    );
    const save = page.waitForResponse(
      (r) => r.url().includes('/api/user/profile') && r.request().method() === 'PUT'
    );
    await page.getByRole('button', { name: 'Save settings' }).click();

    expect(JSON.parse((await request).postData()).name,
      'the typed name must reach the server').toBe('Renamed Person');
    expect((await save).status()).toBe(200);

    await expect(page.locator('.user-name')).toContainText('Renamed Person');
  });

  test('exports every meal as CSV and as JSON', async ({ signedInPage: page, api, account }) => {
    await seedMeal(api, account.token, { name: 'Exportable One' });
    await seedMeal(api, account.token, { name: 'Exportable Two' });
    await page.goto('/settings');

    const readDownload = async (stream) =>
      new Promise((resolve, reject) => {
        let text = '';
        stream.on('data', (c) => { text += c; });
        stream.on('end', () => resolve(text));
        stream.on('error', reject);
      });

    const csvPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const csv = await csvPromise;
    expect(csv.suggestedFilename()).toMatch(/^meals-\d{4}-\d{2}-\d{2}\.csv$/);
    const csvText = await readDownload(await csv.createReadStream());
    expect(csvText).toContain('Exportable One');
    expect(csvText).toContain('Exportable Two');

    const jsonPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON' }).click();
    const json = await jsonPromise;
    expect(json.suggestedFilename()).toMatch(/^meals-\d{4}-\d{2}-\d{2}\.json$/);
    const parsed = JSON.parse(await readDownload(await json.createReadStream()));
    expect(parsed.mealCount).toBe(2);
    // The internal owner id must not travel with an export.
    expect(parsed.meals[0]).not.toHaveProperty('userId');
  });

  test('never shows a blank form when the profile fails to load', async ({
    signedInPage: page, api, account,
  }) => {
    await api.put('/api/user/profile', {
      headers: { authorization: `Bearer ${account.token}` },
      data: { targets: { protein: 180 } },
    });

    // A failed load must not render an empty form. Saving one would write
    // empty targets over the stored ones.
    await page.route('**/api/user/profile', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ status: 500, json: { error: 'Internal server error' } })
        : route.continue()
    );

    await page.goto('/settings');

    await expect(page.getByRole('button', { name: 'Save settings' })).toHaveCount(0);
    await expect(page.locator('.error-message')).toBeVisible();

    // Recovering restores the real values.
    await page.unroute('**/api/user/profile');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByLabel('Daily protein (g)')).toHaveValue('180');
  });

  test('refuses to export when there is nothing to export', async ({ signedInPage: page }) => {
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    await expect(page.locator('.toast-error')).toContainText(/nothing to export/i);
  });
});
