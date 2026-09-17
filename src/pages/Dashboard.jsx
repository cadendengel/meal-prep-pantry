import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNav from '../components/AppNav.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useToast } from '../components/Toast.jsx';
import { getMeals, deleteMeal, createMeal } from '../utils/api.js';
import { calculateIngredientTotals } from '../utils/mealCalc.js';

const SORTS = [
  { key: 'updated', label: 'Recently updated' },
  { key: 'name', label: 'Name' },
  { key: 'calories', label: 'Calories per serving' },
  { key: 'protein', label: 'Protein per serving' },
  { key: 'cost', label: 'Cost per serving' },
];

/**
 * Summarize a meal for the card and for sorting.
 *
 * @param {object} meal - Meal record
 * @returns {object} Per-serving macros and cost
 */
function summarize(meal) {
  const ingredients = Array.isArray(meal.ingredients) ? meal.ingredients : [];
  const servings = Number(meal.servingsPerMeal) || 1;

  const totals = ingredients.reduce((acc, ingredient) => {
    const t = calculateIngredientTotals(ingredient);
    return {
      calories: acc.calories + t.calories,
      protein: acc.protein + t.protein,
      carbs: acc.carbs + t.carbs,
      fat: acc.fat + t.fat,
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const cost = ingredients.reduce((sum, ingredient) => {
    const price = Number(ingredient.price) || 0;
    if (!price) return sum;
    const perContainer = Number(ingredient.servingsPerContainer) || 0;
    const used = Number(ingredient.servingsUsed) || 0;
    return sum + (perContainer > 0 && used ? price * (used / perContainer) : price);
  }, 0);

  return {
    calories: totals.calories / servings,
    protein: totals.protein / servings,
    carbs: totals.carbs / servings,
    fat: totals.fat / servings,
    cost: cost / servings,
    ingredientCount: ingredients.length,
  };
}

function Dashboard({ user, onLogout, targets }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [meals, setMeals] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('updated');
  const [highProteinOnly, setHighProteinOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [duplicating, setDuplicating] = useState(null);

  useEffect(() => { loadMeals(); }, []);

  const loadMeals = async () => {
    try {
      setLoading(true);
      setError('');
      setMeals(await getMeals());
    } catch (err) {
      setError(err.message || 'Failed to load meals');
    } finally {
      setLoading(false);
    }
  };

  const decorated = useMemo(
    () => meals.map((meal) => ({ ...meal, summary: summarize(meal) })),
    [meals]
  );

  const visible = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let rows = decorated.filter((meal) => meal.name.toLowerCase().includes(term));

    // "High protein" means at least 30 g in one serving, a common
    // threshold for a main meal.
    if (highProteinOnly) {
      rows = rows.filter((meal) => meal.summary.protein >= 30);
    }

    const sorted = [...rows];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'calories': return b.summary.calories - a.summary.calories;
        case 'protein': return b.summary.protein - a.summary.protein;
        case 'cost': return a.summary.cost - b.summary.cost;
        default: return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
      }
    });
    return sorted;
  }, [decorated, searchTerm, sortBy, highProteinOnly]);

  const confirmDelete = async () => {
    const meal = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteMeal(meal.id);
      setMeals((current) => current.filter((m) => m.id !== meal.id));
      toast.success(`Deleted ${meal.name}.`);
    } catch (err) {
      toast.error(err.message || 'Failed to delete meal');
    }
  };

  const handleDuplicate = async (meal) => {
    setDuplicating(meal.id);
    try {
      const copy = await createMeal({
        name: `${meal.name} (copy)`,
        notes: meal.notes || '',
        servingSize: meal.servingSize ?? null,
        servingUnit: meal.servingUnit || 'g',
        servingsPerMeal: meal.servingsPerMeal,
        ingredients: meal.ingredients || [],
      });
      setMeals((current) => [copy, ...current]);
      toast.success(`Created ${copy.name}.`);
    } catch (err) {
      toast.error(err.message || 'Could not duplicate the meal.');
    } finally {
      setDuplicating(null);
    }
  };

  const proteinTarget = Number(targets?.protein) || 0;

  return (
    <div className="page-container">
      <AppNav user={user} onLogout={onLogout} />

      <main className="main-content">
        <div className="dashboard-header">
          <h2>My Meals</h2>
          <button onClick={() => navigate('/meal/new')} className="btn btn-primary">
            + New Meal
          </button>
        </div>

        <div className="filter-bar">
          <div className="search-box">
            <label className="visually-hidden" htmlFor="meal-search">Search meals</label>
            <input
              id="meal-search"
              type="search"
              placeholder="Search meals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="form-group filter-sort">
            <label htmlFor="meal-sort">Sort by</label>
            <select id="meal-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>

          <label className="filter-check">
            <input
              type="checkbox"
              checked={highProteinOnly}
              onChange={(e) => setHighProteinOnly(e.target.checked)}
            />
            High protein only (30g+)
          </label>
        </div>

        {loading ? (
          <div className="loading">Loading meals...</div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <p>
              {meals.length === 0
                ? 'No meals yet. Create your first meal to get started!'
                : 'No meals match those filters.'}
            </p>
          </div>
        ) : (
          <div className="meals-grid">
            {visible.map((meal) => {
              const s = meal.summary;
              const proteinShare = proteinTarget > 0 ? Math.round((s.protein / proteinTarget) * 100) : null;

              return (
                <div key={meal.id} className="meal-card">
                  <h3>{meal.name}</h3>
                  {meal.notes && <p className="meal-notes">{meal.notes}</p>}

                  <div className="meal-macros">
                    <span><strong>{s.calories.toFixed(0)}</strong> cal</span>
                    <span><strong>{s.protein.toFixed(0)}</strong>g protein</span>
                    <span><strong>{s.carbs.toFixed(0)}</strong>g carbs</span>
                    <span><strong>{s.fat.toFixed(0)}</strong>g fat</span>
                  </div>
                  <p className="meal-macros-caption">per serving</p>

                  <div className="meal-meta">
                    <span>{meal.servingsPerMeal} servings</span>
                    <span>{s.ingredientCount} ingredient{s.ingredientCount === 1 ? '' : 's'}</span>
                    {s.cost > 0 && <span>${s.cost.toFixed(2)} per serving</span>}
                    {proteinShare !== null && <span>{proteinShare}% of protein goal</span>}
                  </div>

                  <div className="meal-actions">
                    <button onClick={() => navigate(`/meal/${meal.id}`)} className="btn btn-secondary">
                      View
                    </button>
                    <button onClick={() => navigate(`/meal/${meal.id}/edit`)} className="btn btn-secondary">
                      Edit
                    </button>
                    <button
                      onClick={() => handleDuplicate(meal)}
                      className="btn btn-secondary"
                      disabled={duplicating === meal.id}
                    >
                      {duplicating === meal.id ? 'Copying...' : 'Duplicate'}
                    </button>
                    <button onClick={() => setPendingDelete(meal)} className="btn btn-danger">
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete meal"
        message={`Delete "${pendingDelete?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

export default Dashboard;
