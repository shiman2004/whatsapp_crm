import { server, startServer } from './legacyServer.js';

/**
 * Application composition boundary. Route extraction can happen behind this
 * stable API without changing the public server entry point or contracts.
 */
export function createApp() {
  return server;
}

export { startServer };
