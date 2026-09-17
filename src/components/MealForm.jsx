import React, { useMemo, useState } from 'react';
import IngredientRow from './IngredientRow.jsx';
import MacroTotals from './MacroTotals.jsx';
import IngredientPicker from './IngredientPicker.jsx';
import { useToast } from './Toast.jsx';
import { generateId, calculateMealServingSize } from '../utils/mealCalc.js';
import { formatQuantity } from '../utils/units.js';

function blankIngredient() {
  return {
    id: generateId(),
    name: '',
    productUrl: '',
    barcode: '',
    servingSizeQuantity: null,
    servingSizeUnit: 'g',
    servingsPerContainer: null,
    caloriesPerServing: null,
    proteinPerServing: null,
    carbsPerServing: null,
    fatPerServing: null,
    servingsUsed: null,
    price: null,
    notes: '',
  };
}

/**
 * Copy a pantry item into a meal ingredient.
 *
 * The values are copied, not linked. A later edit to the pantry item does
 * not change this meal.
 */
function fromPantry(item) {
  return {
    id: generateId(),
    sourceIngredientId: item.id,
    name: item.name,
    productUrl: item.productUrl || '',
    barcode: item.barcode || '',
    servingSizeQuantity: item.servingSizeQuantity ?? null,
    servingSizeUnit: item.servingSizeUnit || 'serving',
    servingsPerContainer: item.servingsPerContainer ?? null,
    caloriesPerServing: item.caloriesPerServing ?? null,
    proteinPerServing: item.proteinPerServing ?? null,
    carbsPerServing: item.carbsPerServing ?? null,
    fatPerServing: item.fatPerServing ?? null,
    servingsUsed: null,
    price: item.price ?? null,
    notes: item.notes || '',
  };
}

function MealForm({ meal, onSave, onCancel, saving = false, onDirtyChange, targets }) {
  const [formData, setFormData] = useState(meal);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [scaleTo, setScaleTo] = useState('');
  // Rows added in this session start open, so a new ingredient is ready
  // to type into rather than needing a click first.
  const [autoExpandIds, setAutoExpandIds] = useState(() => new Set());
  const toast = useToast();

  const update = (updater) => {
    setFormData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      onDirtyChange?.(true);
      return next;
    });
  };

  const handleFieldChange = (field, value) => update((prev) => ({ ...prev, [field]: value }));

  const handleAddIngredient = () => {
    const created = blankIngredient();
    setAutoExpandIds((s) => new Set(s).add(created.id));
    update((prev) => ({ ...prev, ingredients: [...prev.ingredients, created] }));
  };

  const handleAddFromPantry = (items) => {
    const created = items.map(fromPantry);
    setAutoExpandIds((s) => {
      const next = new Set(s);
      created.forEach((c) => next.add(c.id));
      return next;
    });
    update((prev) => ({ ...prev, ingredients: [...prev.ingredients, ...created] }));
    toast.success(`Added ${created.length} ingredient${created.length === 1 ? '' : 's'}. Set how much each recipe uses.`);
  };

  const handleUpdateIngredient = (id, updated) => {
    update((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing) => (ing.id === id ? updated : ing)),
    }));
  };

  const handleDeleteIngredient = (id) => {
    update((prev) => ({ ...prev, ingredients: prev.ingredients.filter((ing) => ing.id !== id) }));
  };

  /**
   * Scale every ingredient so the meal yields a different number of servings.
   */
  const handleScale = () => {
    const target = parseFloat(scaleTo);
    const current = Number(formData.servingsPerMeal) || 0;

    if (!Number.isFinite(target) || target <= 0) {
      toast.error('Enter how many servings you want.');
      return;
    }
    if (current <= 0) {
      toast.error('Set the current servings per meal first.');
      return;
    }
    if (target === current) {
      toast.error('That is already the current number of servings.');
      return;
    }

    const factor = target / current;
    update((prev) => ({
      ...prev,
      servingsPerMeal: target,
      ingredients: prev.ingredients.map((ing) => ({
        ...ing,
        servingsUsed: ing.servingsUsed === null || ing.servingsUsed === undefined
          ? ing.servingsUsed
          : Number((Number(ing.servingsUsed) * factor).toFixed(4)),
      })),
    }));
    setScaleTo('');
    toast.success(`Scaled from ${current} to ${target} servings. Macros per serving stay the same.`);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave(formData);
  };

  const servingSizeCalc = useMemo(
    () => calculateMealServingSize(formData.ingredients, formData.servingsPerMeal),
    [formData.ingredients, formData.servingsPerMeal]
  );

  return (
    <form onSubmit={handleSubmit} className="meal-form">
      <div className="form-section">
        <h3>Meal Details</h3>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="meal-name">Meal Name <span className="required">*</span></label>
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

        <div className="form-row form-row-2">
          <div className="form-group">
            <label htmlFor="servings-per-meal">Servings Per Meal <span className="required">*</span></label>
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

          <div className="form-group">
            <label htmlFor="scale-to">Scale recipe to</label>
            <div className="scale-row">
              <input
                id="scale-to"
                type="number"
                min="0.1"
                step="0.1"
                value={scaleTo}
                onChange={(e) => setScaleTo(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="servings"
              />
              <button type="button" className="btn btn-secondary" onClick={handleScale}>
                Scale
              </button>
            </div>
            <span className="field-hint">Multiplies every ingredient. Per-serving macros do not change.</span>
          </div>
        </div>

        {servingSizeCalc && (
          <div className="meal-size-calculation">
            <strong>Per Serving:</strong>
            <div className="serving-breakdown">
              {Object.entries(servingSizeCalc.perServing).map(([unit, amount]) => (
                <span key={unit}>{formatQuantity(amount, unit)}</span>
              ))}
            </div>
            {servingSizeCalc.hasMultipleUnits && (
              <span className="field-hint">
                This meal mixes units that cannot convert into each other, so each is shown separately.
              </span>
            )}
          </div>
        )}
      </div>

      <div className="form-section">
        <div className="section-header">
          <h3>Ingredients ({formData.ingredients.length})</h3>
          <div className="section-actions">
            <button type="button" onClick={() => setPickerOpen(true)} className="btn btn-secondary">
              Add from pantry
            </button>
            <button type="button" onClick={handleAddIngredient} className="btn btn-secondary">
              + Add Ingredient
            </button>
          </div>
        </div>

        {formData.ingredients.length === 0 ? (
          <p className="empty-state">
            No ingredients yet. Add one from your pantry, or create a new one.
          </p>
        ) : (
          <div className="ingredients-list">
            {formData.ingredients.map((ingredient, index) => (
              <IngredientRow
                key={ingredient.id}
                ingredient={ingredient}
                index={index}
                onUpdate={handleUpdateIngredient}
                onDelete={handleDeleteIngredient}
                defaultExpanded={autoExpandIds.has(ingredient.id)}
              />
            ))}
          </div>
        )}
      </div>

      <MacroTotals meal={formData} targets={targets} />

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Meal'}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-secondary" disabled={saving}>
          Cancel
        </button>
      </div>

      <IngredientPicker
        open={pickerOpen}
        onAdd={handleAddFromPantry}
        onClose={() => setPickerOpen(false)}
      />
    </form>
  );
}

export default MealForm;
