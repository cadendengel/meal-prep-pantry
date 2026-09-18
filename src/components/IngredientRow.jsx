import React, { useState } from 'react';
import { createWorker } from 'tesseract.js';
import { parseNutritionLabel, hasValidNutritionData, formatNutritionSummary } from '../utils/nutritionParser.js';
import { calculateIngredientTotals, isSafeHttpUrl } from '../utils/mealCalc.js';
import { listUnits, isCountUnit } from '../utils/units.js';
import { createPantryIngredient } from '../utils/api.js';
import { useToast } from './Toast.jsx';
import BarcodeLookup from './BarcodeLookup.jsx';

const MACRO_FIELDS = [
  ['caloriesPerServing', 'Calories', '1'],
  ['proteinPerServing', 'Protein (g)', '0.1'],
  ['carbsPerServing', 'Carbs (g)', '0.1'],
  ['fatPerServing', 'Fat (g)', '0.1'],
];

function IngredientRow({ ingredient, index, onUpdate, onDelete, defaultExpanded = false }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [macroTextInput, setMacroTextInput] = useState('');
  const [savingToPantry, setSavingToPantry] = useState(false);
  const toast = useToast();

  // Field ids must be unique per row, so labels bind to the right input.
  const fieldId = (name) => `ing-${ingredient.id}-${name}`;

  const handleFieldChange = (field, value) => {
    onUpdate(ingredient.id, { ...ingredient, [field]: value });
  };

  const applyNutritionFromText = (text, noDataMessage) => {
    const nutritionData = parseNutritionLabel(text);

    if (!hasValidNutritionData(nutritionData)) {
      toast.error(noDataMessage);
      return false;
    }

    const updated = { ...ingredient };
    if (nutritionData.servingSizeQuantity !== null) updated.servingSizeQuantity = nutritionData.servingSizeQuantity;
    if (nutritionData.servingSizeUnit) updated.servingSizeUnit = nutritionData.servingSizeUnit;
    if (nutritionData.servingSize !== null) updated.servingSize = nutritionData.servingSize;
    if (nutritionData.servingsPerContainer !== null) updated.servingsPerContainer = nutritionData.servingsPerContainer;
    if (nutritionData.calories !== null) updated.caloriesPerServing = nutritionData.calories;
    if (nutritionData.protein !== null) updated.proteinPerServing = nutritionData.protein;
    if (nutritionData.carbs !== null) updated.carbsPerServing = nutritionData.carbs;
    if (nutritionData.fat !== null) updated.fatPerServing = nutritionData.fat;

    onUpdate(ingredient.id, updated);
    toast.success(`Filled in: ${formatNutritionSummary(nutritionData).replace(/\n/g, ' · ')}. Check the values.`);
    return true;
  };

  const applyBarcodeResult = (found) => {
    onUpdate(ingredient.id, {
      ...ingredient,
      name: ingredient.name || found.name,
      servingSizeQuantity: found.servingSizeQuantity ?? ingredient.servingSizeQuantity,
      servingSizeUnit: found.servingSizeUnit || ingredient.servingSizeUnit,
      caloriesPerServing: found.caloriesPerServing ?? ingredient.caloriesPerServing,
      proteinPerServing: found.proteinPerServing ?? ingredient.proteinPerServing,
      carbsPerServing: found.carbsPerServing ?? ingredient.carbsPerServing,
      fatPerServing: found.fatPerServing ?? ingredient.fatPerServing,
      barcode: found.barcode || ingredient.barcode || '',
    });
  };

  const processImage = async (file) => {
    if (!file.type.startsWith('image/')) {
      toast.error('That file is not an image.');
      return;
    }

    setIsProcessingOCR(true);
    setOcrProgress(0);

    let worker = null;

    try {
      const imageUrl = URL.createObjectURL(file);
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(imageUrl);

      worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') setOcrProgress(Math.round(m.progress * 100));
        },
      });

      const { data: { text } } = await worker.recognize(canvas);

      applyNutritionFromText(
        text,
        'Could not read nutrition values from that image. Try the barcode lookup, or type the values in.'
      );
    } catch (error) {
      toast.error(`Could not process the image: ${error.message}`);
    } finally {
      // A worker holds a WebAssembly instance and a thread. Terminating it
      // only on the success path leaks one per failed scan, and a few bad
      // photos in a row are exactly when that happens.
      if (worker) {
        try {
          await worker.terminate();
        } catch (terminateError) {
          console.error('Could not terminate the OCR worker:', terminateError);
        }
      }
      setIsProcessingOCR(false);
      setOcrProgress(0);
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processImage(file);
    event.target.value = '';
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isProcessingOCR) return;
    const file = e.dataTransfer.files?.[0];
    if (file) await processImage(file);
  };

  const handleMacroTextParse = () => {
    const trimmed = macroTextInput.trim();
    if (!trimmed) {
      toast.error('Paste the nutrition text first.');
      return;
    }
    const ok = applyNutritionFromText(
      trimmed,
      'No nutrition values found. Include lines such as Calories, Total Fat, Total Carbohydrate and Protein.'
    );
    if (ok) setMacroTextInput('');
  };

  const handleSaveToPantry = async () => {
    if (!ingredient.name?.trim()) {
      toast.error('Give the ingredient a name before saving it to the pantry.');
      return;
    }
    setSavingToPantry(true);
    try {
      await createPantryIngredient(ingredient);
      toast.success(`Saved ${ingredient.name} to your pantry.`);
    } catch (error) {
      toast.error(error.message || 'Could not save to the pantry.');
    } finally {
      setSavingToPantry(false);
    }
  };

  const totals = calculateIngredientTotals(ingredient);

  // When the label states a serving size, the amount used can be entered
  // in that unit instead of in servings. Entering 150 g is easier than
  // working out that 150 g is 2.68 servings of 56 g.
  const sizeQuantity = Number(ingredient.servingSizeQuantity) || 0;
  const unit = ingredient.servingSizeUnit || 'serving';
  const canUseAmount = sizeQuantity > 0 && !isCountUnit(unit);
  const servingsUsed = Number(ingredient.servingsUsed) || 0;
  const amountUsed = canUseAmount && ingredient.servingsUsed !== null && ingredient.servingsUsed !== undefined
    ? Number((servingsUsed * sizeQuantity).toFixed(2))
    : '';

  const handleAmountChange = (value) => {
    if (value === '') {
      handleFieldChange('servingsUsed', null);
      return;
    }
    const amount = parseFloat(value);
    if (!Number.isFinite(amount) || sizeQuantity <= 0) return;
    handleFieldChange('servingsUsed', Number((amount / sizeQuantity).toFixed(4)));
  };

  return (
    <div className="ingredient-row">
      <div className="ingredient-header">
        <button
          type="button"
          className="expand-button"
          onClick={() => setIsExpanded((v) => !v)}
          aria-expanded={isExpanded}
          aria-controls={`ing-details-${ingredient.id}`}
        >
          <span aria-hidden="true">{isExpanded ? '▼' : '▶'}</span>
          <span className="visually-hidden">
            {isExpanded ? 'Collapse' : 'Expand'} ingredient {index + 1}
          </span>
        </button>

        <span className="ingredient-number">#{index + 1}</span>

        <label className="visually-hidden" htmlFor={fieldId('name')}>
          Ingredient {index + 1} name
        </label>
        <input
          id={fieldId('name')}
          type="text"
          value={ingredient.name}
          onChange={(e) => handleFieldChange('name', e.target.value)}
          placeholder="Ingredient name"
          className="ingredient-name-input"
        />

        {!isExpanded && (
          <span className="ingredient-summary">
            {totals.calories.toFixed(0)} cal · {totals.protein.toFixed(0)}g P
          </span>
        )}

        <button
          type="button"
          onClick={() => onDelete(ingredient.id)}
          className="btn btn-danger btn-sm"
        >
          Delete<span className="visually-hidden"> ingredient {index + 1}</span>
        </button>
      </div>

      {isExpanded && (
        <div className="ingredient-details" id={`ing-details-${ingredient.id}`}>
          <div className="nutrition-label-upload">
            <div className="form-group-label">
              <label id={fieldId('fill-heading')}>Fill in the nutrition facts</label>
              <span className="label-subtitle">Barcode is the most accurate. OCR is the least.</span>
            </div>

            <BarcodeLookup onFound={applyBarcodeResult} disabled={isProcessingOCR} />

            <div
              className={`upload-section ${isDragging ? 'dragging' : ''} ${isProcessingOCR ? 'processing' : ''}`}
              onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); if (!isProcessingOCR) setIsDragging(true); }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={isProcessingOCR}
                id={fieldId('upload')}
                className="visually-hidden"
              />
              <div className="upload-content">
                {isProcessingOCR ? (
                  <div className="processing-indicator">
                    <div className="spinner" />
                    <span>Reading label... {ocrProgress}%</span>
                  </div>
                ) : isDragging ? (
                  <div className="drag-indicator">
                    <span className="drag-icon" aria-hidden="true">📂</span>
                    <span>Drop the image here</span>
                  </div>
                ) : (
                  <>
                    <span className="upload-icon" aria-hidden="true">📷</span>
                    <label htmlFor={fieldId('upload')} className="btn btn-secondary btn-upload">
                      Scan a label photo
                    </label>
                    <span className="drag-text">or drag an image here</span>
                  </>
                )}
              </div>
            </div>

            <div className="form-row form-row-1">
              <div className="form-group">
                <label htmlFor={fieldId('paste')}>Or paste the nutrition text</label>
                <textarea
                  id={fieldId('paste')}
                  value={macroTextInput}
                  onChange={(e) => setMacroTextInput(e.target.value)}
                  placeholder="Serving size 1 cup (240g), Calories 150, Total Fat 8g, Total Carbohydrate 30g, Protein 9g"
                  rows="3"
                  disabled={isProcessingOCR}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm macro-text-parse-button"
                  onClick={handleMacroTextParse}
                  disabled={isProcessingOCR}
                >
                  Parse text
                </button>
              </div>
            </div>
          </div>

          <div className="form-group-label">
            <label>Nutrition facts, per serving</label>
            <span className="label-subtitle">Copy these from the label as printed</span>
          </div>

          <div className="form-row form-row-3">
            <div className="form-group">
              <label htmlFor={fieldId('sizeQty')}>Serving size</label>
              <input
                id={fieldId('sizeQty')}
                type="number" min="0" step="any"
                value={ingredient.servingSizeQuantity ?? ''}
                onChange={(e) => handleFieldChange('servingSizeQuantity', e.target.value ? parseFloat(e.target.value) : null)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="e.g. 56"
              />
            </div>

            <div className="form-group">
              <label htmlFor={fieldId('sizeUnit')}>Unit</label>
              <select
                id={fieldId('sizeUnit')}
                value={unit}
                onChange={(e) => handleFieldChange('servingSizeUnit', e.target.value)}
              >
                {listUnits().map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor={fieldId('perContainer')}>Servings per container</label>
              <input
                id={fieldId('perContainer')}
                type="number" min="0" step="any"
                value={ingredient.servingsPerContainer ?? ''}
                onChange={(e) => handleFieldChange('servingsPerContainer', e.target.value ? parseFloat(e.target.value) : null)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="e.g. 2.5"
              />
            </div>
          </div>

          <div className="form-row form-row-4">
            {MACRO_FIELDS.map(([field, label, step]) => (
              <div className="form-group" key={field}>
                <label htmlFor={fieldId(field)}>{label}</label>
                <input
                  id={fieldId(field)}
                  type="number" min="0" step="any"
                  value={ingredient[field] ?? ''}
                  onChange={(e) => handleFieldChange(field, e.target.value ? parseFloat(e.target.value) : null)}
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </div>
            ))}
          </div>

          <div className="form-group-label">
            <label>How much this recipe uses</label>
          </div>

          <div className="form-row form-row-2">
            {canUseAmount && (
              <div className="form-group">
                <label htmlFor={fieldId('amount')}>Amount used ({unit})</label>
                <input
                  id={fieldId('amount')}
                  type="number" min="0" step="any"
                  value={amountUsed}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder={`e.g. 150`}
                />
                <span className="field-hint">Enter grams or servings. Each updates the other.</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor={fieldId('servingsUsed')}>Servings used</label>
              <input
                id={fieldId('servingsUsed')}
                type="number" min="0" step="any"
                value={ingredient.servingsUsed ?? ''}
                onChange={(e) => handleFieldChange('servingsUsed', e.target.value ? parseFloat(e.target.value) : null)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="e.g. 2.5"
              />
              {canUseAmount && servingsUsed > 0 && (
                <span className="field-hint">
                  = {(servingsUsed * sizeQuantity).toFixed(1)} {unit}
                </span>
              )}
            </div>
          </div>

          <div className="form-row form-row-2">
            <div className="form-group">
              <label htmlFor={fieldId('price')}>Price per container</label>
              <input
                id={fieldId('price')}
                type="number" min="0" step="0.01"
                value={ingredient.price ?? ''}
                onChange={(e) => handleFieldChange('price', e.target.value ? parseFloat(e.target.value) : null)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label htmlFor={fieldId('productUrl')}>Product URL</label>
              <input
                id={fieldId('productUrl')}
                type="url"
                value={ingredient.productUrl || ''}
                onChange={(e) => handleFieldChange('productUrl', e.target.value)}
                placeholder="https://..."
              />
              {ingredient.productUrl && ingredient.productUrl.trim() && !isSafeHttpUrl(ingredient.productUrl.trim()) && (
                <span className="field-hint field-hint-error">Use a full http:// or https:// address.</span>
              )}
            </div>
          </div>

          <div className="form-row form-row-1">
            <div className="form-group">
              <label htmlFor={fieldId('notes')}>Notes</label>
              <input
                id={fieldId('notes')}
                type="text"
                value={ingredient.notes || ''}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
              />
            </div>
          </div>

          <div className="ingredient-totals">
            <strong>This ingredient contributes:</strong>
            <span>{totals.calories.toFixed(1)} cal</span>
            <span>{totals.protein.toFixed(1)}g protein</span>
            <span>{totals.carbs.toFixed(1)}g carbs</span>
            <span>{totals.fat.toFixed(1)}g fat</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleSaveToPantry}
              disabled={savingToPantry}
            >
              {savingToPantry ? 'Saving...' : 'Save to pantry'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default IngredientRow;
