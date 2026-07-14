const fs = require('fs');
const file = 'packages/core/src/renderer/services/ai/orchestrator/task-runtime/__tests__/phase3/Phase33ApplyPatchValidation.test.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/expect\(result.success\).toBe\(false\);/g, "console.log('RESULT:', JSON.stringify(result, null, 2)); expect(result.success).toBe(false);");

fs.writeFileSync(file, content);
