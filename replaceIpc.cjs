const fs = require('fs');
const path = require('path');

const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
};

const files = walk('c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/packages/core/src/renderer');

let modifiedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Replace ipc.isElectronEnv() -> getPlatformAdapter().isNative
  content = content.replace(/ipc\.isElectronEnv\(\)/g, "getPlatformAdapter().isNative");

  // AI Adapter replacements
  content = content.replace(/ipc\.llmGenerate/g, "getPlatformAdapter().ai.generate");
  content = content.replace(/ipc\.llmAbort/g, "getPlatformAdapter().ai.abort");
  content = content.replace(/ipc\.llmListModels/g, "getPlatformAdapter().ai.getModels");
  content = content.replace(/ipc\.llmCheckHealth/g, "getPlatformAdapter().ai.checkHealth");
  content = content.replace(/ipc\.llmGetLogs/g, "getPlatformAdapter().ai.getLogs");
  content = content.replace(/ipc\.llmDownloadModel/g, "getPlatformAdapter().ai.downloadModel");
  content = content.replace(/ipc\.onLLMDownloadProgress/g, "getPlatformAdapter().ai.onDownloadProgress");
  content = content.replace(/ipc\.onLLMToken/g, "getPlatformAdapter().ai.onToken");
  content = content.replace(/ipc\.onLLMDone/g, "getPlatformAdapter().ai.onDone");
  content = content.replace(/ipc\.onLLMLog/g, "getPlatformAdapter().ai.onLog");
  
  // Keychain Adapter replacements
  content = content.replace(/ipc\.keychainGet/g, "getPlatformAdapter().keychain.get");
  content = content.replace(/ipc\.keychainSet/g, "getPlatformAdapter().keychain.set");
  content = content.replace(/ipc\.keychainDelete/g, "getPlatformAdapter().keychain.delete");

  // MCP Adapter replacements
  content = content.replace(/ipc\.mcpSpawn/g, "getPlatformAdapter().mcp.spawn");
  content = content.replace(/ipc\.mcpCall/g, "getPlatformAdapter().mcp.call");
  content = content.replace(/ipc\.mcpKill/g, "getPlatformAdapter().mcp.kill");
  content = content.replace(/ipc\.mcpGetToken/g, "getPlatformAdapter().mcp.getToken");

  // Settings Adapter replacements
  content = content.replace(/ipc\.llmGetGpuName/g, "getPlatformAdapter().settings.getGpuName");
  content = content.replace(/ipc\.planGetStatus/g, "getPlatformAdapter().settings.getPlanStatus");
  content = content.replace(/ipc\.planSetStatus/g, "getPlatformAdapter().settings.setPlanStatus");

  if (content !== originalContent) {
    if (!content.includes('getPlatformAdapter')) {
      const importStatement = "import { getPlatformAdapter } from '../../../shared/adapters/platformAdapter';\n";
      // Find the last import
      const lastImportIndex = content.lastIndexOf('import ');
      if (lastImportIndex !== -1) {
        const nextLineIndex = content.indexOf('\n', lastImportIndex);
        content = content.slice(0, nextLineIndex + 1) + importStatement + content.slice(nextLineIndex + 1);
      } else {
        content = importStatement + content;
      }
    }
    fs.writeFileSync(file, content, 'utf8');
    modifiedCount++;
    console.log("Modified: " + file);
  }
});

console.log("Total modified files: " + modifiedCount);