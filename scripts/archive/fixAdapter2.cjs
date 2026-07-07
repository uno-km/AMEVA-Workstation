const fs = require('fs');
const path = require('path');

const adapterPath = path.join(__dirname, 'src/renderer/services/ipc/electronApiAdapter.ts');
let adapter = fs.readFileSync(adapterPath, 'utf8');

adapter = adapter.replace(
  /mcpSpawn\?: \(server: string\) => Promise<any>;/,
  'mcpSpawn?: (serverPath: string, args: string[], env: any) => Promise<any>;\n      mcpCall?: (sessionId: string, method: string, params?: any) => Promise<any>;\n      mcpKill?: (sessionId: string) => Promise<void>;\n      onServerStatus?: (callback: (data: any) => void) => () => void;\n      startCollaborationServer?: (port: number) => Promise<any>;\n      stopCollaborationServer?: () => Promise<any>;'
);

// Also add optional chaining fixes to mcpClient.ts
const mcpPath = path.join(__dirname, 'src/renderer/utils/mcpClient.ts');
if (fs.existsSync(mcpPath)) {
    let mcp = fs.readFileSync(mcpPath, 'utf8');
    mcp = mcp.replace(/window\.electronAPI\.mcpSpawn\(/g, 'window.electronAPI?.mcpSpawn?.(');
    mcp = mcp.replace(/window\.electronAPI\.mcpCall\(/g, 'window.electronAPI?.mcpCall?.(');
    mcp = mcp.replace(/window\.electronAPI\.mcpKill\(/g, 'window.electronAPI?.mcpKill?.(');
    fs.writeFileSync(mcpPath, mcp);
}

// Fix useCollaboration.ts
const collabPath = path.join(__dirname, 'src/renderer/hooks/useCollaboration.ts');
if (fs.existsSync(collabPath)) {
    let collab = fs.readFileSync(collabPath, 'utf8');
    collab = collab.replace(/window\.electronAPI\.onServerStatus\(/g, 'window.electronAPI?.onServerStatus?.(');
    collab = collab.replace(/window\.electronAPI\.startCollaborationServer\(/g, 'window.electronAPI?.startCollaborationServer?.(');
    collab = collab.replace(/window\.electronAPI\.stopCollaborationServer\(/g, 'window.electronAPI?.stopCollaborationServer?.(');
    fs.writeFileSync(collabPath, collab);
}

fs.writeFileSync(adapterPath, adapter);
console.log('Fixed MCP/Collab IPC types');
