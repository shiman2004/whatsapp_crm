// auth.js – JWT verification and helper middlewares
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || '';

/**
 * Verify JWT from Authorization header. Populates req.user with payload.
 */
export function verifyJwt(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // payload should contain at least { id, role, company }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token', details: e.message });
  }
}

/**
 * Simple wrapper to ensure a request is authenticated.
 */
export const requireAuth = [verifyJwt];

/**
 * Check that the authenticated user has one of the required roles.
 * @param {string[]} allowedRoles
 */
export function checkRole(allowedRoles) {
  return function (req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
    if (allowedRoles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: insufficient role' });
  };
}

export default { verifyJwt, requireAuth, checkRole };
