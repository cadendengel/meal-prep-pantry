import { getMealsCollection } from '../../lib/mongodb.js';
import { authenticateRequest, sendError, sendSuccess } from '../../lib/auth.js';
import { validateMealPayload, buildMealFields } from '../../lib/validation.js';

export default async function handler(req, res) {
  // The front end and the API are served from one origin, so no CORS
  // headers are needed. OPTIONS is answered for well-behaved clients.
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(204).end();
  }

  // Authenticate user
  const userId = authenticateRequest(req);
  if (!userId) {
    return sendError(res, 401, 'Unauthorized');
  }

  try {
    // Opening the collection can fail, so it belongs inside the try block.
    // Outside it, a connection error escapes the handler unlogged.
    const meals = await getMealsCollection();

    if (req.method === 'GET') {
      // Get all meals for user
      const userMeals = await meals.find({ userId }).sort({ updatedAt: -1 }).toArray();

      // Convert _id to id for frontend compatibility
      const formattedMeals = userMeals.map(({ _id, ...meal }) => ({
        ...meal,
        id: _id.toString(),
      }));

      return sendSuccess(res, { meals: formattedMeals });
    }

    if (req.method === 'POST') {
      // Create new meal
      const validationError = validateMealPayload(req.body);
      if (validationError) {
        return sendError(res, 400, validationError);
      }

      const newMeal = {
        userId,
        ...buildMealFields(req.body),
        createdAt: new Date().toISOString(),
      };

      const result = await meals.insertOne(newMeal);

      // insertOne adds _id to newMeal, so it is stripped before responding.
      const { _id, ...mealWithoutInternalId } = newMeal;

      // Return created meal
      return sendSuccess(res, {
        meal: {
          ...mealWithoutInternalId,
          id: result.insertedId.toString(),
        },
      }, 201);
    }

    res.setHeader('Allow', 'GET, POST');
    return sendError(res, 405, 'Method not allowed');
  } catch (error) {
    console.error('Meals API error:', error);
    return sendError(res, 500, 'Internal server error');
  }
}
