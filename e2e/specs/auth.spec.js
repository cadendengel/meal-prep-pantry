import { test, expect, uniqueEmail, TEST_PASSWORD } from '../fixtures.js';

test.describe('authentication', () => {
  test('registers, lands on the dashboard, and survives a reload', async ({ page }) => {
    const email = uniqueEmail();

    await page.goto('/');
    await page.getByRole('button', { name: 'Create one' }).click();
    await page.getByLabel('Name').fill('New Person');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('New Person')).toBeVisible();

    // The session must outlive a reload, which is what localStorage is for.
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('New Person')).toBeVisible();
  });

  test('rejects a short password before calling the API', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Create one' }).click();
    await page.getByLabel('Name').fill('Short Pass');
    await page.getByLabel('Email').fill(uniqueEmail());
    await page.getByLabel('Password').fill('12345');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.getByText(/at least 6 characters/i)).toBeVisible();
    await expect(page).not.toHaveURL(/\/dashboard/);
  });

  test('refuses a duplicate email', async ({ page, account }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Create one' }).click();
    await page.getByLabel('Name').fill('Impostor');
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.getByText(/already exists/i)).toBeVisible();
  });

  test('logs in, including with different spacing and case', async ({ page, account }) => {
    await page.goto('/');
    await page.getByLabel('Email').fill(`  ${account.email.toUpperCase()}  `);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Login', exact: true }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('reports a wrong password without revealing whether the account exists', async ({
    page, account,
  }) => {
    await page.goto('/');
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password').fill('definitely-wrong');
    await page.getByRole('button', { name: 'Login', exact: true }).click();

    await expect(page.getByText('Invalid email or password')).toBeVisible();
  });

  test('logs out and blocks the protected routes afterwards', async ({ signedInPage: page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/$/);

    for (const route of ['/dashboard', '/pantry', '/shopping-list', '/settings', '/meal/new']) {
      await page.goto(route);
      await expect(page, `${route} must redirect when signed out`).toHaveURL(/\/$/);
    }
  });

  test('recovers from a rejected token instead of showing a dead error', async ({
    signedInPage: page,
  }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'My Meals' })).toBeVisible();

    // Simulate an expired session: the token is present but the server
    // refuses it.
    await page.evaluate(() => localStorage.setItem('token', 'not-a-valid-token'));
    await page.reload();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(/session has expired/i)).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  });

  test('survives corrupt stored user data', async ({ signedInPage: page }) => {
    await page.evaluate(() => localStorage.setItem('user', '{not json'));
    await page.goto('/dashboard');

    // It must fall back to signed out, not render a blank page.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  });

  test('offers the forgot-password flow and answers generically', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Forgot your password/i }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);

    await page.getByLabel('Email').fill('nobody-at-all@example.invalid');
    await page.getByRole('button', { name: /Send reset link/i }).click();

    // The same wording regardless of whether the account exists, so the
    // page cannot be used to discover registered addresses.
    await expect(page.getByText(/if that email address has an account/i)).toBeVisible();
  });

  test('refuses a reset link that carries no token', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.getByText(/missing its token/i)).toBeVisible();
  });
});
