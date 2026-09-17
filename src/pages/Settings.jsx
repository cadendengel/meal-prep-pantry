import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNav from '../components/AppNav.jsx';
import { useToast } from '../components/Toast.jsx';
import { getProfile, updateProfile, getMeals, saveCurrentUser } from '../utils/api.js';
import { mealsToCsv, mealsToJson, downloadText, datedFilename } from '../utils/exportData.js';
import { reportInvalidField } from '../utils/formValidation.js';

const TARGET_FIELDS = [
  ['calories', 'Daily calories', 'e.g. 2400'],
  ['protein', 'Daily protein (g)', 'e.g. 180'],
  ['carbs', 'Daily carbs (g)', 'e.g. 250'],
  ['fat', 'Daily fat (g)', 'e.g. 70'],
];

function Settings({ user, onLogout, onProfileChange }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState(user?.name || '');
  const [targets, setTargets] = useState({ calories: '', protein: '', carbs: '', fat: '' });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const profile = await getProfile();
      setName(profile.name);
      setTargets({
        calories: profile.targets.calories ?? '',
        protein: profile.targets.protein ?? '',
        carbs: profile.targets.carbs ?? '',
        fat: profile.targets.fat ?? '',
      });
    } catch (error) {
      // The form must not render when the current values are unknown.
      // A blank form invites the user to save empty targets over the ones
      // already stored.
      setLoadError(error.message || 'Could not load your settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await updateProfile({ name, targets });
      saveCurrentUser({ id: updated.id, name: updated.name, email: updated.email });
      onProfileChange?.({ id: updated.id, name: updated.name, email: updated.email });
      toast.success('Settings saved.');
    } catch (error) {
      toast.error(error.message || 'Could not save your settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const meals = await getMeals();
      if (meals.length === 0) {
        toast.error('There is nothing to export yet.');
        return;
      }
      if (format === 'csv') {
        downloadText(datedFilename('meals', 'csv'), mealsToCsv(meals), 'text/csv');
      } else {
        downloadText(datedFilename('meals', 'json'), mealsToJson(meals), 'application/json');
      }
      toast.success(`Exported ${meals.length} meal${meals.length === 1 ? '' : 's'}.`);
    } catch (error) {
      toast.error(error.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page-container">
      <AppNav user={user} onLogout={onLogout} />

      <main className="main-content">
        <div className="dashboard-header">
          <h2>Settings</h2>
          <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">Back to Meals</button>
        </div>

        {loading ? (
          <div className="loading">Loading settings...</div>
        ) : loadError ? (
          <div className="form-section">
            <div className="error-message">{loadError}</div>
            <button type="button" className="btn btn-primary" onClick={loadProfile}>
              Try again
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave} onInvalidCapture={reportInvalidField(toast)} className="meal-form">
            <div className="form-section">
              <h3>Profile</h3>
              <div className="form-row form-row-1">
                <div className="form-group">
                  <label htmlFor="settings-name">Display name</label>
                  <input id="settings-name" type="text" value={name}
                    onChange={(e) => setName(e.target.value)} required />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Daily macro targets</h3>
              <p className="page-intro">
                Optional. When set, each meal shows how one serving fits against these numbers.
                Leave a field empty to track nothing for it.
              </p>
              <div className="form-row form-row-4">
                {TARGET_FIELDS.map(([field, label, placeholder]) => (
                  <div className="form-group" key={field}>
                    <label htmlFor={`target-${field}`}>{label}</label>
                    <input
                      id={`target-${field}`}
                      type="number"
                      min="0"
                      step="1"
                      value={targets[field]}
                      placeholder={placeholder}
                      onChange={(e) => setTargets((t) => ({ ...t, [field]: e.target.value }))}
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save settings'}
              </button>
            </div>
          </form>
        )}

        <div className="form-section">
          <h3>Export your data</h3>
          <p className="page-intro">
            Download every meal and its ingredients. CSV opens in a spreadsheet. JSON keeps the full structure.
          </p>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => handleExport('csv')} disabled={exporting}>
              {exporting ? 'Preparing...' : 'Export CSV'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => handleExport('json')} disabled={exporting}>
              {exporting ? 'Preparing...' : 'Export JSON'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Settings;
