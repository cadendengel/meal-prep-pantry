import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNav from '../components/AppNav.jsx';
import BarcodeLookup from '../components/BarcodeLookup.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useToast } from '../components/Toast.jsx';
import { getPantry, createPantryIngredient, updatePantryIngredient, deletePantryIngredient } from '../utils/api.js';
import { listUnits } from '../utils/units.js';
import { isSafeHttpUrl } from '../utils/mealCalc.js';

const EMPTY = {
  name: '', brand: '', barcode: '',
  servingSizeQuantity: '', servingSizeUnit: 'g', servingsPerContainer: '',
  caloriesPerServing: '', proteinPerServing: '', carbsPerServing: '', fatPerServing: '',
  price: '', productUrl: '', notes: '',
};

const NUMERIC_FIELDS = [
  ['servingSizeQuantity', 'Serving size', '0.1'],
  ['servingsPerContainer', 'Servings per container', '0.1'],
  ['caloriesPerServing', 'Calories', '1'],
  ['proteinPerServing', 'Protein (g)', '0.1'],
  ['carbsPerServing', 'Carbs (g)', '0.1'],
  ['fatPerServing', 'Fat (g)', '0.1'],
  ['price', 'Price per container', '0.01'],
];

function Pantry({ user, onLogout }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      setItems(await getPantry());
    } catch (error) {
      toast.error(error.message || 'Could not load the pantry.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((i) =>
      i.name.toLowerCase().includes(term) || (i.brand || '').toLowerCase().includes(term)
    );
  }, [items, search]);

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const applyLookup = (found) => {
    setForm((prev) => ({
      ...prev,
      name: found.name || prev.name,
      brand: found.brand || prev.brand,
      barcode: found.barcode || prev.barcode,
      servingSizeQuantity: found.servingSizeQuantity ?? prev.servingSizeQuantity,
      servingSizeUnit: found.servingSizeUnit || prev.servingSizeUnit,
      caloriesPerServing: found.caloriesPerServing ?? prev.caloriesPerServing,
      proteinPerServing: found.proteinPerServing ?? prev.proteinPerServing,
      carbsPerServing: found.carbsPerServing ?? prev.carbsPerServing,
      fatPerServing: found.fatPerServing ?? prev.fatPerServing,
    }));
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      ...EMPTY,
      ...Object.fromEntries(Object.entries(item).map(([k, v]) => [k, v ?? ''])),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => { setEditingId(null); setForm(EMPTY); };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      toast.error('Ingredient name is required.');
      return;
    }
    if (form.productUrl && form.productUrl.trim() && !isSafeHttpUrl(form.productUrl.trim())) {
      toast.error('Product URL must be a full http:// or https:// address.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const updated = await updatePantryIngredient(editingId, form);
        setItems((current) => current.map((i) => (i.id === editingId ? updated : i)));
        toast.success(`Updated ${updated.name}.`);
      } else {
        const created = await createPantryIngredient(form);
        setItems((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
        toast.success(`Saved ${created.name} to the pantry.`);
      }
      resetForm();
    } catch (error) {
      toast.error(error.message || 'Could not save the ingredient.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    const item = pendingDelete;
    setPendingDelete(null);
    try {
      await deletePantryIngredient(item.id);
      setItems((current) => current.filter((i) => i.id !== item.id));
      if (editingId === item.id) resetForm();
      toast.success(`Removed ${item.name}.`);
    } catch (error) {
      toast.error(error.message || 'Could not delete the ingredient.');
    }
  };

  return (
    <div className="page-container">
      <AppNav user={user} onLogout={onLogout} />

      <main className="main-content">
        <div className="dashboard-header">
          <h2>Pantry</h2>
          <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">
            Back to Meals
          </button>
        </div>

        <p className="page-intro">
          Save an ingredient once, then add it to any meal. Values are copied into the meal
          when you add it, so editing a pantry item never changes a meal you already saved.
        </p>

        <form onSubmit={handleSubmit} className="meal-form">
          <div className="form-section">
            <h3>{editingId ? 'Edit ingredient' : 'Add an ingredient'}</h3>

            {!editingId && <BarcodeLookup onFound={applyLookup} disabled={saving} />}

            <div className="form-row form-row-3">
              <div className="form-group">
                <label htmlFor="pantry-name">Name <span className="required">*</span></label>
                <input id="pantry-name" type="text" value={form.name}
                  onChange={(e) => setField('name', e.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="pantry-brand">Brand</label>
                <input id="pantry-brand" type="text" value={form.brand}
                  onChange={(e) => setField('brand', e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="pantry-barcode">Barcode</label>
                <input id="pantry-barcode" type="text" inputMode="numeric" value={form.barcode}
                  onChange={(e) => setField('barcode', e.target.value.replace(/\D/g, ''))} />
              </div>
            </div>

            <div className="form-row form-row-3">
              <div className="form-group">
                <label htmlFor="pantry-servingSizeQuantity">Serving size</label>
                <input id="pantry-servingSizeQuantity" type="number" min="0" step="0.1"
                  value={form.servingSizeQuantity}
                  onChange={(e) => setField('servingSizeQuantity', e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()} />
              </div>
              <div className="form-group">
                <label htmlFor="pantry-servingSizeUnit">Unit</label>
                <select id="pantry-servingSizeUnit" value={form.servingSizeUnit}
                  onChange={(e) => setField('servingSizeUnit', e.target.value)}>
                  {listUnits().map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="pantry-servingsPerContainer">Servings per container</label>
                <input id="pantry-servingsPerContainer" type="number" min="0" step="0.1"
                  value={form.servingsPerContainer}
                  onChange={(e) => setField('servingsPerContainer', e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()} />
              </div>
            </div>

            <div className="form-row form-row-4">
              {NUMERIC_FIELDS.slice(2, 6).map(([field, label, step]) => (
                <div className="form-group" key={field}>
                  <label htmlFor={`pantry-${field}`}>{label}</label>
                  <input id={`pantry-${field}`} type="number" min="0" step={step}
                    value={form[field]}
                    onChange={(e) => setField(field, e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()} />
                </div>
              ))}
            </div>

            <div className="form-row form-row-2">
              <div className="form-group">
                <label htmlFor="pantry-price">Price per container</label>
                <input id="pantry-price" type="number" min="0" step="0.01" value={form.price}
                  onChange={(e) => setField('price', e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label htmlFor="pantry-productUrl">Product URL</label>
                <input id="pantry-productUrl" type="url" value={form.productUrl}
                  onChange={(e) => setField('productUrl', e.target.value)} placeholder="https://..." />
                {form.productUrl && form.productUrl.trim() && !isSafeHttpUrl(form.productUrl.trim()) && (
                  <span className="field-hint field-hint-error">Use a full http:// or https:// address.</span>
                )}
              </div>
            </div>

            <div className="form-row form-row-1">
              <div className="form-group">
                <label htmlFor="pantry-notes">Notes</label>
                <input id="pantry-notes" type="text" value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)} />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add to pantry'}
              </button>
              {editingId && (
                <button type="button" className="btn btn-secondary" onClick={resetForm} disabled={saving}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        </form>

        <div className="dashboard-header">
          <h3>Saved ingredients ({items.length})</h3>
        </div>

        <div className="search-box">
          <label className="visually-hidden" htmlFor="pantry-search-list">Search saved ingredients</label>
          <input id="pantry-search-list" type="text" placeholder="Search saved ingredients..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="loading">Loading pantry...</div>
        ) : filtered.length === 0 ? (
          <p className="empty-state">
            {items.length === 0 ? 'Nothing saved yet. Add your first ingredient above.' : 'No match for that search.'}
          </p>
        ) : (
          <div className="meals-grid">
            {filtered.map((item) => (
              <div key={item.id} className="meal-card">
                <h3>{item.name}</h3>
                {item.brand && <p className="meal-notes">{item.brand}</p>}
                <div className="meal-meta">
                  <span>
                    {item.caloriesPerServing ?? '–'} cal · {item.proteinPerServing ?? '–'}g P ·{' '}
                    {item.carbsPerServing ?? '–'}g C · {item.fatPerServing ?? '–'}g F
                  </span>
                  {item.servingSizeQuantity && (
                    <span>per {item.servingSizeQuantity} {item.servingSizeUnit}</span>
                  )}
                  {item.price != null && <span>${Number(item.price).toFixed(2)} per container</span>}
                </div>
                <div className="meal-actions">
                  <button onClick={() => startEdit(item)} className="btn btn-secondary">Edit</button>
                  <button onClick={() => setPendingDelete(item)} className="btn btn-danger">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete ingredient"
        message={`Remove "${pendingDelete?.name}" from your pantry? Meals that already use it keep their own copy.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

export default Pantry;
