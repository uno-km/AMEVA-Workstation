const fs = require('fs');
const file = 'packages/core/src/renderer/services/ai/orchestrator/task-runtime/__tests__/phase3/Phase33ApplyPatchValidation.test.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/expect\(result.success\).toBe\(true\);/g, "if(!result.success) console.log(result.error); expect(result.success).toBe(true);");

fs.writeFileSync(file, content);
