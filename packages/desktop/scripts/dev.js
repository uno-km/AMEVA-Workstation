import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Start Marketplace Server (지연 실행)
let marketProcess;
setTimeout(() => {
  const marketPath = path.resolve(__dirname, '../../../../AMEVA-Workstation-Market-Place/server.js');
  marketProcess = spawn('node', [marketPath], {
    stdio: 'inherit',
    shell: false
  });
}, 3000); // 3초 뒤 실행하여 에디터 윈도우 팝업을 최우선으로 보장

// Start Vite
const isWindows = process.platform === 'win32';
const viteProcess = spawn(isWindows ? 'npx.cmd' : 'npx', ['vite'], {
  stdio: 'inherit',
  shell: false
});

viteProcess.on('close', (code) => {
  if (marketProcess) marketProcess.kill();
  process.exit(code);
});

process.on('SIGINT', () => {
  if (marketProcess) marketProcess.kill();
  viteProcess.kill();
  process.exit();
});
process.on('SIGTERM', () => {
  if (marketProcess) marketProcess.kill();
  viteProcess.kill();
  process.exit();
});
