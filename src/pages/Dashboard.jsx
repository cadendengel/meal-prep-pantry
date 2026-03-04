import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Helper functions for meal management - inline
function getMeals() {
  const mealsData = localStorage.getItem('meals');
  return mealsData ? JSON.parse(mealsData) : [];
}

function Dashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const [meals, setMeals] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Load user's meals
    const allMeals = getMeals();
    const userMeals = allMeals.filter(m => m.userId === user.id);
    setMeals(userMeals);
  }, [user.id]);

  const handleDelete = (mealId) => {
    if (!confirm('Are you sure you want to delete this meal?')) {
      return;
    }

    const allMeals = getMeals();
    const updatedMeals = allMeals.filter(m => m.id !== mealId);
    localStorage.setItem('meals', JSON.stringify(updatedMeals));
    
    setMeals(meals.filter(m => m.id !== mealId));
  };

  const filteredMeals = meals.filter(meal =>
    meal.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-container">
      <nav className="navbar">
        <div className="nav-content">
          <h1>🍽️ Meal Prep Pantry</h1>
          <div className="nav-actions">
            <span className="user-name">Hello, {user.name}</span>
            <button onClick={onLogout} className="btn btn-secondary">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <div className="dashboard-header">
          <h2>My Meals</h2>
          <button
            onClick={() => navigate('/meal/new')}
            className="btn btn-primary"
          >
            + New Meal
          </button>
        </div>

        <div className="search-box">
          <input
            type="text"
            placeholder="Search meals..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {filteredMeals.length === 0 ? (
          <div className="empty-state">
            <p>
              {searchTerm
                ? 'No meals found matching your search.'
                : 'No meals yet. Create your first meal to get started!'}
            </p>
          </div>
        ) : (
          <div className="meals-grid">
            {filteredMeals.map(meal => (
              <div key={meal.id} className="meal-card">
                <h3>{meal.name}</h3>
                {meal.notes && <p className="meal-notes">{meal.notes}</p>}
                <div className="meal-meta">
                  <span>
                    {meal.servingSize} {meal.servingUnit} × {meal.servingsPerMeal} servings
                  </span>
                  <span>{meal.ingredients?.length || 0} ingredients</span>
                </div>
                <div className="meal-actions">
                  <button
                    onClick={() => navigate(`/meal/${meal.id}`)}
                    className="btn btn-secondary"
                  >
                    View
                  </button>
                  <button
                    onClick={() => navigate(`/meal/${meal.id}/edit`)}
                    className="btn btn-secondary"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(meal.id)}
                    className="btn btn-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
