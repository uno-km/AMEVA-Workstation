const fs = require('fs');
let tr = fs.readFileSync('packages/core/src/renderer/services/ai/orchestrator/ToolRegistry.ts', 'utf8');

const target1 = "      execute: async (args, context) => {\n        const rawPath = String(args['path'] ?? '')";
const target2 = "      execute: async (args, context) => {\r\n        const rawPath = String(args['path'] ?? '')";

const replacement = "      execute: async (args, context: any) => {\n        if (context?.retryScope === 'SECTION' || context?.retryScope === 'FUNCTION' || context?.retryScope === 'FIELD') {\n          return { success: false, error: 'UNAUTHORIZED_TOOL_USE: Cannot use write_file for partial repair scopes. Use apply_patch instead.', toolName: BUILTIN_TOOL_NAMES.WRITE_FILE, toolArgs: args };\n        }\n        const rawPath = String(args['path'] ?? '')";

if (tr.includes(target1)) {
    tr = tr.replace(target1, replacement);
    fs.writeFileSync('packages/core/src/renderer/services/ai/orchestrator/ToolRegistry.ts', tr);
    console.log("Success");
} else if (tr.includes(target2)) {
    tr = tr.replace(target2, replacement.replace(/\n/g, '\r\n'));
    fs.writeFileSync('packages/core/src/renderer/services/ai/orchestrator/ToolRegistry.ts', tr);
    console.log("Success CRLF");
} else {
    console.log("Not found");
}
