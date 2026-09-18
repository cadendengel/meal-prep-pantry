import { test as base, expect } from '@playwright/test';

/**
 * Shared fixtures for the end-to-end suite.
 *
 * Every test gets its own freshly registered account. Tests then run in
 * parallel without seeing each other's meals, and a failure never leaves
 * state that breaks the next run.
 */

let counter = 0;

/**
 * Build an address that can never receive mail.
 *
 * `.invalid` is reserved by RFC 2606 for exactly this.
 *
 * @returns {string} A unique test email address
 */
export function uniqueEmail() {
  counter += 1;
  return `e2e-${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 8)}@example.invalid`;
}

export const TEST_PASSWORD = 'e2e-password-123';

/**
 * A pantry ingredient with a serving size that is not a round number of
 * servings when measured out, which is what the save regression needs.
 */
export const PANTRY_ITEM = {
  name: 'E2E Peanut Butter',
  brand: 'Testbrand',
  barcode: '9999999999999',
  servingSizeQuantity: 32,
  servingSizeUnit: 'g',
  servingsPerContainer: 15,
  caloriesPerServing: 190,
  proteinPerServing: 7,
  carbsPerServing: 8,
  fatPerServing: 16,
  price: 3.5,
  productUrl: 'https://www.heb.com/e2e-peanut-butter',
};

/**
 * A stubbed Open Food Facts product, so barcode tests never touch the
 * network and never depend on someone else's data staying the same.
 */
export const OFF_PRODUCT = {
  status: 1,
  product: {
    code: '9999999999999',
    product_name: 'E2E Stub Oats',
    brands: 'Stubbco, Other',
    serving_size: '40 g',
    nutriments: {
      'energy-kcal_serving': 150,
      proteins_serving: 5,
      carbohydrates_serving: 27,
      fat_serving: 3,
      'energy-kcal_100g': 375,
    },
  },
};

export const test = base.extend({
  /**
   * An API client bound to the test's base URL.
   */
  api: async ({ playwright, baseURL }, use) => {
    const context = await playwright.request.newContext({ baseURL });
    await use(context);
    await context.dispose();
  },

  /**
   * A registered account: { email, token, user }.
   */
  account: async ({ api }, use) => {
    const email = uniqueEmail();
    const response = await api.post('/api/auth/register', {
      data: { name: 'E2E User', email, password: TEST_PASSWORD },
    });
    expect(response.status(), 'registration should succeed').toBe(201);
    const body = await response.json();
    await use({ email, token: body.token, user: body.user });
  },

  /**
   * A page already signed in as `account`.
   *
   * The session is seeded directly rather than typed through the login
   * form, so a test about meals does not fail because login broke. Login
   * itself is covered by auth.spec.js.
   */
  signedInPage: async ({ page, account }, use) => {
    await page.route('**/world.openfoodfacts.org/**', (route) =>
      route.fulfill({ json: OFF_PRODUCT })
    );

    await page.goto('/');
    await page.evaluate(
      ({ token, user }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
      },
      { token: account.token, user: account.user }
    );
    await use(page);
  },
});

/**
 * Save a pantry ingredient through the API.
 *
 * @param {import('@playwright/test').APIRequestContext} api - Request context
 * @param {string} token - Bearer token
 * @param {object} [overrides] - Fields to change
 * @returns {Promise<object>} The saved ingredient
 */
export async function seedPantryItem(api, token, overrides = {}) {
  const response = await api.post('/api/ingredients', {
    headers: { authorization: `Bearer ${token}` },
    data: { ...PANTRY_ITEM, ...overrides },
  });
  expect(response.status(), 'pantry seed should succeed').toBe(201);
  return (await response.json()).ingredient;
}

/**
 * Save a meal through the API.
 *
 * @param {import('@playwright/test').APIRequestContext} api - Request context
 * @param {string} token - Bearer token
 * @param {object} [overrides] - Fields to change
 * @returns {Promise<object>} The saved meal
 */
export async function seedMeal(api, token, overrides = {}) {
  const response = await api.post('/api/meals', {
    headers: { authorization: `Bearer ${token}` },
    data: {
      name: 'E2E Meal',
      servingsPerMeal: 2,
      ingredients: [
        {
          id: 'seed-1',
          name: PANTRY_ITEM.name,
          servingSizeQuantity: PANTRY_ITEM.servingSizeQuantity,
          servingSizeUnit: PANTRY_ITEM.servingSizeUnit,
          servingsPerContainer: PANTRY_ITEM.servingsPerContainer,
          caloriesPerServing: PANTRY_ITEM.caloriesPerServing,
          proteinPerServing: PANTRY_ITEM.proteinPerServing,
          carbsPerServing: PANTRY_ITEM.carbsPerServing,
          fatPerServing: PANTRY_ITEM.fatPerServing,
          price: PANTRY_ITEM.price,
          productUrl: PANTRY_ITEM.productUrl,
          servingsUsed: 1.5625,
        },
      ],
      ...overrides,
    },
  });
  expect(response.status(), 'meal seed should succeed').toBe(201);
  return (await response.json()).meal;
}

/**
 * A real 2x2 PNG.
 *
 * The upload path draws the file onto a canvas before recognition, so the
 * bytes must decode as an image. Content does not matter, because the OCR
 * result is chosen by the test.
 */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGP8//8/AzbAhFVsMEkDAOndA/0ZqAOmAAAAAElFTkSuQmCC',
  'base64'
);

/** A nutrition label as OCR would return it, in full. */
export const OCR_FULL_LABEL = `Nutrition Facts
Serving size 45 g
Servings Per Container 8
Calories 170
Total Fat 3g
Saturated Fat 0.5g
Total Carbohydrate 29g
Dietary Fiber 4g
Protein 6g`;

/**
 * Point the stubbed OCR at a given result before an upload.
 *
 * @param {import('@playwright/test').Page} page - The page under test
 * @param {object} settings - text, throwOnCreate, throwOnRecognize, errorMessage, delayMs
 * @returns {Promise<void>} Resolves once the stub is configured
 */
export async function setOcrResult(page, settings) {
  await page.evaluate((value) => {
    window.__E2E_OCR__ = value;
    window.__E2E_OCR_CALLS__ = [];
  }, settings);
}

/**
 * Read what the stubbed OCR was asked to do.
 *
 * @param {import('@playwright/test').Page} page - The page under test
 * @returns {Promise<Array<{type: string}>>} Recorded calls in order
 */
export async function getOcrCalls(page) {
  return page.evaluate(() => window.__E2E_OCR_CALLS__ || []);
}

/**
 * Upload a file to an ingredient row's hidden label-scan input.
 *
 * @param {import('@playwright/test').Page} page - The page under test
 * @param {{name?: string, mimeType?: string, buffer?: Buffer}} [file] - File to send
 * @returns {Promise<void>} Resolves once the file is set
 */
export async function uploadLabelImage(page, file = {}) {
  await page.locator('input[type="file"]').first().setInputFiles({
    name: file.name ?? 'label.png',
    mimeType: file.mimeType ?? 'image/png',
    buffer: file.buffer ?? TINY_PNG,
  });
}

/**
 * Fill a control and wait until the value has been committed.
 *
 * These are controlled inputs. `fill` dispatches the event, but the React
 * state a submit handler reads is set during the render that follows.
 * Clicking Save immediately after filling can therefore send the previous
 * value. Reading the value back proves the render happened.
 *
 * Use this wherever a submit follows a fill. Plain `fill` is fine when the
 * test only asserts on what is displayed.
 *
 * @param {import('@playwright/test').Locator} locator - The control
 * @param {string} value - Value to enter
 * @returns {Promise<void>} Resolves once the value is committed
 */
export async function fillAndSettle(locator, value) {
  await locator.fill(value);
  await expect(locator).toHaveValue(value);
}

export { expect };
