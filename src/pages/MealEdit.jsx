import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MealForm from '../components/MealForm.jsx';

// Helper functions - inline
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getMeals() {
  const mealsData = localStorage.getItem('meals');
  return mealsData ? JSON.parse(mealsData) : [];
}

function saveMeal(meal) {
  const allMeals = getMeals();
  const existingIndex = allMeals.findIndex(m => m.id === meal.id);
  
  if (existingIndex >= 0) {
    allMeals[existingIndex] = meal;
  } else {
    allMeals.push(meal);
  }
  
  localStorage.setItem('meals', JSON.stringify(allMeals));
}

// Calculate meal serving size based on ingredients
function calculateMealServingSize(ingredients, servingsPerMeal) {
  if (!servingsPerMeal || servingsPerMeal <= 0) return null;
  
  // Group ingredients by unit and sum total quantities used
  const byUnit = {};
  
  for (const ingredient of ingredients) {
    if (ingredient.servingSizeQuantity !== null && ingredient.servingSizeQuantity !== undefined) {
      const unit = ingredient.servingSizeUnit || 'serving';
      // Calculate total amount of this ingredient used in the meal
      const servingsUsed = ingredient.servingsUsed || 0;
      const totalQuantity = ingredient.servingSizeQuantity * servingsUsed;
      
      if (!byUnit[unit]) {
        byUnit[unit] = 0;
      }
      byUnit[unit] += totalQuantity;
    }
  }
  
  // If no ingredients with quantities, return null
  if (Object.keys(byUnit).length === 0) return null;
  
  // Divide by servings per meal for per-serving amount
  const perServing = {};
  for (const unit in byUnit) {
    perServing[unit] = byUnit[unit] / servingsPerMeal;
  }
  
  return {
    totals: byUnit,
    perServing: perServing,
    hasMultipleUnits: Object.keys(byUnit).length > 1,
  };
}

function MealEdit({ user, onLogout }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [meal, setMeal] = useState({
    id: generateId(),
    userId: user.id,
    name: '',
    notes: '',
    servingSize: null,
    servingUnit: 'g',
    servingsPerMeal: null,
    ingredients: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const [loading, setLoading] = useState(isEditing);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEditing) {
      const allMeals = getMeals();
      const foundMeal = allMeals.find(m => m.id === id);
      
      if (!foundMeal) {
        setError('Meal not found');
        setLoading(false);
        return;
      }

      if (foundMeal.userId !== user.id) {
        setError('Access denied');
        setLoading(false);
        return;
      }

      setMeal(foundMeal);
      setLoading(false);
    }
  }, [id, isEditing, user.id]);

  const handleSave = (updatedMeal) => {
    if (!updatedMeal.name.trim()) {
      alert('Meal name is required');
      return;
    }

    if (updatedMeal.servingsPerMeal <= 0) {
      alert('Servings per meal must be greater than 0');
      return;
    }

    // Validate ingredient URLs
    for (const ingredient of updatedMeal.ingredients) {
      if (ingredient.productUrl && ingredient.productUrl.trim()) {
        try {
          new URL(ingredient.productUrl);
        } catch {
          alert(`Invalid URL for ingredient: ${ingredient.name}`);
          return;
        }
      }
    }

    // Calculate and store the serving size
    const servingSizeCalc = calculateMealServingSize(updatedMeal.ingredients, updatedMeal.servingsPerMeal);
    let servingSize = null;
    let servingUnit = updatedMeal.servingUnit || 'g';

    if (servingSizeCalc) {
      // Get the first (or primary) unit and its per-serving amount
      const units = Object.keys(servingSizeCalc.perServing);
      if (units.length > 0) {
        servingUnit = units[0];
        servingSize = parseFloat(servingSizeCalc.perServing[servingUnit].toFixed(2));
      }
    }

    const mealToSave = {
      ...updatedMeal,
      servingSize,
      servingUnit,
      updatedAt: new Date().toISOString(),
    };

    saveMeal(mealToSave);
    navigate('/dashboard');
  };

  const handleCancel = () => {
    navigate('/dashboard');
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error) {
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
        <h2>{isEditing ? 'Edit Meal' : 'New Meal'}</h2>
        <MealForm
          meal={meal}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </main>
    </div>
  );
}

export default MealEdit;
