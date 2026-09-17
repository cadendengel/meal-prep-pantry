# Meal Prep Pantry

A cloud-based meal builder. It tracks meals, ingredients and macros, with links to store product pages. Data lives in MongoDB Atlas and syncs across your devices.

## Features

- Create and manage meals with per-ingredient tracking
- Automatic macro totals (calories, protein, carbs, fat), per meal and per serving
- OCR nutrition label scanning, or paste the label text
- Store detection from a product URL (HEB, Walmart, Sam's Club and others)
- Cost tracking, both store cost and the portion actually used
- Sortable ingredient table
- Responsive layout
- JWT authentication with bcrypt password hashing

## Tech stack

**Frontend**
- Vite 5 (build tool)
- React 18
- React Router 6
- Plain JavaScript and plain CSS
- Tesseract.js (OCR)

**Backend**
- Vercel serverless functions (`api/`)
- MongoDB Atlas
- `jsonwebtoken` for tokens, `bcryptjs` for password hashing

**Tests**
- Vitest

## Getting started

### Prerequisites

- Node.js 18 or later
- npm
- A MongoDB Atlas cluster (the free tier is enough)

### Install

1. Clone the repository.

2. Install the dependencies:
   ```bash
   npm install
   ```

3. Create your environment file:
   ```bash
   cp .env.example .env.local
   ```

4. Edit `.env.local` and set both values:
   - `MONGODB_URI` — your Atlas connection string
   - `JWT_SECRET` — 32 or more random characters

   Generate a secret with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

Both variables are required. The API throws at startup when either is missing.

### Run locally

`npm run dev` starts Vite on http://localhost:3000. Vite serves the front end only. It does not run the functions in `api/`, so login and meal storage return 404.

To run the front end and the API together, use the Vercel CLI:

```bash
npm install -g vercel
vercel dev
```

`vercel dev` reads `.env.local` and serves both parts on one origin.

### Test

```bash
npm test        # single run
npm run test:watch
```

The suite covers the nutrition parser, the meal calculations and the API payload validation. It needs no database.

### Build

```bash
npm run build   # output goes to dist/
npm run preview
```

## Deployment

1. Create a MongoDB Atlas cluster and a database user.
2. Allow network access from Vercel. Atlas has no fixed egress range for Vercel, so use `0.0.0.0/0` and rely on the database user credentials, or use an Atlas private endpoint.
3. Install the CLI and deploy:
   ```bash
   npm install -g vercel
   vercel
   ```
4. Add `MONGODB_URI` and `JWT_SECRET` in the Vercel dashboard, under Settings then Environment Variables.
5. Deploy to production:
   ```bash
   vercel --prod
   ```

The app creates its own indexes on first request: a unique index on `users.email`, and a compound index on `meals.userId` and `meals.updatedAt`.

## Usage

### Create an account

On the landing page, choose "Create one", then enter a name, an email address and a password of at least 6 characters.

### Create a meal

1. Choose "New Meal" on the dashboard.
2. Enter the meal name and the servings per meal. Both are required.
3. Choose "Add Ingredient", then expand the row.
4. Fill in the ingredient fields, or scan the label (see below).
5. Enter how many servings of that ingredient the recipe uses.
6. Choose "Save Meal".

Macro totals update as you type.

### Scan a nutrition label

1. Expand the ingredient row.
2. Either choose "Upload Photo", or drag an image onto the upload area.
3. Wait for OCR. The progress percentage appears during processing.
4. Review the extracted values and correct any that are wrong.

You can also paste the label text into the "Or paste nutrition text" box and choose "Parse Text". This is faster and more accurate than OCR when you can copy the text.

The parser reads the serving size, the servings per container, the calories, the protein, the total carbohydrate and the total fat.

**Example**

- The label reads "1 serving (240g) = 110 cal, 3g protein".
- The recipe uses 2.5 servings.
- The ingredient total is 2.5 × 110 = 275 calories.

**For the best OCR results**
- Use a clear, well-lit photo.
- Keep the whole label in frame and in focus.
- Avoid glare and shadows.

OCR misreads are common. Always check the values it fills in.

### Product links

Enter a full `http://` or `https://` product URL. The app derives the store name from the host and shows an "Open" link on the meal view. Other URL schemes are rejected. Adding items to a cart is manual.

## Data storage

All data lives in MongoDB Atlas, in the `mealprep` database.

- `users` — one document per account: `name`, `email`, a bcrypt `password` hash, `createdAt`
- `meals` — one document per meal, owned through a `userId` field

The browser stores only the JWT and a cached copy of your name and email, both in `localStorage`. Clearing browser data logs you out. It does not delete your meals.

## Project structure

```
meal-prep-pantry/
├── api/                      # Vercel serverless functions
│   ├── auth/
│   │   ├── login.js
│   │   └── register.js
│   ├── meals/
│   │   └── index.js          # GET list, POST create
│   └── meal.js               # GET, PUT, DELETE one meal by ?id=
├── lib/                      # Server-side shared code
│   ├── auth.js               # JWT sign, verify, response helpers
│   ├── mongodb.js            # Connection and index creation
│   ├── rateLimit.js          # Best-effort login throttling
│   ├── validation.js         # Payload and URL validation
│   └── __tests__/
├── src/
│   ├── main.jsx
│   ├── App.jsx               # Routing and session state
│   ├── styles.css
│   ├── pages/
│   │   ├── Landing.jsx
│   │   ├── Dashboard.jsx
│   │   ├── MealEdit.jsx
│   │   └── MealView.jsx
│   ├── components/
│   │   ├── MealForm.jsx
│   │   ├── IngredientRow.jsx
│   │   ├── MacroTotals.jsx
│   │   └── ErrorBoundary.jsx
│   └── utils/
│       ├── api.js            # Fetch client, token handling
│       ├── mealCalc.js       # Shared macro and serving math
│       ├── nutritionParser.js
│       └── __tests__/
├── index.html
├── vercel.json
├── vite.config.js
└── package.json
```

## Security notes

- Passwords are hashed with bcrypt at 10 rounds. bcrypt ignores bytes past 72, so the API rejects longer passwords rather than storing a truncated one.
- Tokens are JWTs with a 30-day expiry, held in `localStorage`. There is no revocation list. Changing `JWT_SECRET` invalidates every existing token.
- Every meal query filters on the authenticated `userId`, so one account cannot read or change another account's meals.
- Product URLs are restricted to `http:` and `https:` on both the client and the server, so a `javascript:` URL cannot reach an anchor `href`.
- Login throttling is per serverless instance and is best-effort only. See the comment at the top of `lib/rateLimit.js`. Move the counters to a shared store if you need a hard limit.
- The front end and the API share one origin, so the API sets no CORS headers. Setting `VITE_API_URL` to a different origin will fail CORS until you add the headers back deliberately.

## Known limitations

- Ingredient prices are stored as floating-point numbers. Cost totals can drift by a fraction of a cent.
- `calculateMealServingSize` sums quantities by unit without converting between units. A meal mixing grams and cups reports each unit separately, and the saved `servingSize` uses whichever unit comes first.
- There is no password reset flow.
- There is no pagination on the dashboard.

## Possible future work

- Meal planning calendar
- Shopping list generation
- Unit conversion in the serving size calculation
- Nutrition goal tracking
- Password reset by email

## License

For personal use. Modify and adapt as you need.
