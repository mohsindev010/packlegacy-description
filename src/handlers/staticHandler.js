import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMimeType } from '../utils/mime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '../../public');

export function serveStatic(pathname, res, req) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return notFound(res);
  }

  // Resolve inside /public and block path traversal (e.g. /../server.js)
  const filePath = path.resolve(PUBLIC_DIR, '.' + decoded);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    return notFound(res);
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) return notFound(res);

    // ETag changes whenever the file changes. "no-cache" makes the browser ask
    // every time, so edits show up on a normal refresh; unchanged files get a
    // tiny 304 reply instead of being downloaded again.
    const etag = `"${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`;
    const headers = { ETag: etag, 'Cache-Control': 'no-cache' };

    if (req?.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      return res.end();
    }

    res.writeHead(200, {
      ...headers,
      'Content-Type': getMimeType(path.extname(filePath)),
      'Content-Length': stats.size,
    });

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 - File Not Found');
}
