/**
 * End-to-end test runner.
 *
 * Owns the whole lifecycle so the pieces start in a guaranteed order:
 *   1. an in-memory MongoDB, so no database needs installing
 *   2. Vite with the Vercel API emulator, pointed at that database
 *   3. Playwright
 *
 * Playwright's own webServer option cannot be used here, because the server
 * has to receive the database URI, and that URI only exists once the
 * in-memory server has started.
 *
 * Any argument is passed through to `playwright test`, so this works:
 *   npm run test:e2e -- --headed --grep "save"
 */

import { spawn } from 'node:child_process';
import process from 'node:process';
import { MongoMemoryServer } from 'mongodb-memory-server';

const PORT = Number(process.env.E2E_PORT) || 3210;
const BASE_URL = `http://localhost:${PORT}`;
const SERVER_TIMEOUT_MS = 60000;

let mongo = null;
let vite = null;
let shuttingDown = false;

function log(message) {
  console.log(`[e2e] ${message}`);
}

/**
 * Wait until the dev server answers an HTTP request.
 *
 * A TCP probe against 127.0.0.1 is not enough. Vite binds "localhost",
 * which can resolve to ::1 only, so the socket check reports failure
 * while the server is in fact serving.
 *
 * @param {string} url - URL to poll
 * @param {number} timeoutMs - How long to keep trying
 * @returns {Promise<void>} Resolves once the server responds
 */
async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no attempt made';

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok || response.status < 500) return;
      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Server did not respond at ${url} within ${timeoutMs}ms (last: ${lastError})`);
}

async function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (vite && !vite.killed) {
    vite.kill('SIGTERM');
    // Give Vite a moment, then insist.
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (!vite.killed) vite.kill('SIGKILL');
  }

  if (mongo) {
    try {
      await mongo.stop();
    } catch (error) {
      console.error('[e2e] could not stop the in-memory database:', error.message);
    }
  }

  process.exit(code);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    log(`received ${signal}, cleaning up`);
    shutdown(130);
  });
}

// Every API route, touched once so Vite compiles it before tests begin.
// Unauthenticated calls are fine: a 401 still compiles the module.
const WARMUP_ROUTES = [
  '/api/meals',
  '/api/meal?id=000000000000000000000000',
  '/api/ingredients',
  '/api/ingredient?id=000000000000000000000000',
  '/api/user/profile',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
];

/**
 * Compile every API handler before the tests start.
 *
 * @returns {Promise<void>} Resolves once each route has answered
 */
async function warmUpHandlers() {
  await Promise.all(
    WARMUP_ROUTES.map(async (route) => {
      try {
        await fetch(`${BASE_URL}${route}`, { signal: AbortSignal.timeout(20000) });
      } catch {
        // A warmup failure is not fatal. The test that needs the route
        // will report the real problem.
      }
    })
  );
}

async function main() {
  log('starting in-memory MongoDB');
  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();

  const env = {
    ...process.env,
    MONGODB_URI: uri,
    // Fixed so that a token minted in one test is readable in the next.
    JWT_SECRET: process.env.JWT_SECRET || 'e2e-only-secret-not-used-anywhere-else',
    NODE_ENV: 'development',
    E2E_PORT: String(PORT),
    // Mail must never be attempted from a test run. With these unset the
    // mailer logs instead of sending.
    GMAIL_USER: '',
    GMAIL_APP_PASSWORD: '',
  };

  log(`starting Vite with the API emulator on port ${PORT}`);
  vite = spawn(
    process.execPath,
    [new URL('../node_modules/vite/bin/vite.js', import.meta.url).pathname, '--config', 'vite.config.e2e.js'],
    { env, stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let serverOutput = '';
  vite.stdout.on('data', (chunk) => { serverOutput += chunk; });
  vite.stderr.on('data', (chunk) => { serverOutput += chunk; });
  vite.on('exit', (code) => {
    if (!shuttingDown) {
      console.error('[e2e] the dev server exited unexpectedly:\n' + serverOutput);
      shutdown(code ?? 1);
    }
  });

  try {
    await waitForServer(BASE_URL, SERVER_TIMEOUT_MS);
  } catch (error) {
    console.error('[e2e] ' + error.message + '\n' + serverOutput);
    await shutdown(1);
    return;
  }
  log('server is up');

  // Vite compiles each API handler the first time it is requested. With
  // several workers starting at once that happens concurrently on cold
  // modules, and the slowest requests brush against the test timeouts.
  // Touching each route once, serially, moves that cost before the run.
  await warmUpHandlers();
  log('handlers warmed');

  const playwright = spawn(
    process.execPath,
    [new URL('../node_modules/@playwright/test/cli.js', import.meta.url).pathname, 'test', ...process.argv.slice(2)],
    { env: { ...env, E2E_BASE_URL: BASE_URL }, stdio: 'inherit' }
  );

  playwright.on('exit', (code) => {
    log(`playwright finished with code ${code}`);
    shutdown(code ?? 1);
  });
}

main().catch(async (error) => {
  console.error('[e2e] setup failed:', error);
  await shutdown(1);
});
