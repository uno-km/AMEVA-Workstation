# index.ts Decomposition Ledger

## 1. Original File

- Original path: `src/main/index.ts`
- Original line count: 2423 lines
- Refactor type: Mechanical decomposition only
- Behavior change allowed: No
- Rename allowed: No
- Signature change allowed: No
- Import path break allowed: No

## 2. Export Inventory

- export name: None (Self-contained Electron main script)
  - kind: script
  - migration status: pending

## 3. Internal Symbol Inventory

- symbol name: `MCPProcessManager`
  - kind: class
  - approximate line range: L2056-L2200
  - dependencies: `child_process`, `fs`, `path`
  - target file: `src/main/services/mcpProcessManager.ts`
  - migration status: pending

- symbol name: `startLlamaServerWithFallback` / `findLlamaCli` / `forceCleanupLocalLLMProcesses`
  - kind: helper functions and LLM state
  - approximate line range: L600-L800
  - dependencies: `child_process`, `fs`, `path`, `net`
  - target file: `src/main/services/llmProcessManager.ts`
  - migration status: pending

- symbol name: Collaboration WebSocket Server handlers
  - kind: helper functions and WebSocket server lifecycle
  - approximate line range: L390-L500
  - dependencies: `ws`, `http`
  - target file: `src/main/services/collabServer.ts`
  - migration status: pending

## 4. Proposed Target File Map

- target path: `src/main/services/mcpProcessManager.ts`
  - responsibility: Manage life cycle and communication with MCP server child processes.
- target path: `src/main/services/llmProcessManager.ts`
  - responsibility: Manage searching, spawning, and fallbacks for local `llama-server` process.
- target path: `src/main/services/collabServer.ts`
  - responsibility: Run local Yjs-compatible WebSocket server for document collaboration.

## 5. 1:1 Move Records

### Move Record: `MCPProcessManager`

- original file: `src/main/index.ts`
- target file: `src/main/services/mcpProcessManager.ts`
- target symbol name: `MCPProcessManager`
- name changed: No
- signature changed: No
- behavior changed: No
- verification result: pending
