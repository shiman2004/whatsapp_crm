import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp, startServer } from './src/app.js';

const app = createApp();

export * from './src/legacyServer.js';
export { app };

// Start the HTTP listener unless this module is being imported by a test suite.
// Test suites either import this module for its exports (nothing should be bound) or
// spawn `node server.js` themselves (the port MUST be bound). The decision therefore
// keys off whether this exact file is the process entry point — relying on
// NODE_ENV=test alone would wrongly suppress the listener for the spawned case.
const isEntryPoint = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint) {
  startServer().catch(error => {
    console.error('Backend startup failed:', error.message);
    process.exitCode = 1;
  });
}
