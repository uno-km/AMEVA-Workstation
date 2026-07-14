const fs = require('fs');
let tr = fs.readFileSync('packages/core/src/renderer/services/ai/orchestrator/ToolRegistry.ts', 'utf8');

// 1. Staging Path Import
tr = tr.replace(/import \{ PathSanitizer, PathSanitizationError \} from '\.\/task-runtime\/policy\/PathSanitizer';/, "import { PathSanitizer, PathSanitizationError } from './task-runtime/policy/PathSanitizer';\nimport { ArtifactTransactionManager } from './task-runtime/artifact/ArtifactTransactionManager';");

// 2. Types Import
tr = tr.replace(/import type \{ ToolDefinition, ToolCallResult \} from '\.\/types'/, "import type { ToolDefinition, ToolCallResult, ToolExecutionContext, ApplyPatchArgs } from './types'");

// 3. Remove 'any'
tr = tr.replace(/context: any/g, 'context?: ToolExecutionContext');
tr = tr.replace(/catch \(e: any\)/g, 'catch (e: unknown)');

// 4. Staging path string replacement
tr = tr.replace(/const stagingPath = `\/missions\/\$\{missionId\}\/staging\/\$\{taskId\}\/\$\{attemptId\}\/\$\{artifactId\}_rev\$\{newRevision\}\.txt`;/, 'const stagingPath = ArtifactTransactionManager.resolveStagingPath(missionId as string, taskId as string, attemptId as string, artifactId as string, newRevision as number);');

// 5. Catch Type error fixes
tr = tr.replace(/if \(e\.message\.includes\('AMBIGUOUS_REPAIR_TARGET'\)\) throw e;/g, "if (e instanceof Error && e.message.includes('AMBIGUOUS_REPAIR_TARGET')) throw e;");
tr = tr.replace(/throw new Error\(`Invalid JSON format after patch: \$\{e\.message\}`\);/g, "throw new Error(`Invalid JSON format after patch: ${e instanceof Error ? e.message : String(e)}`);");

// 6. Fix apply_patch FUNCTION / FIELD
const oldApplyPatch = `          if (retryScope === 'SECTION') {
            if (!targetSection || !patchContent) throw new Error('Both replacement and targetSection are required for SECTION scope.');
            const parts = currentContent.split(targetSection);
            if (parts.length < 2) throw new Error('AMBIGUOUS_REPAIR_TARGET: targetSection not exactly found in the current file.');
            if (parts.length > 2) throw new Error('AMBIGUOUS_REPAIR_TARGET: targetSection found multiple times.');
            newContent = parts[0] + patchContent + parts[1];
          } else if (retryScope === 'FIELD') {
             try {
                const parsed = JSON.parse(currentContent);
                if (targetSection && patchContent) {
                   const parts = currentContent.split(targetSection);
                   if (parts.length === 2) {
                       newContent = parts[0] + patchContent + parts[1];
                       JSON.parse(newContent); 
                   } else {
                       throw new Error('AMBIGUOUS_REPAIR_TARGET: Target field string not uniquely matched.');
                   }
                } else {
                   throw new Error('Target field string and patch required for FIELD scope.');
                }
             } catch (e: unknown) {
                if (e instanceof Error && e.message.includes('AMBIGUOUS_REPAIR_TARGET')) throw e;
                throw new Error(\`Invalid JSON format after patch: \${e instanceof Error ? e.message : String(e)}\`);
             }
          } else if (retryScope === 'FUNCTION') {
             if (!targetSection || !patchContent) throw new Error('Both replacement and targetSection are required for FUNCTION scope.');
             const parts = currentContent.split(targetSection);
             if (parts.length !== 2) throw new Error('AMBIGUOUS_REPAIR_TARGET: targetFunction not uniquely found.');
             newContent = parts[0] + patchContent + parts[1];
          }`;

const newApplyPatch = `          if (retryScope === 'SECTION') {
            if (!targetSection || !patchContent) throw new Error('Both replacement and targetSection are required for SECTION scope.');
            const parts = currentContent.split(targetSection);
            if (parts.length < 2) throw new Error('AMBIGUOUS_REPAIR_TARGET: targetSection not exactly found in the current file.');
            if (parts.length > 2) throw new Error('AMBIGUOUS_REPAIR_TARGET: targetSection found multiple times.');
            newContent = parts[0] + patchContent + parts[1];
          } else if (retryScope === 'FIELD') {
             try {
                const parsed = JSON.parse(currentContent);
                const fieldPath = String(args['targetSelector'] || args['targetSection'] || '');
                if (!fieldPath) throw new Error('targetSelector (field path) required for FIELD scope.');
                
                const keys = fieldPath.split('.');
                let current = parsed;
                for (let i = 0; i < keys.length - 1; i++) {
                    if (current[keys[i]] === undefined) throw new Error(\`Path \${keys[i]} not found in JSON.\`);
                    current = current[keys[i]];
                }
                
                let parsedPatch;
                try {
                    parsedPatch = JSON.parse(patchContent);
                } catch {
                    parsedPatch = patchContent;
                }
                
                current[keys[keys.length - 1]] = parsedPatch;
                newContent = JSON.stringify(parsed, null, 2);
             } catch (e: unknown) {
                if (e instanceof Error && e.message.includes('AMBIGUOUS_REPAIR_TARGET')) throw e;
                throw new Error(\`Invalid JSON format after patch: \${e instanceof Error ? e.message : String(e)}\`);
             }
          } else if (retryScope === 'FUNCTION') {
             throw new Error('WAITING_USER: AST Parser required for safe FUNCTION repair. Not supported in current implementation.');
          }`;

tr = tr.replace(oldApplyPatch, newApplyPatch);
tr = tr.replace(oldApplyPatch.replace(/\n/g, '\r\n'), newApplyPatch.replace(/\n/g, '\r\n'));

// 7. Add TEST scope to write_file block
const oldWriteFile = `      execute: async (args, context?: ToolExecutionContext) => {
        if (context?.retryScope === 'SECTION' || context?.retryScope === 'FUNCTION' || context?.retryScope === 'FIELD') {
          return { success: false, error: 'UNAUTHORIZED_TOOL_USE: Cannot use write_file for partial repair scopes. Use apply_patch instead.', toolName: BUILTIN_TOOL_NAMES.WRITE_FILE, toolArgs: args };
        }
        const rawPath = String(args['path'] ?? '')`;
const newWriteFile = `      execute: async (args, context?: ToolExecutionContext) => {
        if (context?.retryScope === 'SECTION' || context?.retryScope === 'FUNCTION' || context?.retryScope === 'FIELD' || context?.retryScope === 'TEST') {
          return { success: false, error: 'UNAUTHORIZED_TOOL_USE: Cannot use write_file for partial repair scopes. Use apply_patch instead.', toolName: BUILTIN_TOOL_NAMES.WRITE_FILE, toolArgs: args };
        }
        const rawPath = String(args['path'] ?? '')`;

tr = tr.replace(oldWriteFile, newWriteFile);
tr = tr.replace(oldWriteFile.replace(/\n/g, '\r\n'), newWriteFile.replace(/\n/g, '\r\n'));

// And wait, what about write_file execute: async (args, context) if it's not converted to ? ToolExecutionContext yet?
// So let me just use regex for write_file scope block:
tr = tr.replace(/context\?\.retryScope === 'FIELD'\) \{/g, "context?.retryScope === 'FIELD' || context?.retryScope === 'TEST') {");

fs.writeFileSync('packages/core/src/renderer/services/ai/orchestrator/ToolRegistry.ts', tr);
console.log("ToolRegistry rewrite done.");
