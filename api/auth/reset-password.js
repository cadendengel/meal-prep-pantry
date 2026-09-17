import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { getUsersCollection, getPasswordResetsCollection } from '../../lib/mongodb.js';
import { sendError, sendSuccess, generateToken } from '../../lib/auth.js';

const MAX_PASSWORD_BYTES = 72;
const MIN_PASSWORD_LENGTH = 6;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const { token, password } = req.body || {};

    if (!token || typeof token !== 'string' || !password || typeof password !== 'string') {
      return sendError(res, 400, 'Token and password are required');
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return sendError(res, 400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
      return sendError(res, 400, 'Password must be 72 bytes or fewer');
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const resets = await getPasswordResetsCollection();
    const record = await resets.findOne({ tokenHash });

    // The TTL index removes expired records, but it runs on a delay, so
    // the expiry is checked here too.
    if (!record || record.expiresAt <= new Date()) {
      if (record) {
        await resets.deleteOne({ _id: record._id });
      }
      return sendError(res, 400, 'This reset link is invalid or has expired.');
    }

    if (!ObjectId.isValid(record.userId)) {
      await resets.deleteOne({ _id: record._id });
      return sendError(res, 400, 'This reset link is invalid or has expired.');
    }

    const users = await getUsersCollection();
    const hashedPassword = await bcrypt.hash(password, 10);

    const updated = await users.findOneAndUpdate(
      { _id: new ObjectId(record.userId) },
      { $set: { password: hashedPassword, passwordChangedAt: new Date().toISOString() } },
      { returnDocument: 'after', projection: { password: 0 } }
    );

    // The token is single use.
    await resets.deleteOne({ _id: record._id });

    if (!updated) {
      return sendError(res, 400, 'This reset link is invalid or has expired.');
    }

    // Sign the user straight in, so they do not have to type the new
    // password again immediately.
    return sendSuccess(res, {
      token: generateToken(updated._id.toString()),
      user: {
        id: updated._id.toString(),
        name: updated.name,
        email: updated.email,
      },
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return sendError(res, 500, 'Internal server error');
  }
}
