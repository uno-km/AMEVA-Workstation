import sys

with open('packages/core/src/renderer/services/ai/orchestrator/ToolRegistry.ts', 'r', encoding='utf-8') as f:
    tr = f.read()

target = "      execute: async (args, context) => {\n        const rawPath = String(args['path'] ?? '')"
replacement = """      execute: async (args, context: any) => {
        if (context?.retryScope === 'SECTION' || context?.retryScope === 'FUNCTION' || context?.retryScope === 'FIELD') {
          return { success: false, error: 'UNAUTHORIZED_TOOL_USE: Cannot use write_file for partial repair scopes. Use apply_patch instead.', toolName: BUILTIN_TOOL_NAMES.WRITE_FILE, toolArgs: args };
        }
        const rawPath = String(args['path'] ?? '')"""

if target in tr:
    tr = tr.replace(target, replacement)
    with open('packages/core/src/renderer/services/ai/orchestrator/ToolRegistry.ts', 'w', encoding='utf-8') as f:
        f.write(tr)
    print("Success")
else:
    target2 = "      execute: async (args, context) => {\r\n        const rawPath = String(args['path'] ?? '')"
    if target2 in tr:
        tr = tr.replace(target2, replacement.replace('\n', '\r\n'))
        with open('packages/core/src/renderer/services/ai/orchestrator/ToolRegistry.ts', 'w', encoding='utf-8') as f:
            f.write(tr)
        print("Success (CRLF)")
    else:
        print("Not found")
