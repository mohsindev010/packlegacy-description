// Error that carries an HTTP status code, so handlers can `throw` and the
// caller can turn it into the right response (400, 413, 415, ...)
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
