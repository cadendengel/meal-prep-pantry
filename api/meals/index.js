import { ObjectId } from 'mongodb';
import { getMealsCollection } from '../../lib/mongodb.js';
import { authenticateRequest, sendError, sendSuccess } from '../../lib/auth.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Authenticate user
  const userId = authenticateRequest(req);
  if (!userId) {
    return sendError(res, 401, 'Unauthorized');
  }

  const meals = await getMealsCollection();

  try {
    if (req.method === 'GET') {
      // Get all meals for user
      const userMeals = await meals.find({ userId }).sort({ updatedAt: -1 }).toArray();
      
      // Convert _id to id for frontend compatibility
      const formattedMeals = userMeals.map(meal => ({
        ...meal,
        id: meal._id.toString(),
        _id: undefined,
      }));

      return sendSuccess(res, { meals: formattedMeals });
    }

    if (req.method === 'POST') {
      // Create new meal
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

      const newMeal = {
        userId,
        name: mealData.name.trim(),
        notes: mealData.notes || '',
        servingSize: mealData.servingSize || null,
        servingUnit: mealData.servingUnit || 'g',
        servingsPerMeal: mealData.servingsPerMeal,
        ingredients: mealData.ingredients || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await meals.insertOne(newMeal);

      // Return created meal
      return sendSuccess(res, {
        meal: {
          ...newMeal,
          id: result.insertedId.toString(),
        },
      }, 201);
    }

    return sendError(res, 405, 'Method not allowed');
  } catch (error) {
    console.error('Meals API error:', error);
    return sendError(res, 500, 'Internal server error');
  }
}
