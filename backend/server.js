import { createApp, startServer } from './src/app.js';

const app = createApp();

export * from './src/legacyServer.js';
export { app };

const isTestRunner = process.env.NODE_ENV === 'test' || (process.argv[1] && process.argv[1].includes('test'));
if (!isTestRunner) {
  startServer().catch(error => {
    console.error('Backend startup failed:', error.message);
    process.exitCode = 1;
  });
}
