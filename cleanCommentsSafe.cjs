const fs = require('fs');

function cleanFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  const blockRegex = /\/\*(?:(?!\*\/)[\s\S])*?\[(?:RUN-TIME STATE \/ INVARIANT|ALGORITHM BRANCH \/ DECISION)\](?:(?!\*\/)[\s\S])*?\*\//g;
  
  const originalLength = content.length;
  content = content.replace(blockRegex, '');
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Cleaned ${filePath}. Removed ${originalLength - content.length} characters.`);
}

cleanFile('c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/packages/core/src/renderer/components/AIPanel.tsx');
cleanFile('c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/packages/core/src/renderer/services/ai/orchestrator/AgentOrchestrator.ts');