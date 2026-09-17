import { ObjectId } from 'mongodb';
import { getMealsCollection } from '../lib/mongodb.js';
import { authenticateRequest, sendError, sendSuccess } from '../lib/auth.js';
import { validateMealPayload, buildMealFields } from '../lib/validation.js';

export default async function handler(req, res) {
  // The front end and the API are served from one origin, so no CORS
  // headers are needed. OPTIONS is answered for well-behaved clients.
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, PUT, DELETE');
    return res.status(204).end();
  }

  try {
    const userId = authenticateRequest(req);
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    // Normalize route param shape (can be string or string[] depending on runtime)
    const rawId = req.query?.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id || !ObjectId.isValid(id)) {
      return sendError(res, 400, 'Invalid meal ID');
    }

    const mealObjectId = new ObjectId(id);
    const meals = await getMealsCollection();

    if (req.method === 'GET') {
      const meal = await meals.findOne({ _id: mealObjectId, userId });
      if (!meal) {
        return sendError(res, 404, 'Meal not found');
      }

      const { _id, ...mealFields } = meal;

      return sendSuccess(res, {
        meal: {
          ...mealFields,
          id: _id.toString(),
        },
      });
    }

    if (req.method === 'PUT') {
      const validationError = validateMealPayload(req.body);
      if (validationError) {
        return sendError(res, 400, validationError);
      }

      const updatedFields = buildMealFields(req.body);

      // The filter carries userId, so one round trip both checks ownership
      // and applies the update.
      // Driver v6 returns the document itself, or null when nothing matched.
      // (v5 and earlier wrapped it in a `value` property. The pinned major
      // version here is 6, so the document is used directly.)
      const updated = await meals.findOneAndUpdate(
        { _id: mealObjectId, userId },
        { $set: updatedFields },
        { returnDocument: 'after' }
      );

      if (!updated) {
        return sendError(res, 404, 'Meal not found');
      }

      const { _id, ...mealFields } = updated;

      return sendSuccess(res, {
        meal: {
          ...mealFields,
          id: _id.toString(),
        },
      });
    }

    if (req.method === 'DELETE') {
      const result = await meals.deleteOne({ _id: mealObjectId, userId });
      if (result.deletedCount === 0) {
        return sendError(res, 404, 'Meal not found');
      }

      return sendSuccess(res, { message: 'Meal deleted successfully' });
    }

    res.setHeader('Allow', 'GET, PUT, DELETE');
    return sendError(res, 405, 'Method not allowed');
  } catch (error) {
    console.error('Meal API error:', error);
    return sendError(res, 500, 'Internal server error');
  }
}
