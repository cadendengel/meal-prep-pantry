import bcrypt from 'bcryptjs';
import { getUsersCollection } from '../../lib/mongodb.js';
import { generateToken, sendError, sendSuccess } from '../../lib/auth.js';

// bcrypt silently ignores bytes past 72. Reject longer passwords instead of
// accepting one that is not stored in full.
const MAX_PASSWORD_BYTES = 72;
const MIN_PASSWORD_LENGTH = 6;

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

  try {
    const { name, email, password } = req.body || {};

    // Validate input
    if (!name || !email || !password) {
      return sendError(res, 400, 'Name, email, and password are required');
    }

    if (typeof email !== 'string' || typeof password !== 'string' || typeof name !== 'string') {
      return sendError(res, 400, 'Name, email, and password must be text');
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return sendError(res, 400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
      return sendError(res, 400, 'Password must be 72 bytes or fewer');
    }

    // Normalize once, then use the same value for the duplicate check and
    // the insert. Using different values lets " a@b.com" create a second
    // account for an address that already exists.
    const normalizedEmail = email.trim().toLowerCase();

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return sendError(res, 400, 'Invalid email format');
    }

    const users = await getUsersCollection();

    // Check if user already exists
    const existingUser = await users.findOne({ email: normalizedEmail });
    if (existingUser) {
      return sendError(res, 409, 'Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    };

    let result;
    try {
      result = await users.insertOne(newUser);
    } catch (error) {
      // The unique index on email is the real guard. Two concurrent
      // registrations both pass the findOne check above, and one of them
      // loses here.
      if (error?.code === 11000) {
        return sendError(res, 409, 'Email already exists');
      }
      throw error;
    }

    // Generate token
    const token = generateToken(result.insertedId.toString());

    // Return user data (without password)
    return sendSuccess(res, {
      token,
      user: {
        id: result.insertedId.toString(),
        name: newUser.name,
        email: newUser.email,
      },
    }, 201);
  } catch (error) {
    console.error('Registration error:', error);
    return sendError(res, 500, 'Internal server error');
  }
}
