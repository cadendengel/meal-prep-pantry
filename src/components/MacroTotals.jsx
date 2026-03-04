import React from 'react';

function MacroTotals({ meal }) {
  // Calculate meal totals
  const mealTotals = meal.ingredients.reduce(
    (totals, ingredient) => {
      const ingredientTotals = {
        calories: (ingredient.caloriesPerServing || 0) * (ingredient.servingsUsed || 0),
        protein: (ingredient.proteinPerServing || 0) * (ingredient.servingsUsed || 0),
        carbs: (ingredient.carbsPerServing || 0) * (ingredient.servingsUsed || 0),
        fat: (ingredient.fatPerServing || 0) * (ingredient.servingsUsed || 0),
      };

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
  const servingsPerMeal = meal.servingsPerMeal || 1;
  const perServingMacros = {
    calories: mealTotals.calories / servingsPerMeal,
    protein: mealTotals.protein / servingsPerMeal,
    carbs: mealTotals.carbs / servingsPerMeal,
    fat: mealTotals.fat / servingsPerMeal,
  };

  // Calculate prices
  const storeCost = meal.ingredients.reduce(
    (sum, ingredient) => sum + (ingredient.price || 0),
    0
  );

  // Calculate meal cost (accounting for how much of each ingredient is actually used)
  const mealCost = meal.ingredients.reduce((sum, ingredient) => {
    if (!ingredient.price) return sum;
    
    // If servingsPerContainer exists, calculate percentage used
    if (ingredient.servingsPerContainer && ingredient.servingsPerContainer > 0 && ingredient.servingsUsed) {
      const percentUsed = ingredient.servingsUsed / ingredient.servingsPerContainer;
      return sum + (ingredient.price * percentUsed);
    }
    
    // If no servingsPerContainer, include full price (ingredient is consumed entirely)
    return sum + ingredient.price;
  }, 0);

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
