# Meal Prep Pantry

A local-first meal builder for tracking meals, ingredients, and macros with store product links.

## Features

- 🍽️ Create and manage meals with detailed ingredient tracking
- 📊 Automatic macro calculations (calories, protein, carbs, fat)
- 📸 **OCR Nutrition Label Scanning** - Auto-fill macros from photos
- 🏪 Support for HEB, Walmart, Sam's Club, and other stores
- 🔗 Store product links (manual add-to-cart)
- 📱 Responsive design
- 💾 Local storage (all data stored in browser)
- 🔐 Simple local authentication (testing only, no real passwords)

## Tech Stack

- **Vite** - Build tool
- **React 18** - UI framework
- **React Router** - Navigation
- **JavaScript** - No TypeScript
- **CSS** - Plain CSS styling
- **localStorage** - Data persistence
- **Tesseract.js** - OCR for nutrition label scanning

## Getting Started

### Prerequisites

- Node.js (v16 or higher recommended)
- npm or yarn

### Installation

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

### Running the App

```bash
npm run dev
```
This starts the React app on http://localhost:5173

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` folder.

### Preview Production Build

```bash
npm run preview
```

## Usage

### Creating an Account

1. On the landing page, click "Create one"
2. Enter your name and email (no password required for v0)
3. Click "Create Account"

### Login

1. Enter your email on the landing page
2. Click "Login"

### Creating a Meal

1. Click "New Meal" from the dashboard
2. Fill in meal details:
   - Name (required)
   - Notes (optional)
   - Serving size and unit
   - Servings per meal (required, must be > 0)
3. Add ingredients:
   - Click "Add Ingredient"
   - Expand ingredient row with the arrow button
   - Fill in ingredient details:
     - **Name**
     - **Store** (HEB, Walmart, Sam's Club, Other)
     - **Product URL** (optional)
     - **📸 Scan Nutrition Label** - Upload or drag photo to auto-fill
     - **Nutrition Facts (Per Serving):**
       - Serving size (e.g., "1 cup (240g)")
       - Servings per container (optional)
       - Calories per serving
       - Protein, carbs, fat per serving
     - **Recipe Usage:**
       - Number of servings used in this recipe
     - **Price** (optional)
     - **Notes** (optional)
4. View live-updating macro totals (meal totals and per-serving)
5. Click "Save Meal"

### Using OCR to Scan Nutrition Labels

The app now follows standard nutrition label format for accurate macro tracking:

1. When adding or editing an ingredient, expand the ingredient row
2. In the "Scan Nutrition Label" section, either:
   - **Click "📷 Upload Photo"** and choose a photo from your device, OR
   - **Drag and drop** a nutrition label image directly onto the upload area
3. Wait for OCR processing (shows progress percentage with a spinner)
4. The app will automatically extract and fill:
   - **Serving Size** (e.g., "1 cup (240g)")
   - **Servings Per Container** (if shown)
   - **Per Serving Macros:**
     - Calories
     - Protein
     - Carbohydrates
     - Fat
5. Then specify **how many servings you're using** in "Recipe Usage"
6. The app automatically calculates ingredient totals: servings used × macros per serving

**Example:**
- Nutrition label shows: "1 serving (240g) = 110 cal, 3g protein"
- You're using 2.5 servings in your recipe
- Ingredient total: 2.5 × 110 = 275 calories

**Tips for best results:**
- Use clear, well-lit photos
- Ensure the entire nutrition label is visible
- Keep text readable and in focus
- Try to avoid glare or shadows
- Use common image formats (JPG, PNG, etc.)

### Viewing a Meal

1. From the dashboard, click "View" on any meal
2. See meal details, all ingredients, and nutrition summary
3. Click product links to open store pages in new tab
4. Manually add items to cart on the store website

### Editing a Meal

1. From the dashboard or meal view, click "Edit"
2. Modify any meal or ingredient details
3. Click "Save Meal"

### Deleting a Meal

1. From the dashboard, click "Delete" on any meal
2. Confirm deletion

## Data Storage

All data is stored in browser localStorage:

- **users**: Array of user objects (id, name, email)
- **session**: Current logged-in user
- **meals**: Array of meal objects (filtered by userId)

**Important:** Clearing browser data will delete all stored information.

## Project Structure

```
MealPrepPantry/
├── src/
│   ├── main.jsx              # App entry point
│   ├── App.jsx               # Main app with routing
│   ├── styles.css            # All styles
│   ├── pages/
│   │   ├── Landing.jsx       # Login/create account
│   │   ├── Dashboard.jsx     # Meal list
│   │   ├── MealEdit.jsx      # Create/edit meal
│   │   └── MealView.jsx      # View meal details
│   └── components/
│       ├── MealForm.jsx      # Meal form with ingredients
│       ├── IngredientRow.jsx # Single ingredient editor
│       └── MacroTotals.jsx   # Nutrition summary
├── index.html
├── vite.config.js
├── package.json
└── README.md
```

## Notes

- This is a **local-first app** for personal use
- No backend or database required
- No real authentication (v0 testing only)
- Data persists only in your browser
- No cloud sync or multi-device support (yet)
- Product links open store pages - users manually add to cart

## Future Enhancements

Potential features for future versions:
- Real authentication with passwords
- Backend API for cloud storage
- Multi-device sync
- Meal planning calendar
- Shopping list generation
- Recipe sharing
- Nutritional goals tracking

## License

This project is for personal use. Feel free to modify and adapt as needed.

## Support

For questions or issues, please refer to the code comments or create an issue in the repository.

---

Built with ❤️ using Vite + React
