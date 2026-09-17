import React, { useState } from 'react';
import IngredientRow from './IngredientRow.jsx';
import MacroTotals from './MacroTotals.jsx';
import { generateId, calculateMealServingSize } from '../utils/mealCalc.js';

function MealForm({ meal, onSave, onCancel, saving = false }) {
  const [formData, setFormData] = useState(meal);

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddIngredient = () => {
    const newIngredient = {
      id: generateId(),
      name: '',
      productUrl: '',
      
      // Nutrition Label Info (per serving as shown on package)
      servingSizeQuantity: null,
      servingSizeUnit: 'serving',
      servingsPerContainer: null,
      caloriesPerServing: null,
      proteinPerServing: null,
      carbsPerServing: null,
      fatPerServing: null,
      
      // Recipe Usage (how much you're using)
      servingsUsed: null,
      
      price: null,
      notes: '',
    };

    setFormData(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, newIngredient],
    }));
  };

  const handleUpdateIngredient = (ingredientId, updatedIngredient) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.map(ing =>
        ing.id === ingredientId ? updatedIngredient : ing
      ),
    }));
  };

  const handleDeleteIngredient = (ingredientId) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter(ing => ing.id !== ingredientId),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="meal-form">
      <div className="form-section">
        <h3>Meal Details</h3>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="meal-name">
              Meal Name <span className="required">*</span>
            </label>
            <input
              id="meal-name"
              type="text"
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder="e.g., Chicken & Rice Bowl"
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="meal-notes">Notes (optional)</label>
            <textarea
              id="meal-notes"
              value={formData.notes}
              onChange={(e) => handleFieldChange('notes', e.target.value)}
              placeholder="Any additional notes about this meal..."
              rows="3"
            />
          </div>
        </div>

        <div className="form-row form-row-1">
          <div className="form-group">
            <label htmlFor="servings-per-meal">
              Servings Per Meal <span className="required">*</span>
            </label>
            <input
              id="servings-per-meal"
              type="number"
              value={formData.servingsPerMeal ?? ''}
              onChange={(e) => handleFieldChange('servingsPerMeal', e.target.value ? parseFloat(e.target.value) : null)}
              onWheel={(e) => e.currentTarget.blur()}
              min="0.1"
              step="0.1"
              required
            />
          </div>
        </div>

        {formData.servingsPerMeal !== null && formData.servingsPerMeal > 0 && (() => {
          const servingSizeCalc = calculateMealServingSize(formData.ingredients, formData.servingsPerMeal);
          if (!servingSizeCalc) return null;
          
          return (
            <div className="meal-size-calculation">
              <strong>Per Serving:</strong>
              <div className="serving-breakdown">
                {Object.entries(servingSizeCalc.perServing).map(([unit, amount]) => (
                  <span key={unit}>
                    {amount.toFixed(2)} {unit}
                  </span>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      <div className="form-section">
        <div className="section-header">
          <h3>Ingredients ({formData.ingredients.length})</h3>
          <button
            type="button"
            onClick={handleAddIngredient}
            className="btn btn-secondary"
          >
            + Add Ingredient
          </button>
        </div>

        {formData.ingredients.length === 0 ? (
          <p className="empty-state">No ingredients yet. Click "Add Ingredient" to get started.</p>
        ) : (
          <div className="ingredients-list">
            {formData.ingredients.map((ingredient, index) => (
              <IngredientRow
                key={ingredient.id}
                ingredient={ingredient}
                index={index}
                onUpdate={handleUpdateIngredient}
                onDelete={handleDeleteIngredient}
              />
            ))}
          </div>
        )}
      </div>

      <MacroTotals meal={formData} />

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Meal'}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-secondary" disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default MealForm;
