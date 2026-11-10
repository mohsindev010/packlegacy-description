// Server-side validation for the quote form.
// Mirrors the browser rules in public/js/main.js — the browser checks are for
// user experience; these are the ones that actually protect the server.

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[\d\s()-]{7,20}$/;
const DESIGN_METHODS = ['design-tool', 'pre-made', 'upload'];
const UNITS = ['in', 'cm', 'mm'];

// Trim and cap a string field; missing values become ''
const clean = (value, max) => String(value ?? '').trim().slice(0, max);

/**
 * @returns {{ errors: Record<string,string>, quote: object }}
 *          `quote` only contains known, cleaned fields.
 */
export function validateQuote(fields, files) {
  const quote = {
    designMethod: clean(fields.designMethod, 20),
    fullName: clean(fields.fullName, 100),
    email: clean(fields.email, 150).toLowerCase(),
    phone: clean(fields.phone, 20),
    material: clean(fields.material, 100),
    quantity: clean(fields.quantity, 50),
    source: clean(fields.source, 100),
    finishes: clean(fields.finishes, 100),
    length: Number(fields.length),
    width: Number(fields.width),
    height: Number(fields.height),
    unit: clean(fields.unit, 5),
    details: clean(fields.details, 1000),
  };

  const errors = {};

  if (!DESIGN_METHODS.includes(quote.designMethod)) errors.designMethod = 'Please choose a design option.';
  if (quote.fullName.length < 2) errors.fullName = 'Please enter your full name.';
  if (!EMAIL_PATTERN.test(quote.email)) errors.email = 'Please enter a valid email address.';
  if (!PHONE_PATTERN.test(quote.phone)) errors.phone = 'Please enter a valid phone number.';
  if (!quote.quantity) errors.quantity = 'Please select a quantity.';
  if (!UNITS.includes(quote.unit)) errors.unit = 'Please choose a unit.';

  for (const dim of ['length', 'width', 'height']) {
    if (!Number.isFinite(quote[dim]) || quote[dim] <= 0 || quote[dim] > 1000) errors[dim] = 'Required';
  }

  // Artwork: required only for "Upload PDF File"
  const file = files.artwork;
  if (quote.designMethod === 'upload') {
    if (!file) errors.artwork = 'Please choose a PDF file.';
    else if (file.data.length > MAX_FILE_SIZE) errors.artwork = 'File must be 10 MB or smaller.';
    // Check the file's real content, not just its name or the browser's claimed type
    else if (file.data.subarray(0, 5).toString('latin1') !== '%PDF-') errors.artwork = 'Only PDF files are allowed.';
  }

  return { errors, quote };
}
