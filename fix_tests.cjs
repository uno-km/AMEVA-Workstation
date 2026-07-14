const fs = require('fs');
const filesToUpdate = [
  'packages/core/src/renderer/services/ai/orchestrator/task-runtime/__tests__/phase3/Phase32ArtifactTransaction.integration.test.ts',
  'packages/core/src/renderer/services/ai/orchestrator/task-runtime/__tests__/Phase2FinalAudit.integration.test.ts',
  'packages/core/src/renderer/services/ai/orchestrator/task-runtime/__tests__/Phase2ArtifactTransaction.test.ts',
  'packages/core/src/renderer/services/ai/orchestrator/task-runtime/executors/DeepTaskExecutor.ts'
];

for (const file of filesToUpdate) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    // Replace txManager.markWritten('m1', artifactId) with markStaged then markWritten
    content = content.replace(/await\s+([a-zA-Z0-9_]+)\.markWritten\(([^,]+),\s*([^)]+)\);/g, "await $1.markStaged($2, $3);\n    await $1.markWritten($2, $3);");
    // DeepTaskExecutor uses this.artifactManager.markWritten
    content = content.replace(/await\s+this\.artifactManager\.markWritten\(([^,]+),\s*([^)]+)\);/g, "await this.artifactManager.markStaged($1, $2);\n              await this.artifactManager.markWritten($1, $2);");
    // Phase2FinalAudit.integration.test.ts mock logic
    content = content.replace(/vi\.spyOn\(txManager,\s*'markWritten'\)\.mockImplementation\(async\s*\(\)\s*=>\s*\{\s*sequenceLog\.push\('WRITTEN'\);\s*\}\);/g, "vi.spyOn(txManager, 'markStaged').mockImplementation(async () => { sequenceLog.push('STAGED'); });\n    vi.spyOn(txManager, 'markWritten').mockImplementation(async () => { sequenceLog.push('WRITTEN'); });");
    
    fs.writeFileSync(file, content);
  }
}
console.log("Updated tests to use STAGED.");
