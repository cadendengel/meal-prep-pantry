import React, { useState } from 'react';
import { createWorker } from 'tesseract.js';
import { parseNutritionLabel, hasValidNutritionData, formatNutritionSummary } from '../utils/nutritionParser.js';

const SERVING_SIZE_UNITS = [
  'serving',
  'g',
  'oz',
  'ml',
  'l',
  'cup',
  'tbsp',
  'tsp',
  'lb',
  'slice',
  'piece',
  'item',
];

function IngredientRow({ ingredient, index, onUpdate, onDelete }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [macroTextInput, setMacroTextInput] = useState('');

  const handleFieldChange = (field, value) => {
    onUpdate(ingredient.id, {
      ...ingredient,
      [field]: value,
    });
  };

  const applyNutritionFromText = (text, noDataMessage) => {
    const nutritionData = parseNutritionLabel(text);

    console.log('Parsed Nutrition:', nutritionData);

    if (!hasValidNutritionData(nutritionData)) {
      alert(noDataMessage);
      return false;
    }

    const updatedIngredient = { ...ingredient };

    if (nutritionData.servingSizeQuantity !== null) {
      updatedIngredient.servingSizeQuantity = nutritionData.servingSizeQuantity;
    }
    if (nutritionData.servingSizeUnit) {
      updatedIngredient.servingSizeUnit = nutritionData.servingSizeUnit;
    }
    if (nutritionData.servingSize !== null) {
      updatedIngredient.servingSize = nutritionData.servingSize;
    }
    if (nutritionData.servingsPerContainer !== null) {
      updatedIngredient.servingsPerContainer = nutritionData.servingsPerContainer;
    }
    if (nutritionData.calories !== null) {
      updatedIngredient.caloriesPerServing = nutritionData.calories;
    }
    if (nutritionData.protein !== null) {
      updatedIngredient.proteinPerServing = nutritionData.protein;
    }
    if (nutritionData.carbs !== null) {
      updatedIngredient.carbsPerServing = nutritionData.carbs;
    }
    if (nutritionData.fat !== null) {
      updatedIngredient.fatPerServing = nutritionData.fat;
    }

    onUpdate(ingredient.id, updatedIngredient);

    const summary = formatNutritionSummary(nutritionData);
    alert(`✅ Nutrition data extracted!\n\n${summary}\n\nPlease review and adjust if needed.`);

    return true;
  };

  const processImage = async (file) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    setIsProcessingOCR(true);
    setOcrProgress(0);

    try {
      // Convert image to canvas for universal format support (including AVIF, WebP, etc.)
      const imageUrl = URL.createObjectURL(file);
      const img = new Image();
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageUrl;
      });

      // Create canvas and draw image
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      // Clean up
      URL.revokeObjectURL(imageUrl);

      // Create Tesseract worker
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });

      // Perform OCR on canvas (supports all image formats)
      const { data: { text } } = await worker.recognize(canvas);
      
      console.log('OCR Text:', text);

      // Terminate worker
      await worker.terminate();

      const parsedSuccessfully = applyNutritionFromText(
        text,
        '⚠️ Could not extract nutrition information from the image.\n\nPlease make sure:\n- The image is clear and well-lit\n- The nutrition label is fully visible\n- Text is readable\n\nYou can try taking another photo or entering the data manually.'
      );

      if (!parsedSuccessfully) {
        setIsProcessingOCR(false);
        return;
      }

    } catch (error) {
      console.error('OCR Error:', error);
      alert('❌ Failed to process image.\n\nError: ' + error.message + '\n\nPlease try again or enter data manually.');
    } finally {
      setIsProcessingOCR(false);
      setOcrProgress(0);
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await processImage(file);
    
    // Clear the file input
    event.target.value = '';
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessingOCR) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isProcessingOCR) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      await processImage(file);
    }
  };

  const handleMacroTextParse = () => {
    const trimmedText = macroTextInput.trim();
    if (!trimmedText) {
      alert('Please paste or type nutrition text first.');
      return;
    }

    const parsedSuccessfully = applyNutritionFromText(
      trimmedText,
      '⚠️ Could not extract nutrition information from the entered text.\n\nTry including lines like:\n- Serving size\n- Calories\n- Total Fat\n- Total Carbohydrate\n- Protein'
    );

    if (parsedSuccessfully) {
      setMacroTextInput('');
    }
  };

  return (
    <div className="ingredient-row">
      <div className="ingredient-header">
        <button
          type="button"
          className="expand-button"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '▼' : '▶'}
        </button>
        <span className="ingredient-number">#{index + 1}</span>
        <input
          type="text"
          value={ingredient.name}
          onChange={(e) => handleFieldChange('name', e.target.value)}
          placeholder="Ingredient name"
          className="ingredient-name-input"
        />
        <button
          type="button"
          onClick={() => onDelete(ingredient.id)}
          className="btn btn-danger btn-sm"
        >
          Delete
        </button>
      </div>

      {isExpanded && (
        <div className="ingredient-details">
          <div className="nutrition-label-upload">
            <div className="form-group-label">
              <label>📸 Scan Nutrition Label</label>
            </div>
            <div 
              className={`upload-section ${isDragging ? 'dragging' : ''} ${isProcessingOCR ? 'processing' : ''}`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={isProcessingOCR}
                id={`nutrition-upload-${ingredient.id}`}
                style={{ display: 'none' }}
              />
              <div className="upload-content">
                {isProcessingOCR ? (
                  <div className="processing-indicator">
                    <div className="spinner"></div>
                    <span>Processing... {ocrProgress}%</span>
                  </div>
                ) : isDragging ? (
                  <div className="drag-indicator">
                    <span className="drag-icon">📂</span>
                    <span>Drop image here</span>
                  </div>
                ) : (
                  <>
                    <span className="upload-icon">📷</span>
                    <label
                      htmlFor={`nutrition-upload-${ingredient.id}`}
                      className="btn btn-secondary btn-upload"
                    >
                      Upload Photo
                    </label>
                    <span className="upload-divider">or</span>
                    <span className="drag-text">Drag & drop nutrition label image here</span>
                  </>
                )}
              </div>
            </div>
            <span className="upload-help-text">
              Upload or drag a photo of the nutrition label to auto-fill macros
            </span>

            <div className="form-row form-row-1">
              <div className="form-group">
                <label>Or paste nutrition text</label>
                <textarea
                  value={macroTextInput}
                  onChange={(e) => setMacroTextInput(e.target.value)}
                  placeholder="Paste nutrition label text here (e.g., Serving size, Calories, Protein, Carbs, Fat)..."
                  rows="4"
                  disabled={isProcessingOCR}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm macro-text-parse-button"
                  onClick={handleMacroTextParse}
                  disabled={isProcessingOCR}
                >
                  Parse Text
                </button>
              </div>
            </div>
          </div>

          <div className="form-group-label">
            <label>📋 Nutrition Facts (Per Serving)</label>
            <span className="label-subtitle">As shown on the nutrition label</span>
          </div>

          <div className="form-row form-row-3">
            <div className="form-group">
              <label>Serving Size Quantity</label>
              <input
                type="number"
                value={ingredient.servingSizeQuantity ?? ''}
                onChange={(e) => handleFieldChange('servingSizeQuantity', e.target.value ? parseFloat(e.target.value) : null)}
                onWheel={(e) => e.currentTarget.blur()}
                min="0"
                step="0.1"
                placeholder="e.g., 1"
              />
            </div>

            <div className="form-group">
              <label>Serving Size Unit</label>
              <select
                value={ingredient.servingSizeUnit || 'serving'}
                onChange={(e) => handleFieldChange('servingSizeUnit', e.target.value)}
              >
                {SERVING_SIZE_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Servings Per Container (optional)</label>
              <input
                type="number"
                value={ingredient.servingsPerContainer ?? ''}
                onChange={(e) => handleFieldChange('servingsPerContainer', e.target.value ? parseFloat(e.target.value) : null)}
                onWheel={(e) => e.currentTarget.blur()}
                min="0"
                step="0.1"
                placeholder="e.g., 2.5"
              />
            </div>
          </div>

          <div className="form-row form-row-4">
            <div className="form-group">
              <label>Calories</label>
              <input
                type="number"
                value={ingredient.caloriesPerServing ?? ''}
                onChange={(e) => handleFieldChange('caloriesPerServing', e.target.value ? parseFloat(e.target.value) : null)}
                onWheel={(e) => e.currentTarget.blur()}
                min="0"
                step="0.1"
              />
            </div>

            <div className="form-group">
              <label>Protein (g)</label>
              <input
                type="number"
                value={ingredient.proteinPerServing ?? ''}
                onChange={(e) => handleFieldChange('proteinPerServing', e.target.value ? parseFloat(e.target.value) : null)}
                onWheel={(e) => e.currentTarget.blur()}
                min="0"
                step="0.1"
              />
            </div>

            <div className="form-group">
              <label>Carbs (g)</label>
              <input
                type="number"
                value={ingredient.carbsPerServing ?? ''}
                onChange={(e) => handleFieldChange('carbsPerServing', e.target.value ? parseFloat(e.target.value) : null)}
                onWheel={(e) => e.currentTarget.blur()}
                min="0"
                step="0.1"
              />
            </div>

            <div className="form-group">
              <label>Fat (g)</label>
              <input
                type="number"
                value={ingredient.fatPerServing ?? ''}
                onChange={(e) => handleFieldChange('fatPerServing', e.target.value ? parseFloat(e.target.value) : null)}
                onWheel={(e) => e.currentTarget.blur()}
                min="0"
                step="0.1"
              />
            </div>
          </div>

          <div className="form-group-label">
            <label>🥘 Recipe Usage</label>
            <span className="label-subtitle">How much you're using in this meal</span>
          </div>

          <div className="form-row form-row-1">
            <div className="form-group">
              <label>Number of Servings Used</label>
              <input
                type="number"
                value={ingredient.servingsUsed ?? ''}
                onChange={(e) => handleFieldChange('servingsUsed', e.target.value ? parseFloat(e.target.value) : null)}
                onWheel={(e) => e.currentTarget.blur()}
                min="0"
                step="0.1"
                placeholder="e.g., 2.5"
              />
              <span className="field-hint">
                {ingredient.servingsUsed && ingredient.servingSizeQuantity && 
                  `= ${ingredient.servingsUsed} × ${ingredient.servingSizeQuantity} ${ingredient.servingSizeUnit || 'serving'}`
                }
              </span>
            </div>
          </div>

          <div className="form-row form-row-2">
            <div className="form-group">
              <label>Price (optional)</label>
              <input
                type="number"
                value={ingredient.price ?? ''}
                onChange={(e) => handleFieldChange('price', e.target.value ? parseFloat(e.target.value) : null)}
                onWheel={(e) => e.currentTarget.blur()}
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label>Product URL (optional)</label>
              <input
                type="url"
                value={ingredient.productUrl}
                onChange={(e) => handleFieldChange('productUrl', e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="form-row form-row-1">
            <div className="form-group">
              <label>Notes</label>
              <input
                type="text"
                value={ingredient.notes || ''}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                placeholder="Additional notes..."
              />
            </div>
          </div>

          <div className="ingredient-totals">
            <strong>Ingredient Totals:</strong>
            <span>
              {(ingredient.caloriesPerServing * ingredient.servingsUsed).toFixed(1)} cal
            </span>
            <span>
              {(ingredient.proteinPerServing * ingredient.servingsUsed).toFixed(1)}g protein
            </span>
            <span>
              {(ingredient.carbsPerServing * ingredient.servingsUsed).toFixed(1)}g carbs
            </span>
            <span>
              {(ingredient.fatPerServing * ingredient.servingsUsed).toFixed(1)}g fat
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default IngredientRow;
