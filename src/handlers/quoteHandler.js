import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseMultipart } from '../utils/parseMultipart.js';
import { validateQuote, MAX_FILE_SIZE } from '../utils/validateQuote.js';
import { HttpError } from '../utils/httpError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = path.resolve(__dirname, '../../storage');
const UPLOADS_DIR = path.join(STORAGE_DIR, 'uploads');
const QUOTES_FILE = path.join(STORAGE_DIR, 'quotes.json');

// File + text fields + multipart overhead
const MAX_BODY = MAX_FILE_SIZE + 100 * 1024;

export async function quoteHandler(req, res) {
  try {
    const { fields, files } = await parseMultipart(req, { maxBytes: MAX_BODY });
    const { errors, quote } = validateQuote(fields, files);

    if (Object.keys(errors).length) {
      return sendJson(res, 400, { message: 'Please fix the highlighted fields.', errors });
    }

    const id = crypto.randomUUID();
    let artwork = null;

    if (quote.designMethod === 'upload') {
      // Never trust the client's filename for the path: we name the file ourselves
      const storedName = `${id}.pdf`;
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      await fs.writeFile(path.join(UPLOADS_DIR, storedName), files.artwork.data);
      artwork = {
        storedName,
        originalName: path.basename(files.artwork.filename).slice(0, 150),
        size: files.artwork.data.length,
      };
    }

    await saveQuote({ id, createdAt: new Date().toISOString(), ...quote, artwork });

    return sendJson(res, 201, { message: "Thanks! We'll send your quote within 24 hours." });
  } catch (err) {
    if (err instanceof HttpError) {
      return sendJson(res, err.status, { message: err.message });
    }
    console.error('Quote submission failed:', err);
    return sendJson(res, 500, { message: 'Something went wrong. Please try again.' });
  }
}

// ---------------------------------------------------------------------------
// Storage: quotes.json is an array. Writes are queued so two requests at the
// same time can't read the old file and overwrite each other's quote.
// ---------------------------------------------------------------------------
let writeQueue = Promise.resolve();

function saveQuote(record) {
  const task = writeQueue.then(async () => {
    let quotes = [];
    try {
      quotes = JSON.parse(await fs.readFile(QUOTES_FILE, 'utf8'));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err; // file missing on first run is fine
    }
    quotes.push(record);

    // Write to a temp file, then rename: a crash mid-write can't corrupt quotes.json
    const tmp = `${QUOTES_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(quotes, null, 2));
    await fs.rename(tmp, QUOTES_FILE);
  });

  writeQueue = task.catch(() => {}); // keep the queue alive after a failure
  return task;
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}
