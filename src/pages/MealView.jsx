import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MacroTotals from '../components/MacroTotals.jsx';
import { getStoreFromUrl } from '../utils/nutritionParser.js';
import { getMeal } from '../utils/api.js';
import { calculateIngredientTotals, isSafeHttpUrl } from '../utils/mealCalc.js';

function getIngredientServingSizeLabel(ingredient) {
  if (ingredient.servingSizeQuantity !== null && ingredient.servingSizeQuantity !== undefined) {
    return `${ingredient.servingSizeQuantity} ${ingredient.servingSizeUnit || 'serving'}`;
  }

  if (ingredient.servingSize) {
    return ingredient.servingSize;
  }

  return null;
}

function MealView({ user, onLogout }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [meal, setMeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('name'); // field to sort by
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'

  useEffect(() => {
    loadMeal();
  }, [id]);

  const loadMeal = async () => {
    try {
      setLoading(true);
      const foundMeal = await getMeal(id);
      setMeal(foundMeal);
    } catch (err) {
      setError(err.message || 'Meal not found');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  const getSortedIngredients = () => {
    if (!meal?.ingredients) return [];

    const sorted = [...meal.ingredients].sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'name':
          aValue = (a.name || '').toLowerCase();
          bValue = (b.name || '').toLowerCase();
          break;
        case 'amount':
          aValue = a.servingsUsed || 0;
          bValue = b.servingsUsed || 0;
          break;
        case 'store':
          aValue = (getStoreFromUrl(a.productUrl) || '').toLowerCase();
          bValue = (getStoreFromUrl(b.productUrl) || '').toLowerCase();
          break;
        case 'calories':
          aValue = calculateIngredientTotals(a).calories;
          bValue = calculateIngredientTotals(b).calories;
          break;
        case 'protein':
          aValue = calculateIngredientTotals(a).protein;
          bValue = calculateIngredientTotals(b).protein;
          break;
        case 'carbs':
          aValue = calculateIngredientTotals(a).carbs;
          bValue = calculateIngredientTotals(b).carbs;
          break;
        case 'fat':
          aValue = calculateIngredientTotals(a).fat;
          bValue = calculateIngredientTotals(b).fat;
          break;
        case 'price':
          aValue = a.price || 0;
          bValue = b.price || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  };

  const renderSortIndicator = (field) => {
    if (sortBy !== field) return null;
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error || !meal) {
    return (
      <div className="page-container">
        <nav className="navbar">
          <div className="nav-content">
            <h1>🍽️ Meal Prep Pantry</h1>
            <div className="nav-actions">
              <button onClick={onLogout} className="btn btn-secondary">
                Logout
              </button>
            </div>
          </div>
        </nav>
        <main className="main-content">
          <div className="error-message">{error || 'Meal not found'}</div>
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
            Back to Dashboard
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="page-container">
      <nav className="navbar">
        <div className="nav-content">
          <h1>🍽️ Meal Prep Pantry</h1>
          <div className="nav-actions">
            <span className="user-name">{user.name}</span>
            <button onClick={onLogout} className="btn btn-secondary">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <div className="meal-view-header">
          <div>
            <h2>{meal.name}</h2>
            {meal.notes && <p className="meal-notes">{meal.notes}</p>}
          </div>
          <div className="meal-view-actions">
            <button
              onClick={() => navigate(`/meal/${meal.id}/edit`)}
              className="btn btn-primary"
            >
              Edit Meal
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn btn-secondary"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        <div className="meal-info">
          <div className="info-item">
            <strong>Serving Size:</strong> {meal.servingSize} {meal.servingUnit}
          </div>
          <div className="info-item">
            <strong>Servings Per Meal:</strong> {meal.servingsPerMeal}
          </div>
        </div>

        <h3>Ingredients ({meal.ingredients?.length || 0})</h3>
        
        {(!meal.ingredients || meal.ingredients.length === 0) ? (
          <p className="empty-state">No ingredients added yet.</p>
        ) : (
          <div className="ingredients-table">
            <table>
              <thead>
                <tr>
                  <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                    Name{renderSortIndicator('name')}
                  </th>
                  <th onClick={() => handleSort('amount')} style={{ cursor: 'pointer' }}>
                    Amount{renderSortIndicator('amount')}
                  </th>
                  <th onClick={() => handleSort('store')} style={{ cursor: 'pointer' }}>
                    Store{renderSortIndicator('store')}
                  </th>
                  <th>Link</th>
                  <th onClick={() => handleSort('calories')} style={{ cursor: 'pointer' }}>
                    Calories{renderSortIndicator('calories')}
                  </th>
                  <th onClick={() => handleSort('protein')} style={{ cursor: 'pointer' }}>
                    Protein{renderSortIndicator('protein')}
                  </th>
                  <th onClick={() => handleSort('carbs')} style={{ cursor: 'pointer' }}>
                    Carbs{renderSortIndicator('carbs')}
                  </th>
                  <th onClick={() => handleSort('fat')} style={{ cursor: 'pointer' }}>
                    Fat{renderSortIndicator('fat')}
                  </th>
                  <th onClick={() => handleSort('price')} style={{ cursor: 'pointer' }}>
                    Price{renderSortIndicator('price')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {getSortedIngredients().map((ingredient) => {
                  const totals = calculateIngredientTotals(ingredient);
                  return (
                    <tr key={ingredient.id}>
                      <td>
                        <strong>{ingredient.name}</strong>
                        {ingredient.notes && (
                          <div className="ingredient-notes">{ingredient.notes}</div>
                        )}
                      </td>
                      <td>
                        {ingredient.servingsUsed ?? 0} servings
                        {getIngredientServingSizeLabel(ingredient) && (
                          <div className="serving-detail">({getIngredientServingSizeLabel(ingredient)})</div>
                        )}
                      </td>
                      <td>{getStoreFromUrl(ingredient.productUrl) || '-'}</td>
                      <td>
                        {isSafeHttpUrl(ingredient.productUrl) ? (
                          <a
                            href={ingredient.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="product-link"
                          >
                            Open
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>{totals.calories.toFixed(1)}</td>
                      <td>{totals.protein.toFixed(1)}g</td>
                      <td>{totals.carbs.toFixed(1)}g</td>
                      <td>{totals.fat.toFixed(1)}g</td>
                      <td>
                        {Number(ingredient.price) ? `$${Number(ingredient.price).toFixed(2)}` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <MacroTotals meal={meal} />
      </main>
    </div>
  );
}

export default MealView;
