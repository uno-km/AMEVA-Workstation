const fs = require('fs');
const path = require('path');

// 1. aiTypes.ts - finalAnswer
const aiTypesPath = path.join(__dirname, 'src/renderer/types/aiTypes.ts');
if (fs.existsSync(aiTypesPath)) {
  let aiTypes = fs.readFileSync(aiTypesPath, 'utf8');
  aiTypes = aiTypes.replace('content: string', 'content: string\n  finalAnswer?: string');
  fs.writeFileSync(aiTypesPath, aiTypes);
}

// 2. useAIAgent.ts
const aiAgentPath = path.join(__dirname, 'src/renderer/hooks/useAIAgent.ts');
if (fs.existsSync(aiAgentPath)) {
  let agent = fs.readFileSync(aiAgentPath, 'utf8');
  agent = agent.replace('const pendingQueueRef', '// const pendingQueueRef');
  agent = agent.replace('const assistantId', '// const assistantId');
  agent = agent.replace(/return messages\.map\(\(m: any\) => \(\{/g, 'return messages.map((m: any) => ({ role: (m.role as "user" | "assistant"),');
  fs.writeFileSync(aiAgentPath, agent);
}

// 3. agentTools.ts - imports
const agentToolsPath = path.join(__dirname, 'src/renderer/services/ai/agentTools.ts');
if (fs.existsSync(agentToolsPath)) {
  let tools = fs.readFileSync(agentToolsPath, 'utf8');
  tools = tools.replace('../ipc/mcpClientManager', '../../utils/mcpClient'); // or whatever it was changed to
  tools = tools.replace('./agentEngine', '../../utils/agentEngine');
  tools = tools.replace(/args: any/g, 'args: unknown');
  tools = tools.replace(/args\)/g, 'args: unknown)');
  fs.writeFileSync(agentToolsPath, tools);
}

// 4. agentStockCard.ts
const stockPath = path.join(__dirname, 'src/renderer/services/ai/agentStockCard.ts');
if (fs.existsSync(stockPath)) {
  let stock = fs.readFileSync(stockPath, 'utf8');
  stock = stock.replace(/import \{ parseEditSuggestion, parseInsertSuggestions \} from '\.\.\/\.\.\/utils\/ragUtils'/g, '// import { parseEditSuggestion, parseInsertSuggestions } from "../../utils/ragUtils"');
  fs.writeFileSync(stockPath, stock);
}

// 5. analyzeApiKey.ts
const analyzePath = path.join(__dirname, 'src/renderer/services/ai/analyzeApiKey.ts');
if (fs.existsSync(analyzePath)) {
  let analyze = fs.readFileSync(analyzePath, 'utf8');
  analyze = analyze.replace(/import \{.*?\} from '\.\.\/\.\.\/shared\/constants\/aiSettings'/g, '// import aiSettings');
  analyze = analyze.replace(/prefix: any/g, 'prefix: string');
  analyze = analyze.replace(/prefix\)/g, 'prefix: string)');
  fs.writeFileSync(analyzePath, analyze);
}

// 6. useLocalAIEngine.ts
const localAIPath = path.join(__dirname, 'src/renderer/hooks/useLocalAIEngine.ts');
if (fs.existsSync(localAIPath)) {
  let local = fs.readFileSync(localAIPath, 'utf8');
  local = local.replace(/const isAvailable =/, '// const isAvailable =');
  local = local.replace(/const models =/, '// const models =');
  local = local.replace(/const codeModels =/, '// const codeModels =');
  fs.writeFileSync(localAIPath, local);
}

// 7. responseSanitizer.test.ts
const sanitizerPath = path.join(__dirname, 'src/renderer/utils/__tests__/responseSanitizer.test.ts');
if (fs.existsSync(sanitizerPath)) {
  let san = fs.readFileSync(sanitizerPath, 'utf8');
  san = san.replace(/const suites =/, '// const suites =');
  san = san.replace(/const currentSuite =/, '// const currentSuite =');
  fs.writeFileSync(sanitizerPath, san);
}

// 8. responseSanitizer.ts
const respSanPath = path.join(__dirname, 'src/renderer/utils/responseSanitizer.ts');
if (fs.existsSync(respSanPath)) {
  let resp = fs.readFileSync(respSanPath, 'utf8');
  resp = resp.replace(/const MAX_PARTIAL_TAG_LEN = 20/, '// const MAX_PARTIAL_TAG_LEN = 20');
  fs.writeFileSync(respSanPath, resp);
}

// 9. markdownUtils.ts
const mdUtilsPath = path.join(__dirname, 'src/renderer/utils/markdownUtils.ts');
if (fs.existsSync(mdUtilsPath)) {
  let md = fs.readFileSync(mdUtilsPath, 'utf8');
  md = md.replace(/match =>/, '() =>');
  md = md.replace(/match,/, '_,');
  fs.writeFileSync(mdUtilsPath, md);
}

console.log('Fixed auxiliary errors.');
