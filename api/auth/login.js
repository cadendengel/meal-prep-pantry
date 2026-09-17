import bcrypt from 'bcryptjs';
import { getUsersCollection } from '../../lib/mongodb.js';
import { generateToken, sendError, sendSuccess } from '../../lib/auth.js';
import { getClientKey, consumeAttempt, resetAttempts } from '../../lib/rateLimit.js';

export default async function handler(req, res) {
  // The front end and the API are served from one origin, so no CORS
  // headers are needed. OPTIONS is answered for well-behaved clients.
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendError(res, 405, 'Method not allowed');
  }

  const clientKey = getClientKey(req);

  try {
    const { email, password } = req.body || {};

    // Validate input
    if (!email || !password) {
      return sendError(res, 400, 'Email and password are required');
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return sendError(res, 400, 'Email and password must be text');
    }

    const { limited, retryAfterSeconds } = consumeAttempt(clientKey);
    if (limited) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return sendError(res, 429, 'Too many login attempts. Please try again later.');
    }

    // Normalize the same way registration does, so a stored address is
    // always reachable.
    const normalizedEmail = email.trim().toLowerCase();

    const users = await getUsersCollection();

    // Find user
    const user = await users.findOne({ email: normalizedEmail });
    if (!user) {
      return sendError(res, 401, 'Invalid email or password');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return sendError(res, 401, 'Invalid email or password');
    }

    resetAttempts(clientKey);

    // Generate token
    const token = generateToken(user._id.toString());

    // Return user data (without password)
    return sendSuccess(res, {
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return sendError(res, 500, 'Internal server error');
  }
}
