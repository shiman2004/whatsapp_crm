import { CAPABILITIES, assertMarketingCapability, marketingRoleSummary } from './permissions.js';

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

// Phase 1 only exposes a protected capability discovery endpoint. Contact, import,
// assignment, campaign, and reporting handlers are added in their respective phases.
export async function handleMarketingRoutes(req, res, pathname, authUser) {
  if (!pathname.startsWith('/api/marketing')) return false;

  if (req.method === 'GET' && pathname === '/api/marketing/health') {
    const authorization = assertMarketingCapability(authUser, CAPABILITIES.dashboard);
    if (authorization) return sendJson(res, authorization.status, { success: false, error: authorization });

    return sendJson(res, 200, {
      success: true,
      data: {
        module: 'public-contact-marketing',
        phase: 'foundation',
        company: authUser.company || null,
        ...marketingRoleSummary(authUser)
      }
    });
  }

  return sendJson(res, 404, {
    success: false,
    error: { code: 'MARKETING_ROUTE_NOT_AVAILABLE', message: 'This marketing capability is not available in the current release phase.' }
  });
}
