import React, { useState } from 'react';
import { lookupBarcode, isPlausibleBarcode } from '../utils/foodFacts.js';
import { useToast } from './Toast.jsx';

/**
 * Look a barcode up in Open Food Facts and hand the result to the caller.
 *
 * Typing a barcode is faster and far more accurate than photographing a
 * label, so this is offered ahead of OCR.
 */
function BarcodeLookup({ onFound, disabled = false }) {
  const [barcode, setBarcode] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const handleLookup = async () => {
    const trimmed = barcode.trim();
    if (!isPlausibleBarcode(trimmed)) {
      toast.error('Enter a barcode of 8 to 14 digits.');
      return;
    }

    setBusy(true);
    try {
      const found = await lookupBarcode(trimmed);
      if (!found) {
        toast.error(`No product found for ${trimmed}. Enter the values by hand, or scan the label.`);
        return;
      }

      onFound(found);
      const note = found.perServingSource === '100g'
        ? ' Values are per 100 g, because the product lists no serving size.'
        : '';
      toast.success(`Found ${found.name}.${note} Check the numbers before saving.`);
      setBarcode('');
    } catch (error) {
      toast.error(error.message || 'Barcode lookup failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="barcode-lookup">
      <label htmlFor="barcode-input">Barcode</label>
      <div className="barcode-row">
        <input
          id="barcode-input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleLookup(); } }}
          placeholder="e.g. 0123456789012"
          disabled={disabled || busy}
        />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleLookup}
          disabled={disabled || busy}
        >
          {busy ? 'Looking up...' : 'Look up'}
        </button>
      </div>
      <span className="field-hint">
        Uses Open Food Facts. Coverage is good for packaged groceries, and thin for fresh produce.
      </span>
    </div>
  );
}

export default BarcodeLookup;
