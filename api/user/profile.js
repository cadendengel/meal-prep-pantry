import { ObjectId } from 'mongodb';
import { getUsersCollection } from '../../lib/mongodb.js';
import { authenticateRequest, sendError, sendSuccess } from '../../lib/auth.js';
import { validateTargets, buildTargets } from '../../lib/validation.js';

const EMPTY_TARGETS = { calories: null, protein: null, carbs: null, fat: null };

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, PUT');
    return res.status(204).end();
  }

  try {
    const userId = authenticateRequest(req);
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    if (!ObjectId.isValid(userId)) {
      return sendError(res, 401, 'Unauthorized');
    }

    const users = await getUsersCollection();
    const objectId = new ObjectId(userId);

    if (req.method === 'GET') {
      const user = await users.findOne(
        { _id: objectId },
        { projection: { password: 0 } }
      );
      if (!user) {
        return sendError(res, 404, 'User not found');
      }

      return sendSuccess(res, {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          targets: user.targets || EMPTY_TARGETS,
        },
      });
    }

    if (req.method === 'PUT') {
      const { name, targets } = req.body || {};
      const update = {};

      if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
          return sendError(res, 400, 'Name cannot be empty');
        }
        update.name = name.trim();
      }

      if (targets !== undefined) {
        const targetError = validateTargets(targets);
        if (targetError) {
          return sendError(res, 400, targetError);
        }
        update.targets = buildTargets(targets);
      }

      if (Object.keys(update).length === 0) {
        return sendError(res, 400, 'Nothing to update');
      }

      const updated = await users.findOneAndUpdate(
        { _id: objectId },
        { $set: update },
        { returnDocument: 'after', projection: { password: 0 } }
      );

      if (!updated) {
        return sendError(res, 404, 'User not found');
      }

      return sendSuccess(res, {
        user: {
          id: updated._id.toString(),
          name: updated.name,
          email: updated.email,
          targets: updated.targets || EMPTY_TARGETS,
        },
      });
    }

    res.setHeader('Allow', 'GET, PUT');
    return sendError(res, 405, 'Method not allowed');
  } catch (error) {
    console.error('Profile API error:', error);
    return sendError(res, 500, 'Internal server error');
  }
}
