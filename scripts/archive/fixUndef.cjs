const fs = require('fs');
const path = require('path');

const mcpPath = path.join(__dirname, 'src/renderer/utils/mcpClient.ts');
let mcp = fs.readFileSync(mcpPath, 'utf8');
mcp = mcp.replace(/window\.electronAPI\.mcpSpawn/g, 'window.electronAPI?.mcpSpawn');
mcp = mcp.replace(/window\.electronAPI\.mcpCall/g, 'window.electronAPI?.mcpCall');
mcp = mcp.replace(/window\.electronAPI\.mcpKill/g, 'window.electronAPI?.mcpKill');
fs.writeFileSync(mcpPath, mcp);

const collabPath = path.join(__dirname, 'src/renderer/hooks/useCollaboration.ts');
let collab = fs.readFileSync(collabPath, 'utf8');
collab = collab.replace(/window\.electronAPI\.onServerStatus/g, 'window.electronAPI?.onServerStatus');
collab = collab.replace(/window\.electronAPI\.startCollaborationServer/g, 'window.electronAPI?.startCollaborationServer');
collab = collab.replace(/window\.electronAPI\.stopCollaborationServer/g, 'window.electronAPI?.stopCollaborationServer');
fs.writeFileSync(collabPath, collab);

console.log('Fixed undefined IPC calls');
