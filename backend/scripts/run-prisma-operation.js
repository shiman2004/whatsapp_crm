import { spawn } from 'node:child_process';
import { assertDatabaseOperationAllowed } from '../src/databasePolicy.js';

const operation = process.argv[2];
const commands = {
  push: ['db', 'push'],
  'migrate-dev': ['migrate', 'dev'],
  'migrate-deploy': ['migrate', 'deploy'],
};

if (!commands[operation]) {
  console.error('Usage: node scripts/run-prisma-operation.js <push|migrate-dev|migrate-deploy>');
  process.exit(1);
}

try {
  assertDatabaseOperationAllowed(operation === 'migrate-deploy' ? 'migration' : 'utility');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['prisma', ...commands[operation]], { stdio: 'inherit' });
child.on('error', (error) => {
  console.error(`Unable to start Prisma: ${error.message}`);
  process.exit(1);
});
child.on('close', (code) => process.exit(code ?? 1));
