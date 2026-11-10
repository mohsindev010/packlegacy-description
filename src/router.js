import { serveStatic } from './handlers/staticHandler.js';
import { quoteHandler } from './handlers/quoteHandler.js';

// Page routes: "METHOD /path" -> handler(req, res)
const routes = {
  'GET /': (req, res) => serveStatic('/index.html', res, req),
  'POST /api/quote': quoteHandler,
};

export async function router(req, res) {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  // 1. Static files (/css, /js, /images, ...)
  if (req.method === 'GET' && /\.[a-z0-9]+$/i.test(pathname)) {
    return serveStatic(pathname, res, req);
  }

  // 2. Page / API routes
  const handler = routes[`${req.method} ${pathname}`];
  if (handler) return handler(req, res);

  // 3. Not found
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 - Page Not Found');
}
