import { ObjectId } from 'mongodb';
import { getMealsCollection } from '../../lib/mongodb.js';
import { authenticateRequest, sendError, sendSuccess } from '../../lib/auth.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Authenticate user
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
      // Get single meal
      const meal = await meals.findOne({ _id: mealObjectId, userId });

      if (!meal) {
        return sendError(res, 404, 'Meal not found');
      }

      return sendSuccess(res, {
        meal: {
          ...meal,
          id: meal._id.toString(),
          _id: undefined,
        },
      });
    }

    if (req.method === 'PUT') {
      // Update meal
      const mealData = req.body;

      // Validate required fields
      if (!mealData.name || !mealData.name.trim()) {
        return sendError(res, 400, 'Meal name is required');
      }

      if (!mealData.servingsPerMeal || mealData.servingsPerMeal <= 0) {
        return sendError(res, 400, 'Servings per meal must be greater than 0');
      }

      // Validate ingredient URLs
      if (mealData.ingredients) {
        for (const ingredient of mealData.ingredients) {
          if (ingredient.productUrl && ingredient.productUrl.trim()) {
            try {
              new URL(ingredient.productUrl);
            } catch {
              return sendError(res, 400, `Invalid URL for ingredient: ${ingredient.name}`);
            }
          }
        }
      }

      // Check if meal exists and belongs to user
      const existingMeal = await meals.findOne({ _id: mealObjectId, userId });
      if (!existingMeal) {
        return sendError(res, 404, 'Meal not found');
      }

      const updatedMeal = {
        name: mealData.name.trim(),
        notes: mealData.notes || '',
        servingSize: mealData.servingSize || null,
        servingUnit: mealData.servingUnit || 'g',
        servingsPerMeal: mealData.servingsPerMeal,
        ingredients: mealData.ingredients || [],
        updatedAt: new Date().toISOString(),
      };

      await meals.updateOne(
        { _id: mealObjectId, userId },
        { $set: updatedMeal }
      );

      return sendSuccess(res, {
        meal: {
          ...existingMeal,
          ...updatedMeal,
          id: id,
          _id: undefined,
        },
      });
    }

    if (req.method === 'DELETE') {
      // Delete meal
      const result = await meals.deleteOne({ _id: mealObjectId, userId });

      if (result.deletedCount === 0) {
        return sendError(res, 404, 'Meal not found');
      }

      return sendSuccess(res, { message: 'Meal deleted successfully' });
    }

    return sendError(res, 405, 'Method not allowed');
  } catch (error) {
    console.error('Meal API error:', error);
    return sendError(res, 500, 'Internal server error');
  }
}
