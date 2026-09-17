import React from 'react';
import { calculateIngredientTotals } from '../utils/mealCalc.js';

const TARGET_ROWS = [
  { key: 'calories', label: 'Calories', suffix: '' },
  { key: 'protein', label: 'Protein', suffix: 'g' },
  { key: 'carbs', label: 'Carbs', suffix: 'g' },
  { key: 'fat', label: 'Fat', suffix: 'g' },
];

function MacroTotals({ meal, targets }) {
  const ingredients = Array.isArray(meal?.ingredients) ? meal.ingredients : [];

  // Calculate meal totals
  const mealTotals = ingredients.reduce(
    (totals, ingredient) => {
      const ingredientTotals = calculateIngredientTotals(ingredient);

      return {
        calories: totals.calories + ingredientTotals.calories,
        protein: totals.protein + ingredientTotals.protein,
        carbs: totals.carbs + ingredientTotals.carbs,
        fat: totals.fat + ingredientTotals.fat,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  // Calculate per-serving macros
  const servingsPerMeal = Number(meal?.servingsPerMeal) || 1;
  const perServingMacros = {
    calories: mealTotals.calories / servingsPerMeal,
    protein: mealTotals.protein / servingsPerMeal,
    carbs: mealTotals.carbs / servingsPerMeal,
    fat: mealTotals.fat / servingsPerMeal,
  };

  // Calculate prices
  const storeCost = ingredients.reduce(
    (sum, ingredient) => sum + (Number(ingredient.price) || 0),
    0
  );

  // Calculate meal cost (accounting for how much of each ingredient is actually used)
  const mealCost = ingredients.reduce((sum, ingredient) => {
    const price = Number(ingredient.price) || 0;
    if (!price) return sum;

    const perContainer = Number(ingredient.servingsPerContainer) || 0;
    const used = Number(ingredient.servingsUsed) || 0;

    // If servingsPerContainer exists, calculate percentage used
    if (perContainer > 0 && used) {
      const percentUsed = used / perContainer;
      return sum + (price * percentUsed);
    }

    // If no servingsPerContainer, include full price (ingredient is consumed entirely)
    return sum + price;
  }, 0);

  const hasTargets = TARGET_ROWS.some(({ key }) => (Number(targets?.[key]) || 0) > 0);

  const storeCostPerServing = servingsPerMeal > 0 ? storeCost / servingsPerMeal : 0;
  const mealCostPerServing = servingsPerMeal > 0 ? mealCost / servingsPerMeal : 0;

  return (
    <div className="macro-totals">
      <h3>Nutrition Summary</h3>
      
      <div className="totals-grid">
        <div className="totals-section">
          <h4>Meal Totals</h4>
          <div className="macro-items">
            <div className="macro-item">
              <span className="macro-label">Calories:</span>
              <span className="macro-value">{mealTotals.calories.toFixed(1)}</span>
            </div>
            <div className="macro-item">
              <span className="macro-label">Protein:</span>
              <span className="macro-value">{mealTotals.protein.toFixed(1)}g</span>
            </div>
            <div className="macro-item">
              <span className="macro-label">Carbs:</span>
              <span className="macro-value">{mealTotals.carbs.toFixed(1)}g</span>
            </div>
            <div className="macro-item">
              <span className="macro-label">Fat:</span>
              <span className="macro-value">{mealTotals.fat.toFixed(1)}g</span>
            </div>
          </div>
        </div>

        <div className="totals-section">
          <h4>Per Serving ({servingsPerMeal} servings)</h4>
          <div className="macro-items">
            <div className="macro-item">
              <span className="macro-label">Calories:</span>
              <span className="macro-value">{perServingMacros.calories.toFixed(1)}</span>
            </div>
            <div className="macro-item">
              <span className="macro-label">Protein:</span>
              <span className="macro-value">{perServingMacros.protein.toFixed(1)}g</span>
            </div>
            <div className="macro-item">
              <span className="macro-label">Carbs:</span>
              <span className="macro-value">{perServingMacros.carbs.toFixed(1)}g</span>
            </div>
            <div className="macro-item">
              <span className="macro-label">Fat:</span>
              <span className="macro-value">{perServingMacros.fat.toFixed(1)}g</span>
            </div>
          </div>
        </div>

        {hasTargets && (
          <div className="totals-section">
            <h4>Against your daily goals</h4>
            <div className="macro-items">
              {TARGET_ROWS.map(({ key, label, suffix }) => {
                const goal = Number(targets?.[key]) || 0;
                if (goal <= 0) return null;
                const value = perServingMacros[key];
                const percent = Math.round((value / goal) * 100);
                return (
                  <div className="macro-item" key={key}>
                    <span className="macro-label">{label}:</span>
                    <span className="macro-value">
                      {percent}% <span className="macro-sub">({value.toFixed(0)}{suffix} of {goal}{suffix})</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="macro-caption">One serving, against your daily target.</p>
          </div>
        )}

        {(storeCost > 0 || mealCost > 0) && (
          <div className="totals-section">
            <h4>Cost</h4>
            <div className="macro-items">
              {mealCost > 0 && (
                <>
                  <div className="cost-subsection-label">Cost Per Meal</div>
                  <div className="macro-item">
                    <span className="macro-label">Actual Cost:</span>
                    <span className="macro-value">${mealCost.toFixed(2)}</span>
                  </div>
                  <div className="macro-item">
                    <span className="macro-label">Per Serving:</span>
                    <span className="macro-value">${mealCostPerServing.toFixed(2)}</span>
                  </div>
                </>
              )}
              {storeCost > 0 && (
                <>
                  <div className="cost-subsection-label">Store Cost (All Ingredients)</div>
                  <div className="macro-item">
                    <span className="macro-label">Total:</span>
                    <span className="macro-value">${storeCost.toFixed(2)}</span>
                  </div>
                  <div className="macro-item">
                    <span className="macro-label">Per Serving:</span>
                    <span className="macro-value">${storeCostPerServing.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MacroTotals;
