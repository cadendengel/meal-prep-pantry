import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNav from '../components/AppNav.jsx';
import { useToast } from '../components/Toast.jsx';
import { getMeals } from '../utils/api.js';
import { getStoreFromUrl } from '../utils/nutritionParser.js';
import { isSafeHttpUrl } from '../utils/mealCalc.js';
import { sumQuantities, formatQuantity } from '../utils/units.js';
import { downloadText, datedFilename } from '../utils/exportData.js';

const UNGROUPED = 'Other / no link';

/**
 * Combine the ingredients of the chosen meals into one list per store.
 *
 * Quantities of the same ingredient add up, converting between units of
 * one dimension. Mass and volume stay separate, since converting between
 * them needs a density the app does not hold.
 */
function buildList(meals, selectedIds) {
  const chosen = meals.filter((m) => selectedIds.has(m.id));
  const byKey = new Map();

  for (const meal of chosen) {
    for (const ingredient of meal.ingredients || []) {
      const name = (ingredient.name || '').trim();
      if (!name) continue;

      const key = name.toLowerCase();
      if (!byKey.has(key)) {
        byKey.set(key, {
          name,
          store: getStoreFromUrl(ingredient.productUrl) || UNGROUPED,
          productUrl: isSafeHttpUrl(ingredient.productUrl) ? ingredient.productUrl : null,
          quantities: [],
          cost: 0,
          meals: new Set(),
        });
      }

      const entry = byKey.get(key);
      entry.meals.add(meal.name);

      const servings = Number(ingredient.servingsUsed) || 0;
      const sizeQty = Number(ingredient.servingSizeQuantity) || 0;
      if (servings > 0 && sizeQty > 0 && ingredient.servingSizeUnit) {
        entry.quantities.push({ quantity: sizeQty * servings, unit: ingredient.servingSizeUnit });
      } else if (servings > 0) {
        entry.quantities.push({ quantity: servings, unit: 'serving' });
      }

      const price = Number(ingredient.price) || 0;
      const perContainer = Number(ingredient.servingsPerContainer) || 0;
      if (price > 0) {
        entry.cost += perContainer > 0 && servings > 0 ? price * (servings / perContainer) : price;
      }
    }
  }

  const byStore = new Map();
  for (const entry of byKey.values()) {
    const totals = sumQuantities(entry.quantities);
    const row = {
      ...entry,
      meals: Array.from(entry.meals),
      totals: totals.map((t) => formatQuantity(t.quantity, t.unit)).join(' + '),
    };
    if (!byStore.has(entry.store)) byStore.set(entry.store, []);
    byStore.get(entry.store).push(row);
  }

  // Named stores first, alphabetically. The unlinked bucket goes last.
  return Array.from(byStore.entries())
    .sort((a, b) => {
      if (a[0] === UNGROUPED) return 1;
      if (b[0] === UNGROUPED) return -1;
      return a[0].localeCompare(b[0]);
    })
    .map(([store, rows]) => ({
      store,
      rows: rows.sort((a, b) => a.name.localeCompare(b.name)),
      cost: rows.reduce((sum, r) => sum + r.cost, 0),
    }));
}

function ShoppingList({ user, onLogout }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [checked, setChecked] = useState(() => new Set());

  useEffect(() => {
    (async () => {
      try {
        setMeals(await getMeals());
      } catch (error) {
        toast.error(error.message || 'Could not load your meals.');
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const groups = useMemo(() => buildList(meals, selectedIds), [meals, selectedIds]);
  const grandTotal = groups.reduce((sum, g) => sum + g.cost, 0);
  const itemCount = groups.reduce((sum, g) => sum + g.rows.length, 0);

  const toggleMeal = (id) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleChecked = (name) => {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleExport = () => {
    if (itemCount === 0) {
      toast.error('Select at least one meal first.');
      return;
    }
    const lines = [];
    for (const group of groups) {
      lines.push(`## ${group.store}`);
      for (const row of group.rows) {
        lines.push(`- ${row.name}${row.totals ? ` — ${row.totals}` : ''}${row.cost > 0 ? ` ($${row.cost.toFixed(2)})` : ''}`);
      }
      lines.push('');
    }
    lines.push(`Estimated total: $${grandTotal.toFixed(2)}`);
    downloadText(datedFilename('shopping-list', 'txt'), lines.join('\n'), 'text/plain');
    toast.success('Shopping list downloaded.');
  };

  return (
    <div className="page-container">
      <AppNav user={user} onLogout={onLogout} />

      <main className="main-content">
        <div className="dashboard-header">
          <h2>Shopping List</h2>
          <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">Back to Meals</button>
        </div>

        <p className="page-intro">
          Choose the meals you plan to cook. Matching ingredients combine, and the list groups by store.
        </p>

        {loading ? (
          <div className="loading">Loading meals...</div>
        ) : meals.length === 0 ? (
          <p className="empty-state">No meals yet. Create one first.</p>
        ) : (
          <>
            <fieldset className="form-section">
              <legend><h3>Meals ({selectedIds.size} selected)</h3></legend>
              <ul className="picker-list">
                {meals.map((meal) => (
                  <li key={meal.id}>
                    <label className="picker-item">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(meal.id)}
                        onChange={() => toggleMeal(meal.id)}
                      />
                      <span className="picker-name">{meal.name}</span>
                      <span className="picker-macros">{meal.ingredients?.length || 0} ingredients</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>

            {selectedIds.size === 0 ? (
              <p className="empty-state">Select a meal above to build the list.</p>
            ) : (
              <>
                <div className="dashboard-header">
                  <h3>{itemCount} item{itemCount === 1 ? '' : 's'}</h3>
                  <button type="button" className="btn btn-secondary" onClick={handleExport}>
                    Download list
                  </button>
                </div>

                {groups.map((group) => (
                  <section className="form-section" key={group.store}>
                    <div className="section-header">
                      <h3>{group.store}</h3>
                      {group.cost > 0 && <span className="store-cost">${group.cost.toFixed(2)}</span>}
                    </div>
                    <ul className="shopping-items">
                      {group.rows.map((row) => (
                        <li key={row.name} className={checked.has(row.name) ? 'shopping-item checked' : 'shopping-item'}>
                          <label className="picker-item">
                            <input
                              type="checkbox"
                              checked={checked.has(row.name)}
                              onChange={() => toggleChecked(row.name)}
                            />
                            <span className="picker-name">
                              {row.name}
                              {row.totals && <span className="shopping-qty"> — {row.totals}</span>}
                            </span>
                            <span className="picker-macros">
                              {row.cost > 0 && `$${row.cost.toFixed(2)} · `}
                              for {row.meals.join(', ')}
                            </span>
                          </label>
                          {row.productUrl && (
                            <a href={row.productUrl} target="_blank" rel="noopener noreferrer" className="product-link">
                              Open
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}

                {grandTotal > 0 && (
                  <div className="macro-totals">
                    <h3>Estimated total</h3>
                    <div className="macro-item">
                      <span className="macro-label">Prorated by how much of each container you use:</span>
                      <span className="macro-value">${grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default ShoppingList;
