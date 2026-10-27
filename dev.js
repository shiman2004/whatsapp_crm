import { execFile, spawn } from 'child_process';
import net from 'node:net';
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

const backendPort = Number(process.env.PORT || 3001);
const frontendPort = Number(process.env.FRONTEND_PORT || 5173);

function isPortAvailable(port) {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.once('error', error => resolve(error.code !== 'EADDRINUSE'));
    probe.once('listening', () => probe.close(() => resolve(true)));
    // Bind on the wildcard address so listeners bound to localhost, IPv6, or
    // 0.0.0.0 are all detected before a child process is spawned.
    probe.listen(port);
  });
}

async function spawnIfAvailable(command, args, cwd, label, port) {
  if (!(await isPortAvailable(port))) {
    console.log(`Already running: ${label} on port ${port}. Reusing it.`);
    return null;
  }

  return spawn(command, args, { cwd, stdio: 'inherit', shell: false });
}

const backend = await spawnIfAvailable(npmCommand, npmArgs, backendDir, 'backend', backendPort);

// 2. Spawn Frontend
const frontend = await spawnIfAvailable(npmCommand, npmArgs, frontendDir, 'frontend', frontendPort);

const cleanup = () => {
  console.log('\n🛑 Shutting down development servers...');
  for (const child of [backend, frontend]) {
    if (!child?.pid) continue;
    if (process.platform === 'win32') {
      // npm launches the actual watcher as a descendant on Windows. Killing
      // only npm leaves that watcher listening on 3000/5173 for the next run.
      execFile('taskkill', ['/pid', String(child.pid), '/t', '/f'], () => {});
    } else {
      child.kill('SIGINT');
    }
  }
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
