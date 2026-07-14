const fs = require('fs'); 
let tr = fs.readFileSync('packages/core/src/renderer/services/ai/orchestrator/ToolRegistry.ts', 'utf8'); 
tr = tr.replace(/execute: async \(args, context\) => \{\r?\n\s*const rawPath = String\(args\['path'\] \?\? ''\)/, `execute: async (args, context: any) => {\n        if (context?.retryScope === 'SECTION' || context?.retryScope === 'FUNCTION' || context?.retryScope === 'FIELD') {\n          return { success: false, error: 'UNAUTHORIZED_TOOL_USE: Cannot use write_file for partial repair scopes. Use apply_patch instead.', toolName: BUILTIN_TOOL_NAMES.WRITE_FILE, toolArgs: args };\n        }\n        const rawPath = String(args['path'] ?? '')`); 
fs.writeFileSync('packages/core/src/renderer/services/ai/orchestrator/ToolRegistry.ts', tr);
console.log('done');
