import {
  test, expect, fillAndSettle,
} from '../fixtures.js';

/**
 * The real tesseract.js integration.
 *
 * Skipped unless E2E_REAL_OCR=1, because it downloads language data and
 * takes tens of seconds. The rest of the OCR suite stubs recognition, so
 * without this nothing would notice if the tesseract.js API changed, or if
 * the worker stopped loading at all.
 *
 *   E2E_REAL_OCR=1 npm run test:e2e -- ocr-real.spec.js
 */

const REAL_OCR = process.env.E2E_REAL_OCR === '1';

test.describe('real OCR', () => {
  test.skip(!REAL_OCR, 'set E2E_REAL_OCR=1 to run against the real library');
  // Downloading language data and recognizing is slow.
  test.setTimeout(180000);

  /**
   * Render a nutrition label to a PNG.
   *
   * Crisply rendered text is the best case for OCR. This test is about
   * whether the library is wired up correctly, not about how it copes
   * with a bad photograph.
   *
   * @param {import('@playwright/test').Page} page - A page to render in
   * @returns {Promise<Buffer>} PNG bytes
   */
  async function renderLabel(page) {
    await page.setContent(`
      <body style="margin:0;background:#fff">
        <div style="width:520px;padding:32px;font:28px/1.6 Helvetica,Arial,sans-serif;color:#000">
          <div style="font-size:40px;font-weight:bold">Nutrition Facts</div>
          <div>Serving size 45 g</div>
          <div>Servings Per Container 8</div>
          <div style="font-size:36px;font-weight:bold">Calories 170</div>
          <div>Total Fat 3g</div>
          <div>Total Carbohydrate 29g</div>
          <div>Protein 6g</div>
        </div>
      </body>
    `);
    return page.locator('div').first().screenshot({ type: 'png' });
  }

  test('reads a clean label through the real library', async ({ signedInPage: page, browser }) => {
    const renderPage = await browser.newPage();
    const labelPng = await renderLabel(renderPage);
    await renderPage.close();

    await page.goto('/meal/new');
    await fillAndSettle(page.getByLabel('Meal Name'), 'Real OCR Meal');
    await fillAndSettle(page.getByLabel('Servings Per Meal'), '2');
    await page.getByRole('button', { name: '+ Add Ingredient' }).click();
    await expect(page.getByLabel('Serving size', { exact: true })).toBeVisible();

    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'label.png', mimeType: 'image/png', buffer: labelPng,
    });

    // Recognition, including the first-run language download.
    await expect(page.locator('.toast-success, .toast-error')).toBeVisible({ timeout: 150000 });

    // Prove the real library ran. The stub records every call, so if the
    // alias were still in place this test would be quietly testing the
    // stub instead, which is the exact failure it exists to prevent.
    const stubCalls = await page.evaluate(() => window.__E2E_OCR_CALLS__);
    expect(stubCalls, 'the tesseract.js stub must not be aliased in for this test')
      .toBeUndefined();

    const failed = await page.locator('.toast-error').count();
    expect(failed, 'the real worker must load and recognize').toBe(0);

    // Calories is the largest text on a label and the most reliable read.
    // Asserting every field would make this a test of OCR accuracy rather
    // than of the integration.
    await expect(page.getByLabel('Calories')).toHaveValue('170');
  });
});
