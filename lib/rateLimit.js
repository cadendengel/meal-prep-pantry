/**
 * Best-effort login rate limiting.
 *
 * LIMITATION: the counters live in the memory of one serverless instance.
 * Vercel runs many instances, and it recycles them, so an attacker who
 * spreads attempts across instances gets more than `maxAttempts` tries.
 * This raises the cost of online password guessing. It does not stop a
 * determined distributed attack. Move the counters to Redis or to a
 * MongoDB collection with a TTL index when you need a hard limit.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const MAX_TRACKED_KEYS = 5000;

const attempts = new Map();

function pruneExpired(now) {
  for (const [key, entry] of attempts) {
    if (entry.resetAt <= now) {
      attempts.delete(key);
    }
  }
}

/**
 * Identify the caller. Vercel sets x-forwarded-for.
 *
 * @param {object} req - Request object
 * @returns {string} Client key
 */
export function getClientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0];
  }
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Record an attempt and report whether the caller is over the limit.
 *
 * @param {string} key - Client key
 * @returns {{limited: boolean, retryAfterSeconds: number}}
 */
export function consumeAttempt(key) {
  const now = Date.now();

  if (attempts.size > MAX_TRACKED_KEYS) {
    pruneExpired(now);
  }

  const entry = attempts.get(key);

  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { limited: false, retryAfterSeconds: 0 };
  }

  entry.count += 1;

  if (entry.count > MAX_ATTEMPTS) {
    return {
      limited: true,
      retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  return { limited: false, retryAfterSeconds: 0 };
}

/**
 * Clear the counter after a successful login.
 *
 * @param {string} key - Client key
 */
export function resetAttempts(key) {
  attempts.delete(key);
}
