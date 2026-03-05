import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET) {
  throw new Error('Please add your JWT_SECRET to .env.local');
}

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Generate JWT token for user
 */
export function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

/**
 * Verify JWT token
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Middleware to verify authentication
 * Returns user ID if authenticated, null otherwise
 */
export function authenticateRequest(req) {
  const authHeader = req.headers.authorization;
  const token = extractToken(authHeader);
  
  if (!token) {
    return null;
  }

  const decoded = verifyToken(token);
  return decoded ? decoded.userId : null;
}

/**
 * Send error response
 */
export function sendError(res, statusCode, message) {
  return res.status(statusCode).json({ error: message });
}

/**
 * Send success response
 */
export function sendSuccess(res, data, statusCode = 200) {
  return res.status(statusCode).json(data);
}
