import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Start Marketplace Server
const marketPath = path.resolve(__dirname, '../../AMEVA-Workstation-Market-Place/server.js');
const marketProcess = spawn('node', [marketPath], {
  stdio: 'inherit',
  shell: true
});

// Start Vite
const viteProcess = spawn('npx', ['vite'], {
  stdio: 'inherit',
  shell: true
});

process.on('SIGINT', () => {
  marketProcess.kill();
  viteProcess.kill();
  process.exit();
});
process.on('SIGTERM', () => {
  marketProcess.kill();
  viteProcess.kill();
  process.exit();
});
