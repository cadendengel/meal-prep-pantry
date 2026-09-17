import { ObjectId } from 'mongodb';
import { getIngredientsCollection } from '../lib/mongodb.js';
import { authenticateRequest, sendError, sendSuccess } from '../lib/auth.js';
import { validateIngredientPayload, buildIngredientFields } from '../lib/validation.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, PUT, DELETE');
    return res.status(204).end();
  }

  try {
    const userId = authenticateRequest(req);
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const rawId = req.query?.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id || !ObjectId.isValid(id)) {
      return sendError(res, 400, 'Invalid ingredient ID');
    }

    const objectId = new ObjectId(id);
    const ingredients = await getIngredientsCollection();

    if (req.method === 'GET') {
      const found = await ingredients.findOne({ _id: objectId, userId });
      if (!found) {
        return sendError(res, 404, 'Ingredient not found');
      }
      const { _id, ...rest } = found;
      return sendSuccess(res, { ingredient: { ...rest, id: _id.toString() } });
    }

    if (req.method === 'PUT') {
      const validationError = validateIngredientPayload(req.body);
      if (validationError) {
        return sendError(res, 400, validationError);
      }

      const updated = await ingredients.findOneAndUpdate(
        { _id: objectId, userId },
        { $set: buildIngredientFields(req.body) },
        { returnDocument: 'after' }
      );

      if (!updated) {
        return sendError(res, 404, 'Ingredient not found');
      }

      const { _id, ...rest } = updated;
      return sendSuccess(res, { ingredient: { ...rest, id: _id.toString() } });
    }

    if (req.method === 'DELETE') {
      const result = await ingredients.deleteOne({ _id: objectId, userId });
      if (result.deletedCount === 0) {
        return sendError(res, 404, 'Ingredient not found');
      }
      return sendSuccess(res, { message: 'Ingredient deleted successfully' });
    }

    res.setHeader('Allow', 'GET, PUT, DELETE');
    return sendError(res, 405, 'Method not allowed');
  } catch (error) {
    console.error('Ingredient API error:', error);
    return sendError(res, 500, 'Internal server error');
  }
}
