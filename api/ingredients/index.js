import { getIngredientsCollection } from '../../lib/mongodb.js';
import { authenticateRequest, sendError, sendSuccess } from '../../lib/auth.js';
import { validateIngredientPayload, buildIngredientFields } from '../../lib/validation.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(204).end();
  }

  const userId = authenticateRequest(req);
  if (!userId) {
    return sendError(res, 401, 'Unauthorized');
  }

  try {
    const ingredients = await getIngredientsCollection();

    if (req.method === 'GET') {
      // An optional ?barcode= lookup lets the scanner check the pantry
      // before it calls an outside food database.
      const barcode = typeof req.query?.barcode === 'string' ? req.query.barcode.trim() : '';
      const filter = barcode ? { userId, barcode } : { userId };

      const rows = await ingredients.find(filter).sort({ name: 1 }).toArray();

      return sendSuccess(res, {
        ingredients: rows.map(({ _id, ...rest }) => ({ ...rest, id: _id.toString() })),
      });
    }

    if (req.method === 'POST') {
      const validationError = validateIngredientPayload(req.body);
      if (validationError) {
        return sendError(res, 400, validationError);
      }

      const newIngredient = {
        userId,
        ...buildIngredientFields(req.body),
        createdAt: new Date().toISOString(),
      };

      const result = await ingredients.insertOne(newIngredient);
      const { _id, ...rest } = newIngredient;

      return sendSuccess(res, {
        ingredient: { ...rest, id: result.insertedId.toString() },
      }, 201);
    }

    res.setHeader('Allow', 'GET, POST');
    return sendError(res, 405, 'Method not allowed');
  } catch (error) {
    console.error('Ingredients API error:', error);
    return sendError(res, 500, 'Internal server error');
  }
}
