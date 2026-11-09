/**
 * Secure, Bounded Request Body Reader
 *
 * Provides incremental byte counting, configurable per-endpoint size limits,
 * immediate stream termination on oversized payloads (HTTP 413),
 * protection against chunked transfer encoding abuse without Content-Length,
 * preservation of exact raw bytes for cryptographic signature verification,
 * and safe error handling.
 */

export const REQUEST_BODY_LIMITS = Object.freeze({
  default: 2 * 1024 * 1024,      // 2 MB general CRM API limit
  upload: 25 * 1024 * 1024,      // 25 MB media upload limit
  webhook: 2 * 1024 * 1024,      // 2 MB Meta webhook payload limit
  login: 32 * 1024,              // 32 KB login & auth limit
  settings: 512 * 1024,          // 512 KB settings payload limit
  student: 100 * 1024            // 100 KB student exam JSON limit
});

export function getBodyLimit(pathname) {
  if (!pathname || typeof pathname !== 'string') return REQUEST_BODY_LIMITS.default;
  const p = pathname.toLowerCase();
  if (p === '/api/upload') return REQUEST_BODY_LIMITS.upload;
  if (p === '/api/auth/login' || p === '/api/auth/setup') return REQUEST_BODY_LIMITS.login;
  if (p.startsWith('/api/settings')) return REQUEST_BODY_LIMITS.settings;
  if (p.startsWith('/api/student/')) return REQUEST_BODY_LIMITS.student;
  if (
    p === '/api/webhook' ||
    p === '/webhook' ||
    p === '/api/meta/webhook' ||
    p === '/meta/webhook'
  ) {
    return REQUEST_BODY_LIMITS.webhook;
  }
  return REQUEST_BODY_LIMITS.default;
}

export class PayloadTooLargeError extends Error {
  constructor(limit = null, message = 'Request body too large.') {
    super(message);
    this.name = 'PayloadTooLargeError';
    this.status = 413;
    this.statusCode = 413;
    this.code = 'PAYLOAD_TOO_LARGE';
    this.limit = limit;
  }
}

export class MalformedJsonError extends Error {
  constructor(message = 'Invalid JSON payload.') {
    super(message);
    this.name = 'MalformedJsonError';
    this.status = 400;
    this.statusCode = 400;
    this.code = 'INVALID_JSON';
  }
}

/**
 * Incrementally reads an incoming HTTP request stream with hard byte counting.
 * Protects against unbounded chunked bodies and enforces maxBytes limit.
 * Caches result on req._boundedBody to prevent double-reading.
 *
 * @param {import('http').IncomingMessage} req
 * @param {number} maxBytes
 * @returns {Promise<{ raw: Buffer, text: string }>}
 */
export function readBoundedBody(req, maxBytes = REQUEST_BODY_LIMITS.default) {
  if (req._boundedBody) {
    return Promise.resolve(req._boundedBody);
  }

  return new Promise((resolve, reject) => {
    // Fast-path: Check declared Content-Length header if present
    const declaredLength = Number(req.headers['content-length'] || 0);
    if (declaredLength > maxBytes) {
      if (typeof req.resume === 'function') req.resume();
      return reject(new PayloadTooLargeError(maxBytes, `Request body exceeds limit of ${maxBytes} bytes.`));
    }

    let received = 0;
    const chunks = [];
    let completed = false;

    function cleanup() {
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
      req.removeListener('aborted', onAborted);
      req.removeListener('close', onClose);
    }

    function onData(chunk) {
      if (completed) return;
      received += chunk.length;
      if (received > maxBytes) {
        completed = true;
        cleanup();
        if (typeof req.destroy === 'function') req.destroy();
        return reject(new PayloadTooLargeError(maxBytes, `Request body exceeds limit of ${maxBytes} bytes.`));
      }
      chunks.push(chunk);
    }

    function onEnd() {
      if (completed) return;
      completed = true;
      cleanup();
      const raw = Buffer.concat(chunks);
      const text = raw.toString('utf8');
      const result = { raw, text };
      req._boundedBody = result;
      resolve(result);
    }

    function onError(err) {
      if (completed) return;
      completed = true;
      cleanup();
      reject(err);
    }

    function onAborted() {
      if (completed) return;
      completed = true;
      cleanup();
      const err = new Error('Request aborted by client.');
      err.code = 'ECONNABORTED';
      err.status = 400;
      err.statusCode = 400;
      reject(err);
    }

    function onClose() {
      if (completed) return;
      if (!req.complete) {
        completed = true;
        cleanup();
        const err = new Error('Connection closed before body could be read.');
        err.code = 'ECONNRESET';
        err.status = 400;
        err.statusCode = 400;
        reject(err);
      }
    }

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
    req.on('aborted', onAborted);
    req.on('close', onClose);

    if (req.isPaused && req.isPaused()) {
      req.resume();
    }
  });
}

/**
 * Incrementally reads request body and parses JSON.
 *
 * @param {import('http').IncomingMessage} req
 * @param {number} maxBytes
 * @returns {Promise<{ data: any, raw: Buffer, text: string }>}
 */
export async function readBoundedJson(req, maxBytes = REQUEST_BODY_LIMITS.default) {
  const { raw, text } = await readBoundedBody(req, maxBytes);
  const trimmed = text.trim();
  if (!trimmed) {
    return { data: {}, raw, text };
  }
  try {
    const data = JSON.parse(trimmed);
    return { data, raw, text };
  } catch (err) {
    throw new MalformedJsonError('Malformed or invalid JSON payload.');
  }
}

/**
 * Attaches an incremental byte limiter to an IncomingMessage stream.
 * Triggers HTTP 413 and destroys stream if chunked or unstated body exceeds limit.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {number} maxBytes
 */
export function applyIncrementalStreamLimiter(req, res, maxBytes) {
  let received = 0;
  let exceeded = false;

  const origEmit = req.emit;
  req.emit = function (event, ...args) {
    if (exceeded) {
      if (event === 'data' || event === 'end') {
        return false;
      }
    }
    if (event === 'data' && !exceeded) {
      const chunk = args[0];
      if (chunk && chunk.length) {
        received += chunk.length;
        if (received > maxBytes) {
          exceeded = true;
          try {
            if (typeof req.destroy === 'function') req.destroy();
          } catch {}
          if (!res.headersSent) {
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: false,
              code: 'PAYLOAD_TOO_LARGE',
              error: 'Request body too large.'
            }));
          }
          return false;
        }
      }
    }
    return origEmit.apply(this, [event, ...args]);
  };
}
