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

// Global Process Crash Shield: Prevent unhandled promise rejections from crashing the process
process.on('unhandledRejection', (reason) => {
  console.error('🚨 [Process Crash Shield] Unhandled Promise Rejection:', reason?.stack || reason?.message || reason);
});

process.on('uncaughtException', (err) => {
  console.error('🚨 [Process Crash Shield] Uncaught Exception:', err?.stack || err?.message || err);
  if (process.env.NODE_ENV === 'test') {
    process.exit(1);
  }
});

if (isEntryPoint) {
  let isShuttingDown = false;
  const gracefulShutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n🛑 [Shutdown] Received ${signal}. Closing server gracefully...`);

    if (app && typeof app.close === 'function') {
      app.close(async () => {
        console.log('✅ [Shutdown] HTTP listener closed cleanly.');
        try {
          const { getPrisma } = await import('./src/db.js');
          const prisma = getPrisma();
          if (prisma && typeof prisma.$disconnect === 'function') {
            await prisma.$disconnect();
            console.log('✅ [Shutdown] Database disconnected cleanly.');
          }
        } catch {}
        process.exit(0);
      });

      // Force exit after 10 seconds if connections hang
      setTimeout(() => {
        process.exit(0);
      }, 10000).unref();
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  startServer().catch(error => {
    console.error('Backend startup failed:', error.message);
    process.exitCode = 1;
  });
}
