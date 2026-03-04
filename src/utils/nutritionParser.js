/**
 * Nutrition Label Parser
 * 
 * Parses OCR text from nutrition labels to extract macro information.
 * Handles various nutrition label formats and text variations.
 */

/**
 * Extract store name from URL
 * @param {string} url - Product URL
 * @returns {string | null} - Store name (e.g., 'HEB', 'Sam\'s Club', 'Amazon')
 */
export function getStoreFromUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Store name mappings
    const storeMap = {
      'amazon.com': 'Amazon',
      'walmart.com': 'Walmart',
      'heb.com': 'HEB',
      'samsclub.com': "Sam's Club",
      'kroger.com': 'Kroger',
      'safeway.com': 'Safeway',
      'albertsons.com': 'Albertsons',
      'trader-joes.com': "Trader Joe's",
      'whole-foods-market.com': 'Whole Foods',
      'wholefoods.com': 'Whole Foods',
      'costco.com': 'Costco',
      'target.com': 'Target',
      'sprouts.com': 'Sprouts',
      'instacart.com': 'Instacart',
      'doordash.com': 'DoorDash',
      'aldi.com': 'Aldi',
      'publix.com': 'Publix',
      'wegmans.com': 'Wegmans',
      'ralphs.com': 'Ralphs',
      'vons.com': 'Vons',
      'piggly-wiggly.com': "Piggly Wiggly",
      'whole-foods.com': 'Whole Foods',
    };
    
    // Remove 'www.' prefix for lookup
    const cleanedHostname = hostname.replace(/^www\./, '');
    
    // Check for exact match
    if (storeMap[cleanedHostname]) {
      return storeMap[cleanedHostname];
    }
    
    // Check for partial matches (e.g., subdomain stores)
    for (const [domain, name] of Object.entries(storeMap)) {
      if (cleanedHostname.includes(domain) || domain.includes(cleanedHostname)) {
        return name;
      }
    }
    
    // If no match found, return the domain as-is with capitalized first letter
    return cleanedHostname.split('.')[0].charAt(0).toUpperCase() + cleanedHostname.split('.')[0].slice(1);
  } catch {
    // Invalid URL
    return null;
  }
}

/**
 * Parse serving size string into quantity + normalized unit
 * @param {string} servingSizeText - Raw serving size text
 * @returns {{quantity: number | null, unit: string | null}}
 */
function parseServingSizeComponents(servingSizeText) {
  if (!servingSizeText) {
    return { quantity: null, unit: null };
  }

  const cleaned = servingSizeText.toLowerCase().trim();
  const quantityMatch = cleaned.match(/(\d+\.?\d*|\d+\s*\/\s*\d+)/);

  let quantity = null;
  if (quantityMatch) {
    const raw = quantityMatch[1].replace(/\s+/g, '');
    if (raw.includes('/')) {
      const [numerator, denominator] = raw.split('/').map(Number);
      if (denominator) {
        quantity = numerator / denominator;
      }
    } else {
      quantity = parseFloat(raw);
    }
  }

  const unitPatterns = [
    { pattern: /\bgrams?\b|\bg\b/, unit: 'g' },
    { pattern: /\bounces?\b|\boz\b/, unit: 'oz' },
    { pattern: /\bmilliliters?\b|\bml\b/, unit: 'ml' },
    { pattern: /\bliters?\b|\bl\b/, unit: 'l' },
    { pattern: /\bcups?\b|\bc\b/, unit: 'cup' },
    { pattern: /\btablespoons?\b|\btbsp\b/, unit: 'tbsp' },
    { pattern: /\bteaspoons?\b|\btsp\b/, unit: 'tsp' },
    { pattern: /\bpounds?\b|\blbs?\b|\blb\b/, unit: 'lb' },
    { pattern: /\bservings?\b/, unit: 'serving' },
    { pattern: /\bslices?\b/, unit: 'slice' },
    { pattern: /\bpieces?\b/, unit: 'piece' },
    { pattern: /\bitems?\b/, unit: 'item' },
  ];

  for (const { pattern, unit } of unitPatterns) {
    if (pattern.test(cleaned)) {
      return { quantity, unit };
    }
  }

  return { quantity, unit: quantity !== null ? 'serving' : null };
}

/**
 * Parse nutrition label text and extract macros
 * @param {string} text - OCR extracted text from nutrition label
 * @returns {object} Parsed nutrition data
 */
export function parseNutritionLabel(text) {
  const result = {
    servingSize: null,
    servingSizeQuantity: null,
    servingSizeUnit: null,
    servingsPerContainer: null,
    calories: null,
    protein: null,
    carbs: null,
    fat: null,
  };

  // Normalize text: convert to lowercase, remove extra spaces
  const normalizedText = text.toLowerCase().replace(/\s+/g, ' ');
  

  // Extract serving size (keep original case for display)
  const servingSizePatterns = [
    /serving size[:\s]+([^\n]+?)(?=\n|$)/i,
    /servings?[:\s]+([0-9.]+\s*[a-z]+[^\n]*?)(?=\n|$)/i,
  ];

  for (const pattern of servingSizePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.servingSize = match[1].trim();
      const parsedServing = parseServingSizeComponents(result.servingSize);
      result.servingSizeQuantity = parsedServing.quantity;
      result.servingSizeUnit = parsedServing.unit;
      break;
    }
  }

  // Extract servings per container
  const servingsPerContainerPatterns = [
    /servings per container[:\s]+(\d+\.?\d*)/i,
    /about\s+(\d+\.?\d*)\s+servings/i,
  ];

  for (const pattern of servingsPerContainerPatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      result.servingsPerContainer = parseFloat(match[1]);
      break;
    }
  }

  // Extract calories
  // Patterns: "Calories 120", "120 Calories", "Calories: 120", etc.
  const caloriesPatterns = [
    /calories[:\s]+(\d+)/i,
    /(\d+)\s*calories/i,
    /cal[:\s]+(\d+)/i,
  ];

  for (const pattern of caloriesPatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      result.calories = parseInt(match[1]);
      break;
    }
  }

  // Extract protein
  // Patterns: "Protein 10g", "Protein: 10 g", "10g protein", etc.
  const proteinPatterns = [
    /protein[:\s]+(\d+\.?\d*)\s*g/i,
    /(\d+\.?\d*)\s*g?\s*protein/i,
  ];

  for (const pattern of proteinPatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      result.protein = parseFloat(match[1]);
      break;
    }
  }

  // Extract total carbohydrates
  // Patterns: "Total Carbohydrate 30g", "Carbs: 30g", etc.
  const carbsPatterns = [
    /total carbohydrate[:\s]+(\d+\.?\d*)\s*g/i,
    /carbohydrate[:\s]+(\d+\.?\d*)\s*g/i,
    /carbs?[:\s]+(\d+\.?\d*)\s*g/i,
    /(\d+\.?\d*)\s*g?\s*carb/i,
  ];

  for (const pattern of carbsPatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      result.carbs = parseFloat(match[1]);
      break;
    }
  }

  // Extract total fat
  // Patterns: "Total Fat 8g", "Fat: 8g", etc.
  const fatPatterns = [
    /total fat[:\s]+(\d+\.?\d*)\s*g/i,
    /fat[:\s]+(\d+\.?\d*)\s*g/i,
    /(\d+\.?\d*)\s*g?\s*fat/i,
  ];

  for (const pattern of fatPatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      result.fat = parseFloat(match[1]);
      break;
    }
  }

  return result;
}

/**
 * Check if parsed data contains any valid nutrition information
 * @param {object} parsedData - Result from parseNutritionLabel
 * @returns {boolean} True if at least one macro was found
 */
export function hasValidNutritionData(parsedData) {
  return (
    parsedData.calories !== null ||
    parsedData.protein !== null ||
    parsedData.carbs !== null ||
    parsedData.fat !== null
  );
}

/**
 * Format nutrition data for display
 * @param {object} parsedData - Result from parseNutritionLabel
 * @returns {string} Formatted summary
 */
export function formatNutritionSummary(parsedData) {
  const parts = [];
  
  if (parsedData.servingSizeQuantity !== null && parsedData.servingSizeUnit) {
    parts.push(`Serving Size: ${parsedData.servingSizeQuantity} ${parsedData.servingSizeUnit}`);
  } else if (parsedData.servingSize) {
    parts.push(`Serving Size: ${parsedData.servingSize}`);
  }
  if (parsedData.servingsPerContainer) {
    parts.push(`Servings per container: ${parsedData.servingsPerContainer}`);
  }
  if (parsedData.calories !== null) {
    parts.push(`${parsedData.calories} cal per serving`);
  }
  if (parsedData.protein !== null) {
    parts.push(`${parsedData.protein}g protein`);
  }
  if (parsedData.carbs !== null) {
    parts.push(`${parsedData.carbs}g carbs`);
  }
  if (parsedData.fat !== null) {
    parts.push(`${parsedData.fat}g fat`);
  }

  return parts.join('\n');
}
