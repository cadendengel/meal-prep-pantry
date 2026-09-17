import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MealForm from '../components/MealForm.jsx';
import AppNav from '../components/AppNav.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useToast } from '../components/Toast.jsx';
import useUnsavedChanges from '../hooks/useUnsavedChanges.js';
import { getMeal, createMeal, updateMeal } from '../utils/api.js';
import { calculateMealServingSize, isSafeHttpUrl } from '../utils/mealCalc.js';

const EMPTY_MEAL = {
  name: '',
  notes: '',
  servingSize: null,
  servingUnit: 'g',
  servingsPerMeal: null,
  ingredients: [],
};

function MealEdit({ user, onLogout, targets }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();
  const isEditing = !!id;

  const [meal, setMeal] = useState(EMPTY_MEAL);
  const [loading, setLoading] = useState(isEditing);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [leaveTo, setLeaveTo] = useState(null);

  useUnsavedChanges(dirty && !saving);

  useEffect(() => {
    if (!isEditing) return;

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const found = await getMeal(id);
        if (!cancelled) setMeal(found);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Meal not found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id, isEditing]);

  const handleDirtyChange = useCallback(() => setDirty(true), []);

  const leave = (path) => {
    if (dirty) setLeaveTo(path);
    else navigate(path);
  };

  const handleSave = async (updatedMeal) => {
    if (!updatedMeal.name.trim()) {
      toast.error('Meal name is required.');
      return;
    }

    if (!updatedMeal.servingsPerMeal || updatedMeal.servingsPerMeal <= 0) {
      toast.error('Servings per meal must be greater than 0.');
      return;
    }

    for (const ingredient of updatedMeal.ingredients) {
      if (ingredient.productUrl && ingredient.productUrl.trim()) {
        if (!isSafeHttpUrl(ingredient.productUrl.trim())) {
          toast.error(`${ingredient.name || 'An ingredient'} has an invalid product URL. Use a full http:// or https:// address.`);
          return;
        }
      }
    }

    // Store one representative serving size, taken from the first unit
    // present. Meals that mix units show each separately in the form.
    const calc = calculateMealServingSize(updatedMeal.ingredients, updatedMeal.servingsPerMeal);
    let servingSize = null;
    let servingUnit = updatedMeal.servingUnit || 'g';

    if (calc) {
      const units = Object.keys(calc.perServing);
      if (units.length > 0) {
        servingUnit = units[0];
        servingSize = parseFloat(calc.perServing[servingUnit].toFixed(2));
      }
    }

    try {
      setSaving(true);
      setDirty(false);
      const payload = { ...updatedMeal, servingSize, servingUnit };
      if (isEditing) {
        await updateMeal(id, payload);
        toast.success(`Saved ${payload.name}.`);
      } else {
        await createMeal(payload);
        toast.success(`Created ${payload.name}.`);
      }
      navigate('/dashboard');
    } catch (err) {
      setDirty(true);
      toast.error(err.message || 'Failed to save meal.');
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error) {
    return (
      <div className="page-container">
        <AppNav user={user} onLogout={onLogout} />
        <main className="main-content">
          <div className="error-message">{error}</div>
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
            Back to Dashboard
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="page-container">
      <AppNav user={user} onLogout={onLogout} />

      <main className="main-content">
        <h2>{isEditing ? 'Edit Meal' : 'New Meal'}</h2>
        <MealForm
          key={id || 'new'}
          meal={meal}
          onSave={handleSave}
          onCancel={() => leave('/dashboard')}
          onDirtyChange={handleDirtyChange}
          saving={saving}
          targets={targets}
        />
      </main>

      <ConfirmDialog
        open={leaveTo !== null}
        title="Discard your changes?"
        message="This meal has edits you have not saved. Leaving now loses them."
        confirmLabel="Discard and leave"
        cancelLabel="Keep editing"
        onConfirm={() => { const to = leaveTo; setLeaveTo(null); setDirty(false); navigate(to); }}
        onCancel={() => setLeaveTo(null)}
      />
    </div>
  );
}

export default MealEdit;
