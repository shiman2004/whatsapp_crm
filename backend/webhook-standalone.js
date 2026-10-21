/**
 * Compatibility launcher for deployments that still invoke `npm run webhook`.
 * The former standalone server duplicated webhook, SSE and Meta sending logic
 * with weaker security controls. It now delegates to the maintained app.
 */
import dotenv from 'dotenv';

dotenv.config();
if (!process.env.PORT) process.env.PORT = '3001';

const { startServer } = await import('./src/app.js');
await startServer();
