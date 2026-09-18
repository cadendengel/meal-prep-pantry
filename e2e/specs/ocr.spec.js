import {
  test, expect, seedPantryItem, setOcrResult, getOcrCalls, uploadLabelImage, OCR_FULL_LABEL, TINY_PNG, fillAndSettle,
} from '../fixtures.js';

/**
 * Label scanning and the paste-text path that shares its parsing.
 *
 * Recognition itself is stubbed, because real OCR output varies with
 * fonts, lighting and compression and so cannot act as a regression
 * signal. Everything around it is real: file validation, the progress
 * indicator, parsing, applying values to the form, error handling and
 * worker cleanup.
 *
 * The real library is checked separately, by running the suite with
 * E2E_REAL_OCR=1.
 */

/** Add one blank ingredient row, expanded and ready to fill. */
async function addIngredientRow(page) {
  await page.goto('/meal/new');
  await fillAndSettle(page.getByLabel('Meal Name'), 'OCR Meal');
  await fillAndSettle(page.getByLabel('Servings Per Meal'), '2');
  await page.getByRole('button', { name: '+ Add Ingredient' }).click();
  await expect(page.getByLabel('Serving size', { exact: true })).toBeVisible();
}

test.describe('pasting nutrition text', () => {
  test('fills every field it can read', async ({ signedInPage: page }) => {
    await addIngredientRow(page);

    await fillAndSettle(page.getByLabel('Or paste the nutrition text'), OCR_FULL_LABEL);
    await page.getByRole('button', { name: 'Parse text' }).click();

    await expect(page.getByLabel('Serving size', { exact: true })).toHaveValue('45');
    await expect(page.getByLabel('Servings per container')).toHaveValue('8');
    await expect(page.getByLabel('Calories')).toHaveValue('170');
    await expect(page.getByLabel('Protein (g)')).toHaveValue('6');
    await expect(page.getByLabel('Carbs (g)')).toHaveValue('29');
    await expect(page.getByLabel('Fat (g)')).toHaveValue('3');
  });

  test('reports total fat, not the saturated fat beneath it', async ({ signedInPage: page }) => {
    await addIngredientRow(page);
    await fillAndSettle(
      page.getByLabel('Or paste the nutrition text'),
      'Calories 150\nSaturated Fat 1.5g\nProtein 9g'
    );
    await page.getByRole('button', { name: 'Parse text' }).click();

    await expect(page.getByLabel('Calories')).toHaveValue('150');
    // Saturated fat must not land in the total fat field.
    await expect(page.getByLabel('Fat (g)')).toHaveValue('');
  });

  test('reads a fractional serving size', async ({ signedInPage: page }) => {
    await addIngredientRow(page);
    await fillAndSettle(
      page.getByLabel('Or paste the nutrition text'),
      'Serving size 1/2 cup\nCalories 80\nProtein 2g'
    );
    await page.getByRole('button', { name: 'Parse text' }).click();

    await expect(page.getByLabel('Serving size', { exact: true })).toHaveValue('0.5');
    await expect(page.getByLabel('Unit')).toHaveValue('cup');
  });

  test('says so when the text holds no nutrition data', async ({ signedInPage: page }) => {
    await addIngredientRow(page);
    await fillAndSettle(page.getByLabel('Or paste the nutrition text'), 'Ingredients: water, salt.');
    await page.getByRole('button', { name: 'Parse text' }).click();

    await expect(page.locator('.toast-error')).toContainText(/No nutrition values found/i);
    await expect(page.getByLabel('Calories')).toHaveValue('');
  });

  test('refuses an empty box', async ({ signedInPage: page }) => {
    await addIngredientRow(page);
    await page.getByRole('button', { name: 'Parse text' }).click();
    await expect(page.locator('.toast-error')).toContainText(/Paste the nutrition text first/i);
  });

  test('clears the box after a successful parse', async ({ signedInPage: page }) => {
    await addIngredientRow(page);
    const box = page.getByLabel('Or paste the nutrition text');
    await fillAndSettle(box, OCR_FULL_LABEL);
    await page.getByRole('button', { name: 'Parse text' }).click();

    await expect(page.locator('.toast-success')).toBeVisible();
    await expect(box).toHaveValue('');
  });

  test('keeps the text when nothing could be parsed', async ({ signedInPage: page }) => {
    await addIngredientRow(page);
    const box = page.getByLabel('Or paste the nutrition text');
    await fillAndSettle(box, 'nothing useful here');
    await page.getByRole('button', { name: 'Parse text' }).click();

    // The text is kept so it can be corrected rather than retyped.
    await expect(box).toHaveValue('nothing useful here');
  });
});

test.describe('scanning a label image', () => {
  test('fills the fields from the recognized text', async ({ signedInPage: page }) => {
    await addIngredientRow(page);
    await setOcrResult(page, { text: OCR_FULL_LABEL });

    await uploadLabelImage(page);

    await expect(page.locator('.toast-success')).toBeVisible();
    await expect(page.getByLabel('Calories')).toHaveValue('170');
    await expect(page.getByLabel('Protein (g)')).toHaveValue('6');
    await expect(page.getByLabel('Serving size', { exact: true })).toHaveValue('45');
  });

  test('shows progress while it works, then stops', async ({ signedInPage: page }) => {
    await addIngredientRow(page);
    await setOcrResult(page, { text: OCR_FULL_LABEL, delayMs: 1500 });

    await uploadLabelImage(page);

    await expect(page.getByText(/Reading label/)).toBeVisible();
    await expect(page.locator('.spinner')).toBeVisible();

    await expect(page.locator('.toast-success')).toBeVisible();
    await expect(page.getByText(/Reading label/)).toHaveCount(0);
    await expect(page.locator('.spinner')).toHaveCount(0);
  });

  test('rejects a file that is not an image without starting a worker', async ({
    signedInPage: page,
  }) => {
    await addIngredientRow(page);
    await setOcrResult(page, { text: OCR_FULL_LABEL });

    await uploadLabelImage(page, {
      name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello'),
    });

    await expect(page.locator('.toast-error')).toContainText(/not an image/i);
    expect(await getOcrCalls(page), 'no worker should be created').toEqual([]);
  });

  test('explains a scan that found nothing', async ({ signedInPage: page }) => {
    await addIngredientRow(page);
    await setOcrResult(page, { text: 'blurry unreadable smudge' });

    await uploadLabelImage(page);

    await expect(page.locator('.toast-error'))
      .toContainText(/Could not read nutrition values/i);
    await expect(page.getByLabel('Calories')).toHaveValue('');
  });

  test('surfaces a recognition failure', async ({ signedInPage: page }) => {
    await addIngredientRow(page);
    await setOcrResult(page, { throwOnRecognize: true, errorMessage: 'engine exploded' });

    await uploadLabelImage(page);

    await expect(page.locator('.toast-error')).toContainText(/engine exploded/);
  });

  test('surfaces a worker that will not start', async ({ signedInPage: page }) => {
    await addIngredientRow(page);
    await setOcrResult(page, { throwOnCreate: true, errorMessage: 'no wasm here' });

    await uploadLabelImage(page);

    await expect(page.locator('.toast-error')).toContainText(/no wasm here/);
  });

  test('rejects a file that claims to be an image but is not', async ({ signedInPage: page }) => {
    await addIngredientRow(page);
    await setOcrResult(page, { text: OCR_FULL_LABEL });

    // Correct MIME type, bytes that cannot decode. The image onerror path.
    await uploadLabelImage(page, {
      name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not really a png'),
    });

    await expect(page.locator('.toast-error')).toContainText(/Could not process the image/i);
  });

  test('terminates the worker even when recognition fails', async ({ signedInPage: page }) => {
    await addIngredientRow(page);
    await setOcrResult(page, { throwOnRecognize: true, errorMessage: 'boom' });

    await uploadLabelImage(page);
    await expect(page.locator('.toast-error')).toBeVisible();

    // A worker holds a WebAssembly instance and a thread. Leaking one per
    // failed scan degrades the tab.
    const calls = (await getOcrCalls(page)).map((c) => c.type);
    expect(calls, 'the worker must be terminated on the failure path').toContain('terminate');
  });

  test('terminates the worker on success too', async ({ signedInPage: page }) => {
    await addIngredientRow(page);
    await setOcrResult(page, { text: OCR_FULL_LABEL });

    await uploadLabelImage(page);
    await expect(page.locator('.toast-success')).toBeVisible();

    const calls = (await getOcrCalls(page)).map((c) => c.type);
    expect(calls).toEqual(['createWorker', 'recognize', 'terminate']);
  });

  test('accepts a dragged image', async ({ signedInPage: page }) => {
    await addIngredientRow(page);
    await setOcrResult(page, { text: OCR_FULL_LABEL });

    // Build a DataTransfer holding the file, then drop it on the zone.
    const dataTransfer = await page.evaluateHandle(async (bytes) => {
      const dt = new DataTransfer();
      const file = new File([new Uint8Array(bytes)], 'dropped.png', { type: 'image/png' });
      dt.items.add(file);
      return dt;
    }, Array.from(TINY_PNG));

    const zone = page.locator('.upload-section').first();
    await zone.dispatchEvent('dragenter', { dataTransfer });
    await expect(page.getByText('Drop the image here')).toBeVisible();
    await zone.dispatchEvent('drop', { dataTransfer });

    await expect(page.locator('.toast-success')).toBeVisible();
    await expect(page.getByLabel('Calories')).toHaveValue('170');
  });

  test('keeps values the scan did not find', async ({ signedInPage: page }) => {
    await addIngredientRow(page);

    // Typed by hand first.
    await fillAndSettle(page.getByLabel('Price per container'), '4.25');
    // Exact, because the meal also has a Notes field.
    await fillAndSettle(page.getByLabel('Notes', { exact: true }), 'from the corner shop');

    await setOcrResult(page, { text: 'Calories 200\nProtein 10g' });
    await uploadLabelImage(page);
    await expect(page.locator('.toast-success')).toBeVisible();

    // The scan fills what it read and leaves everything else alone.
    await expect(page.getByLabel('Calories')).toHaveValue('200');
    await expect(page.getByLabel('Price per container')).toHaveValue('4.25');
    await expect(page.getByLabel('Notes', { exact: true })).toHaveValue('from the corner shop');
  });

  test('a scanned ingredient saves', async ({ signedInPage: page }) => {
    await addIngredientRow(page);
    await setOcrResult(page, { text: OCR_FULL_LABEL });
    await uploadLabelImage(page);
    await expect(page.locator('.toast-success')).toBeVisible();

    await fillAndSettle(page.getByLabel('Ingredient 1 name'), 'Scanned Oats');
    await fillAndSettle(page.getByLabel('Amount used (g)'), '60');

    const save = page.waitForResponse(
      (r) => r.url().includes('/api/meals') && r.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Save Meal' }).click();
    expect((await save).status()).toBe(201);
  });
});
