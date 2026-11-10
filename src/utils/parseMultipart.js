import { HttpError } from './httpError.js';

const CRLF = Buffer.from('\r\n');
const HEADER_END = Buffer.from('\r\n\r\n');

/**
 * Reads the whole request body into a Buffer, refusing anything over maxBytes.
 */
export function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (declared > maxBytes) {
      req.resume(); // discard the upload
      return reject(new HttpError(413, 'Upload is too large.'));
    }

    const chunks = [];
    let size = 0;
    let tooLarge = false;

    req.on('data', (chunk) => {
      if (tooLarge) return; // keep draining, but stop storing
      size += chunk.length;
      if (size > maxBytes) {
        tooLarge = true;
        chunks.length = 0;
        return reject(new HttpError(413, 'Upload is too large.'));
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (!tooLarge) resolve(Buffer.concat(chunks));
    });

    req.on('error', reject);
  });
}

/**
 * Parses a multipart/form-data request.
 *
 * Body layout (each line ends with \r\n):
 *
 *   --BOUNDARY
 *   Content-Disposition: form-data; name="email"
 *
 *   john@example.com
 *   --BOUNDARY
 *   Content-Disposition: form-data; name="artwork"; filename="box.pdf"
 *   Content-Type: application/pdf
 *
 *   <binary bytes>
 *   --BOUNDARY--
 *
 * @returns {Promise<{ fields: Record<string,string>, files: Record<string,{filename,contentType,data}> }>}
 */
export async function parseMultipart(req, { maxBytes, maxParts = 30 }) {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    throw new HttpError(415, 'Expected multipart/form-data.');
  }

  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match) throw new HttpError(400, 'Missing multipart boundary.');
  const delimiter = Buffer.from(`--${match[1] || match[2]}`);

  const body = await readBody(req, maxBytes);

  const fields = {};
  const files = {};
  let partCount = 0;

  let pos = body.indexOf(delimiter);
  if (pos === -1) throw new HttpError(400, 'Malformed multipart body.');

  while (true) {
    pos += delimiter.length;

    // "--BOUNDARY--" marks the end of the body
    if (body[pos] === 0x2d && body[pos + 1] === 0x2d) break;

    pos += CRLF.length; // skip the line break after the delimiter
    const next = body.indexOf(delimiter, pos);
    if (next === -1) throw new HttpError(400, 'Malformed multipart body.');

    if (++partCount > maxParts) throw new HttpError(400, 'Too many form fields.');

    // Part = headers + blank line + content + CRLF (before the next delimiter)
    const part = body.subarray(pos, next - CRLF.length);
    const headerEnd = part.indexOf(HEADER_END);
    if (headerEnd === -1) throw new HttpError(400, 'Malformed multipart part.');

    const headers = part.subarray(0, headerEnd).toString('utf8');
    const content = part.subarray(headerEnd + HEADER_END.length);

    // \b stops "name=" from matching inside "filename="
    const name = headers.match(/\bname="([^"]*)"/i)?.[1];
    const filename = headers.match(/filename="([^"]*)"/i)?.[1];
    const partType = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim();

    if (name) {
      if (filename !== undefined) {
        // Browsers send an empty file part when nothing was chosen: skip it
        if (filename && content.length) {
          files[name] = { filename, contentType: partType || 'application/octet-stream', data: content };
        }
      } else {
        fields[name] = content.toString('utf8');
      }
    }

    pos = next;
  }

  return { fields, files };
}
