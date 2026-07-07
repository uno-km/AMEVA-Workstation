const fs = require('fs');
const path = require('path');

// 1. ipcTypes.ts - ModelInfo name
const ipcTypesPath = path.join(__dirname, 'src/renderer/services/ipc/ipcTypes.ts');
let ipcTypes = fs.readFileSync(ipcTypesPath, 'utf8');
ipcTypes = ipcTypes.replace('filename: string', 'filename: string\n  name?: string');
fs.writeFileSync(ipcTypesPath, ipcTypes);

// 2. electronApiAdapter.ts - missing MCP/Agent methods
const adapterPath = path.join(__dirname, 'src/renderer/services/ipc/electronApiAdapter.ts');
let adapter = fs.readFileSync(adapterPath, 'utf8');
adapter = adapter.replace(
  '// MCP',
  'mcpSpawn?: (server: string) => Promise<any>;\n      mcpCall?: (server: string, method: string, params: any) => Promise<any>;\n      mcpKill?: (server: string) => Promise<any>;\n      runPythonCode?: (code: string) => Promise<any>;\n      webSearch?: (query: string) => Promise<any>;\n      // MCP'
);
fs.writeFileSync(adapterPath, adapter);

// 3. useReasoningProvider.ts - sessionId
const reasoningPath = path.join(__dirname, 'src/renderer/hooks/useReasoningProvider.ts');
if (fs.existsSync(reasoningPath)) {
  let reasoning = fs.readFileSync(reasoningPath, 'utf8');
  reasoning = reasoning.replace(/modelPath:/g, 'sessionId: "default",\n      modelPath:');
  // Also Expected 2 arguments but got 1
  reasoning = reasoning.replace(/onLLMToken\(\(token\)/g, 'onLLMToken("default", (token)');
  reasoning = reasoning.replace(/onLLMDone\(\(data\)/g, 'onLLMDone("default", (data)');
  fs.writeFileSync(reasoningPath, reasoning);
}

// 4. agentEngine.ts - enum -> const
const agentEnginePath = path.join(__dirname, 'src/renderer/utils/agentEngine.ts');
if (fs.existsSync(agentEnginePath)) {
  let agentEngine = fs.readFileSync(agentEnginePath, 'utf8');
  agentEngine = agentEngine.replace(/export enum AgentState \{/g, 'export const AgentState = {');
  agentEngine = agentEngine.replace(/Idle = 'idle',/g, 'Idle: "idle",');
  agentEngine = agentEngine.replace(/Thinking = 'thinking',/g, 'Thinking: "thinking",');
  agentEngine = agentEngine.replace(/Working = 'working',/g, 'Working: "working",');
  agentEngine = agentEngine.replace(/Done = 'done',/g, 'Done: "done",');
  agentEngine = agentEngine.replace(/Error = 'error'/g, 'Error: "error"');
  agentEngine = agentEngine.replace(/\} as const;/g, '} as const;\nexport type AgentState = typeof AgentState[keyof typeof AgentState];');
  if(!agentEngine.includes('type AgentState = typeof AgentState')) {
      agentEngine = agentEngine.replace(/Error: "error"\n\}/g, 'Error: "error"\n} as const;\nexport type AgentState = typeof AgentState[keyof typeof AgentState];');
  }
  fs.writeFileSync(agentEnginePath, agentEngine);
}

// 5. exporters.ts - implicit any
const exportersPath = path.join(__dirname, 'src/renderer/utils/exporters.ts');
if (fs.existsSync(exportersPath)) {
  let exporters = fs.readFileSync(exportersPath, 'utf8');
  exporters = exporters.replace(/block\.children\.forEach\(c => \{/g, 'block.children.forEach((c: unknown) => {');
  fs.writeFileSync(exportersPath, exporters);
}

// 6. index.ts - map(l => l.trim()) again
const indexPath = path.join(__dirname, 'src/main/index.ts');
let index = fs.readFileSync(indexPath, 'utf8');
index = index.replace(/lines = out\.split\(\/\\r\?\\n\/\)\.map\(l => l\.trim\(\)\)\.filter\(l => l && l !== 'Name'\)/g, 'lines = out.split(/\\r?\\n/).map((l: string) => l.trim()).filter((l: string) => l && l !== "Name")');
fs.writeFileSync(indexPath, index);

// 7. preload.ts - webFrame
const preloadPath = path.join(__dirname, 'src/main/preload.ts');
let preload = fs.readFileSync(preloadPath, 'utf8');
preload = preload.replace(/, webFrame/g, '');
fs.writeFileSync(preloadPath, preload);

console.log('Fixed more errors.');
