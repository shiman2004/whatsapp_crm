import { spawn } from 'child_process';
import path from 'path';

console.log('🚀 Starting Alpha Health Group Full-Stack Environment...\n');

// 1. Spawn Backend
const npmCommand = process.platform === 'win32'
  ? process.execPath
  : 'npm';
const npmArgs = process.platform === 'win32'
  ? [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')]
  : [];

const backend = spawn(npmCommand, [...npmArgs, 'run', 'dev'], {
  cwd: path.join(process.cwd(), 'backend'),
  stdio: 'inherit',
});

// 2. Spawn Frontend
const frontend = spawn(npmCommand, [...npmArgs, 'run', 'dev'], {
  cwd: path.join(process.cwd(), 'frontend'),
  stdio: 'inherit',
});

const cleanup = () => {
  console.log('\n🛑 Shutting down development servers...');
  backend.kill('SIGINT');
  frontend.kill('SIGINT');
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
