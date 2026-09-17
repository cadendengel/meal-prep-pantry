import { test, expect, seedPantryItem } from '../fixtures.js';

/**
 * The save path.
 *
 * A regression here shipped once already. Entering an amount in grams
 * derives a fractional serving count, and a step="0.1" constraint on the
 * servings field made the browser reject it. Native validation blocks
 * submit before any handler runs, so the Save button did nothing at all:
 * no error, no request, no clue. Unit tests could not see it, because
 * none of them submit a form.
 */
test.describe('saving a meal', () => {
  test('saves when the amount in grams gives a fractional serving count', async ({
    signedInPage: page, api, account,
  }) => {
    await seedPantryItem(api, account.token);

    await page.goto('/meal/new');
    await page.getByLabel('Meal Name').fill('Grams Entry Meal');
    await page.getByLabel('Servings Per Meal').fill('2');

    await page.getByRole('button', { name: 'Add from pantry' }).click();
    await page.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: /Add 1 to meal/ }).click();

    // 50 g of a 32 g serving is 1.5625 servings. That is the value that
    // used to be rejected.
    await page.getByLabel('Amount used (g)').fill('50');
    await expect(page.getByLabel('Servings used')).toHaveValue('1.5625');

    const saveRequest = page.waitForResponse(
      (r) => r.url().includes('/api/meals') && r.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Save Meal' }).click();

    expect((await saveRequest).status(), 'the POST must actually happen').toBe(201);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Grams Entry Meal' })).toBeVisible();
  });

  test('every numeric field accepts a computed value', async ({
    signedInPage: page, api, account,
  }) => {
    await seedPantryItem(api, account.token);
    await page.goto('/meal/new');
    await page.getByLabel('Meal Name').fill('Validity Meal');
    await page.getByLabel('Servings Per Meal').fill('3');
    await page.getByRole('button', { name: 'Add from pantry' }).click();
    await page.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: /Add 1 to meal/ }).click();
    await page.getByLabel('Amount used (g)').fill('47');

    // Ask the browser directly, rather than inferring from behaviour.
    const invalid = await page.evaluate(() =>
      [...document.querySelector('form.meal-form').elements]
        .filter((el) => el.willValidate && !el.checkValidity())
        .map((el) => ({ id: el.id, value: el.value, message: el.validationMessage }))
    );
    expect(invalid, 'no field may be invalid after normal entry').toEqual([]);
  });

  test('scaling keeps per-serving macros and still saves', async ({
    signedInPage: page, api, account,
  }) => {
    await seedPantryItem(api, account.token);
    await page.goto('/meal/new');
    await page.getByLabel('Meal Name').fill('Scaled Meal');
    await page.getByLabel('Servings Per Meal').fill('2');
    await page.getByRole('button', { name: 'Add from pantry' }).click();
    await page.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: /Add 1 to meal/ }).click();
    // 50 g of a 32 g serving is 1.5625 servings, deliberately not a round
    // number, so the scaled result is not a multiple of 0.1 either.
    await page.getByLabel('Amount used (g)').fill('50');

    // Scoped by the heading, because the Cost section also contains the
    // words "Per Serving".
    const perServingSection = page.locator('.totals-section').filter({
      has: page.getByRole('heading', { level: 4, name: /^Per Serving/ }),
    });
    const perServingBefore = await perServingSection.locator('.macro-item').allInnerTexts();

    await page.getByLabel('Scale recipe to').fill('3');
    await page.getByRole('button', { name: 'Scale', exact: true }).click();

    // Wait for the toast, which only appears once the scale has been
    // applied to state. Asserting on the fields before that races the
    // re-render.
    await expect(page.getByText(/Scaled from 2 to 3 servings/)).toBeVisible();

    await expect(page.getByLabel('Servings Per Meal')).toHaveValue('3');
    await expect(page.getByLabel('Amount used (g)')).toHaveValue('75');
    // 1.5625 scaled by 3/2. Deliberately not a multiple of 0.1, so a
    // step="0.1" regression makes this fail.
    await expect(page.getByLabel('Servings used')).toHaveValue('2.3438');

    const perServingAfter = await perServingSection.locator('.macro-item').allInnerTexts();
    expect(
      perServingAfter,
      'scaling must not change macros per serving'
    ).toEqual(perServingBefore);

    const saveRequest = page.waitForResponse(
      (r) => r.url().includes('/api/meals') && r.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Save Meal' }).click();
    expect((await saveRequest).status()).toBe(201);
  });

  test('a blocked submit reports why instead of doing nothing', async ({
    signedInPage: page,
  }) => {
    await page.goto('/meal/new');
    await page.getByLabel('Meal Name').fill('Bad Servings');
    await page.getByLabel('Servings Per Meal').fill('2');

    // Drive the field out of range the way a stale value could.
    await page.evaluate(() => {
      const field = document.querySelector('#servings-per-meal');
      field.setAttribute('min', '5');
    });
    await page.getByRole('button', { name: 'Save Meal' }).click();

    // The onInvalidCapture backstop must surface something visible.
    await expect(page.locator('.toast-error')).toBeVisible();
  });

  test('editing an existing meal saves the changes', async ({
    signedInPage: page, api, account,
  }) => {
    const { seedMeal } = await import('../fixtures.js');
    const meal = await seedMeal(api, account.token, { name: 'Before Edit' });

    await page.goto(`/meal/${meal.id}/edit`);
    await expect(page.getByLabel('Meal Name')).toHaveValue('Before Edit');
    await page.getByLabel('Meal Name').fill('After Edit');

    const put = page.waitForResponse(
      (r) => r.url().includes('/api/meal?') && r.request().method() === 'PUT'
    );
    await page.getByRole('button', { name: 'Save Meal' }).click();
    expect((await put).status()).toBe(200);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'After Edit' })).toBeVisible();
  });
});
