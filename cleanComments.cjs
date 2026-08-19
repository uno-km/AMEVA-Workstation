const fs = require('fs');

function cleanFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace the massive comment blocks
  // They look like:
  // /*
  //  * [RUN-TIME STATE / INVARIANT]
  //  ...
  //  */
  // We can use a regex to match from /* to */ if it contains [RUN-TIME STATE / INVARIANT] or [ALGORITHM BRANCH / DECISION]
  
  const blockRegex = /\/\*[\s\S]*?(?:\[RUN-TIME STATE \/ INVARIANT\]|\[ALGORITHM BRANCH \/ DECISION\])[\s\S]*?\*\//g;
  
  const originalLength = content.length;
  content = content.replace(blockRegex, '');
  
  // Also clean up empty lines created by removing comments
  content = content.replace(/\n\s*\n/g, '\n\n');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Cleaned ${filePath}. Removed ${originalLength - content.length} characters.`);
}

cleanFile('c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/packages/core/src/renderer/hooks/app/useAppFileOperations.ts');
cleanFile('c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/packages/core/src/renderer/components/AIPanel.tsx');
cleanFile('c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/packages/core/src/renderer/services/ai/orchestrator/AgentOrchestrator.ts');