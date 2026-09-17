import crypto from 'node:crypto';
import { getUsersCollection, getPasswordResetsCollection } from '../../lib/mongodb.js';
import { sendError, sendSuccess } from '../../lib/auth.js';
import { sendMail } from '../../lib/mailer.js';
import { getClientKey, consumeAttempt } from '../../lib/rateLimit.js';

const TOKEN_TTL_MINUTES = 30;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendError(res, 405, 'Method not allowed');
  }

  // The response is identical whether or not the address exists, so that
  // this endpoint cannot be used to discover which emails are registered.
  const genericResponse = {
    message: 'If that email address has an account, a reset link is on its way.',
  };

  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return sendError(res, 400, 'Email is required');
    }

    const { limited } = consumeAttempt(`forgot:${getClientKey(req)}`);
    if (limited) {
      // Still generic, so a rate limit does not leak anything either.
      return sendSuccess(res, genericResponse);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const users = await getUsersCollection();
    const user = await users.findOne({ email: normalizedEmail });

    if (!user) {
      return sendSuccess(res, genericResponse);
    }

    // Only the hash is stored. A database reader cannot mint a reset link.
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resets = await getPasswordResetsCollection();
    // One live token per user. A new request invalidates the previous one.
    await resets.deleteMany({ userId: user._id.toString() });
    await resets.insertOne({
      userId: user._id.toString(),
      tokenHash,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000),
    });

    const origin = process.env.APP_ORIGIN || `https://${req.headers.host}`;
    const link = `${origin}/reset-password?token=${token}`;

    await sendMail({
      to: user.email,
      subject: 'Reset your Meal Prep Pantry password',
      text:
        `Hello ${user.name},\n\n` +
        `Open this link to choose a new password:\n${link}\n\n` +
        `The link stops working in ${TOKEN_TTL_MINUTES} minutes.\n` +
        `If you did not ask for this, ignore this message. Your password stays the same.\n`,
    });

    return sendSuccess(res, genericResponse);
  } catch (error) {
    console.error('Forgot password error:', error);
    // Stay generic even on failure.
    return sendSuccess(res, genericResponse);
  }
}
