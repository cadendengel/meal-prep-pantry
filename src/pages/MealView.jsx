import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MacroTotals from '../components/MacroTotals.jsx';
import AppNav from '../components/AppNav.jsx';
import { getStoreFromUrl } from '../utils/nutritionParser.js';
import { getMeal } from '../utils/api.js';
import { calculateIngredientTotals, isSafeHttpUrl } from '../utils/mealCalc.js';
import { convert, isCountUnit } from '../utils/units.js';
import { mealsToCsv, downloadText, datedFilename } from '../utils/exportData.js';

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'amount', label: 'Amount' },
  { key: 'store', label: 'Store' },
  { key: 'calories', label: 'Calories' },
  { key: 'protein', label: 'Protein' },
  { key: 'carbs', label: 'Carbs' },
  { key: 'fat', label: 'Fat' },
  { key: 'price', label: 'Price' },
];

function servingSizeLabel(ingredient) {
  if (ingredient.servingSizeQuantity !== null && ingredient.servingSizeQuantity !== undefined) {
    return `${ingredient.servingSizeQuantity} ${ingredient.servingSizeUnit || 'serving'}`;
  }
  return ingredient.servingSize || null;
}

/**
 * Express an ingredient's macros per 100 g or 100 ml.
 *
 * This is the only fair way to compare two ingredients whose serving sizes
 * differ. It is undefined for count units such as "slice".
 */
function per100(ingredient) {
  const unit = ingredient.servingSizeUnit;
  const size = Number(ingredient.servingSizeQuantity) || 0;
  if (!unit || size <= 0 || isCountUnit(unit)) return null;

  const base = convert(size, unit, 'g') ?? convert(size, unit, 'ml');
  if (!base || base <= 0) return null;

  const factor = 100 / base;
  const basis = convert(size, unit, 'g') !== null ? '100 g' : '100 ml';

  return {
    basis,
    calories: (Number(ingredient.caloriesPerServing) || 0) * factor,
    protein: (Number(ingredient.proteinPerServing) || 0) * factor,
  };
}

function MealView({ user, onLogout, targets }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [meal, setMeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [showPer100, setShowPer100] = useState(false);

  useEffect(() => {
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
  }, [id]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  const sorted = useMemo(() => {
    if (!meal?.ingredients) return [];

    const value = (ingredient) => {
      const totals = calculateIngredientTotals(ingredient);
      switch (sortBy) {
        case 'name': return (ingredient.name || '').toLowerCase();
        case 'amount': return Number(ingredient.servingsUsed) || 0;
        case 'store': return (getStoreFromUrl(ingredient.productUrl) || '').toLowerCase();
        case 'price': return Number(ingredient.price) || 0;
        default: return totals[sortBy] ?? 0;
      }
    };

    return [...meal.ingredients].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av < bv) return sortDirection === 'asc' ? -1 : 1;
      if (av > bv) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [meal, sortBy, sortDirection]);

  if (loading) return <div className="loading">Loading...</div>;

  if (error || !meal) {
    return (
      <div className="page-container">
        <AppNav user={user} onLogout={onLogout} />
        <main className="main-content">
          <div className="error-message">{error || 'Meal not found'}</div>
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
            Back to Dashboard
          </button>
        </main>
      </div>
    );
  }

  const ariaSort = (key) => (sortBy === key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none');

  return (
    <div className="page-container">
      <AppNav user={user} onLogout={onLogout} />

      <main className="main-content">
        <div className="meal-view-header">
          <div>
            <h2>{meal.name}</h2>
            {meal.notes && <p className="meal-notes">{meal.notes}</p>}
          </div>
          <div className="meal-view-actions">
            <button onClick={() => navigate(`/meal/${meal.id}/edit`)} className="btn btn-primary">
              Edit Meal
            </button>
            <button
              onClick={() => downloadText(datedFilename(meal.name.replace(/\W+/g, '-').toLowerCase(), 'csv'), mealsToCsv([meal]), 'text/csv')}
              className="btn btn-secondary"
            >
              Export CSV
            </button>
            <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">
              Back to Dashboard
            </button>
          </div>
        </div>

        <div className="meal-info">
          {meal.servingSize != null && (
            <div className="info-item">
              <strong>Serving Size:</strong> {meal.servingSize} {meal.servingUnit}
            </div>
          )}
          <div className="info-item">
            <strong>Servings Per Meal:</strong> {meal.servingsPerMeal}
          </div>
        </div>

        <div className="section-header">
          <h3>Ingredients ({meal.ingredients?.length || 0})</h3>
          <label className="filter-check">
            <input
              type="checkbox"
              checked={showPer100}
              onChange={(e) => setShowPer100(e.target.checked)}
            />
            Show per 100 g / 100 ml
          </label>
        </div>

        {(!meal.ingredients || meal.ingredients.length === 0) ? (
          <p className="empty-state">No ingredients added yet.</p>
        ) : (
          <>
            {/* Table for wide screens. */}
            <div className="ingredients-table">
              <table>
                <caption className="visually-hidden">
                  Ingredients in {meal.name}. Use the column buttons to sort.
                </caption>
                <thead>
                  <tr>
                    {COLUMNS.map((column) => (
                      <th key={column.key} scope="col" aria-sort={ariaSort(column.key)}>
                        <button type="button" className="sort-button" onClick={() => handleSort(column.key)}>
                          {column.label}
                          <span aria-hidden="true">
                            {sortBy === column.key ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}
                          </span>
                        </button>
                      </th>
                    ))}
                    <th scope="col">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((ingredient) => {
                    const totals = calculateIngredientTotals(ingredient);
                    const hundred = showPer100 ? per100(ingredient) : null;
                    return (
                      <tr key={ingredient.id}>
                        <th scope="row" className="row-header">
                          {ingredient.name}
                          {ingredient.notes && <div className="ingredient-notes">{ingredient.notes}</div>}
                        </th>
                        <td>
                          {ingredient.servingsUsed ?? 0} servings
                          {servingSizeLabel(ingredient) && (
                            <div className="serving-detail">({servingSizeLabel(ingredient)})</div>
                          )}
                        </td>
                        <td>{getStoreFromUrl(ingredient.productUrl) || '-'}</td>
                        <td>
                          {totals.calories.toFixed(1)}
                          {hundred && <div className="serving-detail">{hundred.calories.toFixed(0)} per {hundred.basis}</div>}
                        </td>
                        <td>
                          {totals.protein.toFixed(1)}g
                          {hundred && <div className="serving-detail">{hundred.protein.toFixed(1)}g per {hundred.basis}</div>}
                        </td>
                        <td>{totals.carbs.toFixed(1)}g</td>
                        <td>{totals.fat.toFixed(1)}g</td>
                        <td>{Number(ingredient.price) ? `$${Number(ingredient.price).toFixed(2)}` : '-'}</td>
                        <td>
                          {isSafeHttpUrl(ingredient.productUrl) ? (
                            <a href={ingredient.productUrl} target="_blank" rel="noopener noreferrer" className="product-link">
                              Open<span className="visually-hidden"> {ingredient.name} product page</span>
                            </a>
                          ) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cards for narrow screens. A nine-column table does not fit a phone. */}
            <ul className="ingredient-cards">
              {sorted.map((ingredient) => {
                const totals = calculateIngredientTotals(ingredient);
                const hundred = showPer100 ? per100(ingredient) : null;
                return (
                  <li key={ingredient.id} className="ingredient-card">
                    <div className="ingredient-card-head">
                      <strong>{ingredient.name}</strong>
                      {Number(ingredient.price) > 0 && <span>${Number(ingredient.price).toFixed(2)}</span>}
                    </div>
                    <div className="ingredient-card-amount">
                      {ingredient.servingsUsed ?? 0} servings
                      {servingSizeLabel(ingredient) && ` (${servingSizeLabel(ingredient)})`}
                      {getStoreFromUrl(ingredient.productUrl) && ` · ${getStoreFromUrl(ingredient.productUrl)}`}
                    </div>
                    <div className="meal-macros">
                      <span><strong>{totals.calories.toFixed(0)}</strong> cal</span>
                      <span><strong>{totals.protein.toFixed(0)}</strong>g P</span>
                      <span><strong>{totals.carbs.toFixed(0)}</strong>g C</span>
                      <span><strong>{totals.fat.toFixed(0)}</strong>g F</span>
                    </div>
                    {hundred && (
                      <div className="serving-detail">
                        {hundred.calories.toFixed(0)} cal · {hundred.protein.toFixed(1)}g protein per {hundred.basis}
                      </div>
                    )}
                    {ingredient.notes && <div className="ingredient-notes">{ingredient.notes}</div>}
                    {isSafeHttpUrl(ingredient.productUrl) && (
                      <a href={ingredient.productUrl} target="_blank" rel="noopener noreferrer" className="product-link">
                        Open product page
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <MacroTotals meal={meal} targets={targets} />
      </main>
    </div>
  );
}

export default MealView;
