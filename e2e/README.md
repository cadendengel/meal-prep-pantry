# End-to-end tests

Browser tests that drive the real app against real API handlers and a real
database.

## Why these exist

A `step="0.1"` constraint on the "Servings used" field once made saving a
meal impossible. Entering an amount in grams derives a fractional serving
count, the browser rejected it, and native validation blocks submit before
any handler runs. The Save button did nothing: no error, no request, no
clue.

The unit tests passed. The build passed. Every database integration check
passed. None of them submit a form, so none of them could see it.

These tests cover that class of defect.

## Running them

```bash
npm run test:e2e              # everything
npm run test:e2e -- --headed  # watch it happen
npm run test:e2e -- --ui      # the Playwright inspector
npm run test:e2e -- meal-save.spec.js
npm run test:e2e -- --grep "fractional"
npm run test:all              # unit tests, then these
```

Nothing needs installing beyond `npm install` and `npx playwright install
chromium`. The database is an in-memory MongoDB that starts and stops with
the run.

## How it fits together

`e2e/run.js` owns the lifecycle, in this order:

1. Start an in-memory MongoDB.
2. Start Vite with `vite.config.e2e.js`, pointed at that database.
3. Request every API route once, so Vite compiles each handler before the
   tests begin rather than under parallel load.
4. Run Playwright.
5. Stop everything, whatever the outcome.

Playwright's own `webServer` option cannot do this, because the server needs
the database URI and that URI only exists once the database has started.

`e2e/vercel-api-plugin.js` serves `api/` the way Vercel functions do. It
reads the rewrites out of `vercel.json`, so a rewrite added for production
is exercised here too. The handlers are the real ones, not stubs.

## Conventions

- **One account per test.** The `account` fixture registers a fresh user, so
  tests run in parallel without seeing each other's data, and a failed run
  leaves nothing behind that breaks the next one.
- **Addresses end in `.invalid`.** That top-level domain is reserved by
  RFC 2606 and can never receive mail.
- **Mail is never sent.** The runner clears `GMAIL_USER` and
  `GMAIL_APP_PASSWORD`, so the mailer logs instead of sending.
- **Open Food Facts is stubbed.** The `signedInPage` fixture intercepts it,
  so barcode tests do not depend on the network or on someone else's data
  staying the same.
- **Seed through the API, assert through the UI.** A test about the
  shopping list should not fail because meal creation broke. Setup uses
  `seedMeal` and `seedPantryItem`; the browser is used for the behaviour
  under test.
- **Never use `.all()` on a list that loads asynchronously** without first
  asserting its count. `.all()` takes an immediate snapshot and does not
  retry, unlike every other Playwright locator method.

## Projects

- `desktop` — 1280x900 Chromium, everything except `mobile.spec.js`.
- `mobile` — iPhone 13 viewport with touch, on Chromium. These tests check
  the CSS breakpoint, not engine-specific rendering, so requiring a WebKit
  download would cost more than it proves.

## What is covered

| File | Covers |
| --- | --- |
| `meal-save.spec.js` | The save regression: grams entry, scaling, computed values, blocked-submit reporting |
| `auth.spec.js` | Register, login, logout, route guards, expired token recovery, corrupt storage, reset entry points |
| `pantry.spec.js` | Ingredient CRUD, barcode fill, search, URL validation, cross-account isolation |
| `shopping-list.spec.js` | Store grouping, combining across meals, unit conversion, prorated cost, link safety |
| `dashboard.spec.js` | Per-serving macros, sort, filter, duplicate, delete, goal share |
| `meal-view.spec.js` | Totals, targets, per-100 g, CSV export, link safety |
| `settings.spec.js` | Targets, rename, CSV and JSON export |
| `unsaved-changes.spec.js` | The dirty guard on new and existing meals |
| `accessibility.spec.js` | Label association, keyboard sorting, `aria-sort`, focus trapping |
| `mobile.spec.js` | Card layout, no horizontal overflow, collapsed nav, saving on a phone |

## Checking that a test can fail

A regression test that cannot fail is worse than none, because it reads as
coverage. Confirm one by reintroducing the bug and watching it go red:

```bash
# Put step="0.1" back on the servings field in IngredientRow.jsx
npm run test:e2e -- meal-save.spec.js   # 3 tests must fail
```

Every test here was checked that way when it was written.
