import {
  getAllConnections,
  getConnectionById,
  testConnection,
  reconnectConnection,
  getConnectionHistory
} from './whatsappConnectionService.js';

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Dispatches WhatsApp Connection Management HTTP endpoints
 */
export async function handleWhatsAppConnectionRoutes(req, res, pathname, user, correlationId, broadcastFn = null) {
  if (!pathname.startsWith('/api/whatsapp/connections')) {
    return false;
  }

  // Handle pre-flight CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Correlation-ID'
    });
    res.end();
    return true;
  }

  // 1. Authorization: Ensure user is authenticated
  if (!user) {
    json(res, 401, { success: false, error: 'Unauthorized: Authentication required.' });
    return true;
  }

  // Connection metadata is admin-only; all other roles are denied.
  const canView = ['super_admin', 'marketing_admin'].includes(user.role);

  if (!canView) {
    json(res, 403, {
      success: false,
      error: 'Forbidden: You do not have permission to view WhatsApp connections.'
    });
    return true;
  }

  // Roles allowed to perform test & reconnect operations: Super Admin or Admin
  const canManage = ['super_admin', 'marketing_admin'].includes(user.role);

  // GET /api/whatsapp/connections
  if (req.method === 'GET' && pathname === '/api/whatsapp/connections') {
    try {
      const connections = await getAllConnections();
      json(res, 200, {
        success: true,
        connections,
        summary: {
          total: connections.length,
          connected: connections.filter((c) => c.connectionStatus === 'CONNECTED').length,
          disconnected: connections.filter((c) => ['DISCONNECTED', 'EXPIRED'].includes(c.connectionStatus)).length,
          errors: connections.filter((c) => c.connectionStatus === 'ERROR').length
        }
      });
    } catch (err) {
      json(res, 500, { success: false, error: err.message });
    }
    return true;
  }

  // Match /api/whatsapp/connections/:id and sub-actions
  const match = pathname.match(/^\/api\/whatsapp\/connections\/([a-zA-Z0-9_-]+)(?:\/(test|reconnect|history))?$/);
  if (!match) {
    json(res, 404, { success: false, error: 'WhatsApp connection route not found.' });
    return true;
  }

  const [, connectionId, action] = match;

  // GET /api/whatsapp/connections/:id
  if (req.method === 'GET' && !action) {
    try {
      const connection = await getConnectionById(connectionId);
      if (!connection) {
        json(res, 404, { success: false, error: `Connection "${connectionId}" not found.` });
        return true;
      }
      json(res, 200, { success: true, connection });
    } catch (err) {
      json(res, 500, { success: false, error: err.message });
    }
    return true;
  }

  // GET /api/whatsapp/connections/:id/history
  if (req.method === 'GET' && action === 'history') {
    try {
      const history = await getConnectionHistory(connectionId);
      json(res, 200, { success: true, history });
    } catch (err) {
      json(res, 500, { success: false, error: err.message });
    }
    return true;
  }

  // POST /api/whatsapp/connections/:id/test
  if (req.method === 'POST' && action === 'test') {
    if (!canManage) {
      json(res, 403, {
        success: false,
        error: 'Forbidden: Administrator privileges required to test WhatsApp connections.'
      });
      return true;
    }

    try {
      const result = await testConnection(connectionId, user);
      json(res, 200, { success: true, ...result });
    } catch (err) {
      json(res, 500, { success: false, error: err.message });
    }
    return true;
  }

  // POST /api/whatsapp/connections/:id/reconnect
  if (req.method === 'POST' && action === 'reconnect') {
    if (!canManage) {
      json(res, 403, {
        success: false,
        error: 'Forbidden: Super Admin privileges required to reconnect WhatsApp numbers.'
      });
      return true;
    }

    try {
      const result = await reconnectConnection(connectionId, user, broadcastFn);
      const conflict = result.alreadyInProgress || result.rateLimited;
      json(res, conflict ? 409 : 200, result);
    } catch (err) {
      json(res, 500, { success: false, error: err.message });
    }
    return true;
  }

  json(res, 405, { success: false, error: 'Method Not Allowed' });
  return true;
}
