import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MealForm from '../components/MealForm.jsx';
import { getMeal, createMeal, updateMeal } from '../utils/api.js';
import { calculateMealServingSize, isSafeHttpUrl } from '../utils/mealCalc.js';

function MealEdit({ user, onLogout }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [meal, setMeal] = useState({
    name: '',
    notes: '',
    servingSize: null,
    servingUnit: 'g',
    servingsPerMeal: null,
    ingredients: [],
  });

  const [loading, setLoading] = useState(isEditing);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEditing) {
      loadMeal();
    }
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

  const handleSave = async (updatedMeal) => {
    if (!updatedMeal.name.trim()) {
      alert('Meal name is required');
      return;
    }

    if (updatedMeal.servingsPerMeal <= 0) {
      alert('Servings per meal must be greater than 0');
      return;
    }

    // Validate ingredient URLs. The API repeats this check, because a
    // client-side check alone does not protect the stored data.
    for (const ingredient of updatedMeal.ingredients) {
      if (ingredient.productUrl && ingredient.productUrl.trim()) {
        if (!isSafeHttpUrl(ingredient.productUrl.trim())) {
          alert(`Invalid URL for ingredient: ${ingredient.name || 'unnamed'}\n\nUse a full http:// or https:// address.`);
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

    const mealData = {
      ...updatedMeal,
      servingSize,
      servingUnit,
    };

    try {
      setSaving(true);
      if (isEditing) {
        await updateMeal(id, mealData);
      } else {
        await createMeal(mealData);
      }
      navigate('/dashboard');
    } catch (err) {
      alert(err.message || 'Failed to save meal');
      setSaving(false);
    }
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
          key={id || 'new'}
          meal={meal}
          onSave={handleSave}
          onCancel={handleCancel}
          saving={saving}
        />
      </main>
    </div>
  );
}

export default MealEdit;
