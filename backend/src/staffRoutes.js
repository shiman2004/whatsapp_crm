/**
 * staffRoutes.js — Staff & Coordinator Directory Endpoints
 * Extracted cleanly from legacyServer.js under the Strangler Fig migration pattern.
 */
import { getPrisma, getDbStatus } from './db.js';

/**
 * Handle Staff & Coordinator GET routes
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {string} pathname
 * @param {object} authUser
 * @param {object} ctx Shared state ({ CANONICAL_USERS, DELETED_USER_IDS })
 */
export async function handleStaffRoutes(req, res, pathname, authUser, ctx = {}) {
  if (req.method === 'GET' && pathname === '/api/coordinators') {
    const CANONICAL_USERS = ctx.CANONICAL_USERS || [];
    const DELETED_USER_IDS = ctx.DELETED_USER_IDS || new Set();

    const defaultCoordinators = CANONICAL_USERS
      .filter(u => !DELETED_USER_IDS.has(u.id) && u.active !== false)
      .map(u => {
        const { password, pin, ...safeUser } = u;
        return {
          ...safeUser,
          pinConfigured: Boolean(pin),
          branch: safeUser.branch || 'Colombo',
          company: safeUser.company !== undefined ? safeUser.company : (['leads_officer'].includes(safeUser.role) ? null : 'RWC'),
          createdAt: '2026-01-01T08:00:00Z',
          activeLeadsCount: 0,
        };
      });

    const prisma = getPrisma();
    if (prisma && getDbStatus()) {
      try {
        const users = await prisma.user.findMany({
          where: { active: true },
          orderBy: { createdAt: 'asc' }
        });
        if (users && users.length > 0) {
          const mappedUsers = users
            .filter(u => !DELETED_USER_IDS.has(u.id) && u.active !== false)
            .map(u => {
              const { password, pin, ...safeUser } = u;
              return {
                ...safeUser,
                pinConfigured: Boolean(pin),
                passwordConfigured: Boolean(password),
                branch: safeUser.branch || 'Colombo',
                company: safeUser.company || (['leads_officer'].includes(safeUser.role) ? null : 'RWC'),
              };
            });

          // Ensure all canonical users (such as Leads Officers) are present even if DB is partially seeded
          const existingIds = new Set(mappedUsers.map(u => u.id));
          const existingEmails = new Set(mappedUsers.map(u => (u.email || '').toLowerCase()));
          for (const canonical of defaultCoordinators) {
            if (!existingIds.has(canonical.id) && !existingEmails.has((canonical.email || '').toLowerCase())) {
              mappedUsers.push(canonical);
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(mappedUsers));
          return true;
        }
      } catch (e) {}
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(defaultCoordinators));
    return true;
  }

  return false;
}
