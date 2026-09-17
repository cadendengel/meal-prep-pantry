import React, { useEffect, useMemo, useState } from 'react';
import { getPantry } from '../utils/api.js';
import { useToast } from './Toast.jsx';

/**
 * Choose saved ingredients from the pantry and add them to a meal.
 *
 * The chosen values are copied into the meal, not linked to it. Editing a
 * pantry item later will not rewrite the nutrition of meals already saved.
 */
function IngredientPicker({ open, onAdd, onClose }) {
  const [pantry, setPantry] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const rows = await getPantry();
        if (!cancelled) setPantry(rows);
      } catch (error) {
        if (!cancelled) toast.error(error.message || 'Could not load the pantry.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, toast]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return pantry;
    return pantry.filter((item) =>
      item.name.toLowerCase().includes(term) || (item.brand || '').toLowerCase().includes(term)
    );
  }, [pantry, search]);

  if (!open) return null;

  const toggle = (id) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    const chosen = pantry.filter((item) => selected.has(item.id));
    if (chosen.length === 0) {
      toast.error('Select at least one ingredient.');
      return;
    }
    onAdd(chosen);
    setSelected(new Set());
    setSearch('');
    onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="picker-title">
        <h3 id="picker-title">Add from pantry</h3>

        <div className="form-group">
          <label htmlFor="pantry-search">Search</label>
          <input
            id="pantry-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or brand"
            autoFocus
          />
        </div>

        {loading ? (
          <div className="loading">Loading pantry...</div>
        ) : filtered.length === 0 ? (
          <p className="empty-state">
            {pantry.length === 0
              ? 'Your pantry is empty. Save an ingredient from the Pantry page first.'
              : 'No saved ingredient matches that search.'}
          </p>
        ) : (
          <ul className="picker-list">
            {filtered.map((item) => (
              <li key={item.id}>
                <label className="picker-item">
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => toggle(item.id)}
                  />
                  <span className="picker-name">
                    {item.name}
                    {item.brand && <span className="picker-brand"> · {item.brand}</span>}
                  </span>
                  <span className="picker-macros">
                    {item.caloriesPerServing ?? '–'} cal · {item.proteinPerServing ?? '–'}g P
                    {item.servingSizeQuantity ? ` · per ${item.servingSizeQuantity} ${item.servingSizeUnit}` : ''}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={handleAdd} disabled={selected.size === 0}>
            Add {selected.size > 0 ? `${selected.size} ` : ''}to meal
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default IngredientPicker;
