import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Turn a vercel.json rewrite source into a matcher.
 *
 * Only the ":param" form is needed, which is all this project uses.
 *
 * @param {string} source - Rewrite source such as "/api/meals/:id"
 * @returns {{regex: RegExp, keys: string[]}} Compiled matcher
 */
function compileSource(source) {
  const keys = [];
  const pattern = source.replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
    keys.push(key);
    return '([^/]+)';
  });
  return { regex: new RegExp(`^${pattern}$`), keys };
}

/**
 * Read the rewrites that apply to the API from vercel.json.
 *
 * Reading the real file keeps the emulator honest. A rewrite added for
 * production is then exercised by the tests too.
 *
 * @returns {Array<{matcher: object, destination: string}>} API rewrites
 */
function loadApiRewrites() {
  const file = path.join(ROOT, 'vercel.json');
  if (!fs.existsSync(file)) return [];

  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  return (config.rewrites || [])
    .filter((r) => r.source.startsWith('/api/') && r.destination.startsWith('/api/'))
    .map((r) => ({ matcher: compileSource(r.source), destination: r.destination }));
}

/**
 * Resolve a request path to a handler file, the way Vercel does.
 *
 * @param {string} pathname - Request path beginning with /api/
 * @returns {string | null} Absolute handler path, or null when none exists
 */
function resolveHandler(pathname) {
  const rel = pathname.replace(/^\/api\//, '');
  if (!rel || rel.includes('..')) return null;

  for (const candidate of [
    path.join(ROOT, 'api', `${rel}.js`),
    path.join(ROOT, 'api', rel, 'index.js'),
  ]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

async function readJsonBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return undefined;

  try {
    return JSON.parse(raw);
  } catch {
    // Vercel leaves an unparseable body as a string.
    return raw;
  }
}

/**
 * Vite plugin that serves the api/ directory the way Vercel functions do.
 *
 * The end-to-end tests need the real handlers, not a stub, so that a bug in
 * request shaping or in a rewrite is caught here rather than in production.
 * It applies vercel.json's API rewrites, shapes req.query and req.body, and
 * gives the handler the small res surface it expects.
 *
 * @returns {import('vite').Plugin} The plugin
 */
export function vercelApiPlugin() {
  return {
    name: 'vercel-api-emulator',
    configureServer(server) {
      const rewrites = loadApiRewrites();

      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next();

        const url = new URL(req.url, 'http://localhost');
        let pathname = url.pathname;
        const query = Object.fromEntries(url.searchParams.entries());

        for (const { matcher, destination } of rewrites) {
          const match = pathname.match(matcher.regex);
          if (!match) continue;

          const params = Object.fromEntries(
            matcher.keys.map((key, i) => [key, decodeURIComponent(match[i + 1])])
          );
          const target = new URL(
            destination.replace(/:([A-Za-z0-9_]+)/g, (_, k) => encodeURIComponent(params[k] ?? '')),
            'http://localhost'
          );
          pathname = target.pathname;
          for (const [k, v] of target.searchParams.entries()) query[k] = v;
          break;
        }

        const handlerPath = resolveHandler(pathname);
        if (!handlerPath) {
          res.statusCode = 404;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: `No API handler for ${pathname}` }));
          return;
        }

        const vercelReq = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          query,
          body: await readJsonBody(req),
          socket: req.socket,
        };

        const vercelRes = {
          statusCode: 200,
          status(code) {
            this.statusCode = code;
            return this;
          },
          setHeader(key, value) {
            res.setHeader(key, value);
            return this;
          },
          json(payload) {
            res.statusCode = this.statusCode;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify(payload));
            return this;
          },
          end() {
            res.statusCode = this.statusCode;
            res.end();
            return this;
          },
        };

        try {
          const module = await server.ssrLoadModule(handlerPath);
          await module.default(vercelReq, vercelRes);
        } catch (error) {
          console.error(`[api] ${req.method} ${pathname} threw:`, error);
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ error: `Handler threw: ${error.message}` }));
          }
        }
      });
    },
  };
}

export default vercelApiPlugin;
