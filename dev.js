import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

console.log('🚀 Starting Alpha Health Group Full-Stack Environment...\n');

// 1. Spawn Backend
// Run npm's JavaScript CLI through Node. Windows cannot reliably spawn the `.cmd`
// shim with shell disabled, while enabling a shell reintroduces argument-escaping
// risks. This stays shell-free and works with the installed Node distribution.
const npmCommand = process.execPath;
const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const npmArgs = [npmCli, 'run', 'dev'];
const backendDir = fileURLToPath(new URL('./backend/', import.meta.url));
const frontendDir = fileURLToPath(new URL('./frontend/', import.meta.url));

const backend = spawn(npmCommand, npmArgs, {
  cwd: backendDir,
  stdio: 'inherit',
  shell: false,
});

// 2. Spawn Frontend
const frontend = spawn(npmCommand, npmArgs, {
  cwd: frontendDir,
  stdio: 'inherit',
  shell: false,
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
