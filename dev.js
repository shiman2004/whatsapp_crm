import { spawn } from 'child_process';
import path from 'path';

console.log('🚀 Starting Royal Wellness Full-Stack Environment...\n');

// 1. Spawn Backend
const backend = spawn('npm', ['run', 'dev'], {
  cwd: path.join(process.cwd(), 'backend'),
  stdio: 'inherit',
  shell: true,
});

// 2. Spawn Frontend
const frontend = spawn('npm', ['run', 'dev'], {
  cwd: path.join(process.cwd(), 'frontend'),
  stdio: 'inherit',
  shell: true,
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
