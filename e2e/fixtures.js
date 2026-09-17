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

export { expect };
