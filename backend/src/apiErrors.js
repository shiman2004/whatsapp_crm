// Shared API error contract for the settings / company modules.
// Every response is JSON so the frontend never has to guess why a request failed.

export class ApiError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function sendJson(res, status, payload) {
  if (res.writableEnded) return;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

const PRISMA_STATUS = {
  P2002: [409, 'UNIQUE_CONFLICT', 'A record with the same unique value already exists.'],
  P2003: [409, 'FOREIGN_KEY_CONFLICT', 'This record is still referenced by other data.'],
  P2025: [404, 'NOT_FOUND', 'The requested record no longer exists.'],
};

export function sendError(res, error, correlationId) {
  if (error instanceof ApiError) {
    sendJson(res, error.status, {
      success: false,
      error: error.code,
      message: error.message,
      ...error.details,
      ...(correlationId ? { correlationId } : {}),
    });
    return;
  }

  const prismaMapping = PRISMA_STATUS[error?.code];
  if (prismaMapping) {
    const [status, code, message] = prismaMapping;
    sendJson(res, status, {
      success: false,
      error: code,
      message,
      ...(correlationId ? { correlationId } : {}),
    });
    return;
  }

  // Prisma connection / pool errors start with P1 (P1001, P1017, P2024…).
  if (typeof error?.code === 'string' && error.code.startsWith('P1')) {
    sendJson(res, 503, {
      success: false,
      error: 'DATABASE_UNAVAILABLE',
      message: 'The database is temporarily unavailable. Please retry in a moment.',
      ...(correlationId ? { correlationId } : {}),
    });
    return;
  }

  console.error('[CompanyRoutes Error]:', error);
  sendJson(res, 500, {
    success: false,
    error: 'INTERNAL_ERROR',
    message: 'An unexpected server error occurred.',
    ...(correlationId ? { correlationId } : {}),
  });
}

/**
 * Reads and parses a JSON request body with a hard size cap.
 * Empty bodies are treated as `{}` so PATCH calls can be partial.
 */
export function readJsonBody(req, { maxBytes = 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.'));
        req.destroy();
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(body);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(new ApiError(400, 'INVALID_JSON', 'Request body must be a JSON object.'));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.'));
      }
    });

    req.on('error', () => reject(new ApiError(400, 'REQUEST_ERROR', 'Could not read the request body.')));
  });
}

export function queryOf(req) {
  try {
    const url = new URL(req.url, 'http://localhost');
    return Object.fromEntries(url.searchParams.entries());
  } catch {
    return {};
  }
}
