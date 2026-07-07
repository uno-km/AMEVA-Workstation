const fs = require('fs');
const path = require('path');
const adapterPath = path.join(__dirname, 'src/renderer/services/ipc/electronApiAdapter.ts');
let adapter = fs.readFileSync(adapterPath, 'utf8');

if (!adapter.includes('mcpSpawn?:')) {
  adapter = adapter.replace(
    /mcpKill\?: \(sessionId: string\) => Promise<void>;/,
    'mcpKill?: (sessionId: string) => Promise<void>;\n      mcpSpawn?: (...args: any[]) => Promise<any>;\n      mcpCall?: (...args: any[]) => Promise<any>;\n      onServerStatus?: (...args: any[]) => () => void;\n      startCollaborationServer?: (...args: any[]) => Promise<any>;\n      stopCollaborationServer?: (...args: any[]) => Promise<any>;'
  );
  fs.writeFileSync(adapterPath, adapter);
}
console.log('Fixed adapter');
