const fs = require('fs');
const path = require('path');

const agentToolsPath = path.join(__dirname, 'src/renderer/services/ai/agentTools.ts');
if (fs.existsSync(agentToolsPath)) {
  let tools = fs.readFileSync(agentToolsPath, 'utf8');
  tools = tools.replace(/args: unknown\)/g, 'args)');
  tools = tools.replace(/async \(args\)/g, 'async (args: unknown)');
  fs.writeFileSync(agentToolsPath, tools);
}

const analyzePath = path.join(__dirname, 'src/renderer/services/ai/analyzeApiKey.ts');
if (fs.existsSync(analyzePath)) {
  let analyze = fs.readFileSync(analyzePath, 'utf8');
  analyze = analyze.replace(/prefix: string\)/g, 'prefix)');
  analyze = analyze.replace(/export async function analyzeApiKey\(key: string, prefix\)/g, 'export async function analyzeApiKey(key: string, prefix: string)');
  analyze = analyze.replace(/export function parseKeyPrefix\(key: string, prefix\)/g, 'export function parseKeyPrefix(key: string, prefix: string)');
  fs.writeFileSync(analyzePath, analyze);
}
console.log('Fixed syntax.');
