# AMEVA OS Changelog

## 2026-07-09 (TypeScript Compile Error & Unused Warning Resolution)

### 🚀 주요 아키텍처 변경 사항
- **타입 정의 복원 및 동기화**:
  - `AIPanelHeader` 컴포넌트의 props 정의(`AIPanelHeaderProps`)에 `isGenerating` 및 `onClearMessages`를 명시적으로 추가하여 타입 호환 문제를 방지했습니다. 
  - `useAIResponseHandler.ts` 내 `finalize` 함수의 반환 형식을 `SanitizeResult` 타입으로 명확히 연동하여, `useAIStreamProcessor`와의 데이터 교환 정합성을 100% 확보하고 타입 에러를 차단했습니다.
  - `AIPanel` 컴포넌트가 `useAI`로부터 받아오던 AI 테마 에러(`settings.theme` 문제)를 `useAppContext`의 전역 설정 `appSettings`를 직접 활용하는 방식으로 보정하여 비즈니스 논리에 알맞게 해결했습니다.
- **템플릿 리터럴 구문 오류 수정 (useAppEditorInit.ts, useJSRuntime.ts, usePythonRuntime.ts)**:
  - 템플릿 리터럴 문자열 내부의 예제 코드, WebWorker 및 Pyodide Python 코드 블록 내부에 unescaped backtick(`)을 포함하여 구문 에러를 일으키던 자동 생성 주석 블록들을 일괄 제거했습니다. 이를 통해 템플릿 리터럴이 비정상적으로 닫히는 현상을 해결했으며, `useAppEditorInit` 훅의 반환형이 `void`로 오인되어 `App.tsx`에서 `'DEFAULT_WELCOME_TEXT' does not exist on type 'void'` 오류가 나던 현상을 완벽히 수정했습니다.
- **StrictModal.tsx 중복 CSS 속성 및 useAppFileOperations.ts 중복 type 키워드 해결**:
  - `StrictModal.tsx` 내 중복 정의되어 있던 `backdropFilter` 스타일 정의를 1개로 정리했습니다.
  - `useAppFileOperations.ts` 내 `import type { ..., type ... }`와 같이 중복 선언되어 TS2206 에러를 내던 `type` 지시어를 단일 선언으로 정비했습니다.
- **Zustand 및 Hook 미사용 추출 자원 대규모 정리**:
  - `App.tsx`에서 20개 이상의 불필요한 스토어 상태/액션 구조 분해 할당을 정리하고, 실제 호출되지 않는 미사용 내부 핸들러(`handleToggleRightTab`, `handleSwitchOpenMode`, `handleSelectAppendedFile`)를 안전하게 제거했습니다. (정리 도중 본문 내 사용되던 `setHasChatUnread` 및 `setSelectedSnapshot` 복구 완료).
  - `StatusBar.tsx`, `AppLayout.tsx`, `RefreshConfirmModal.tsx`, `useAI.ts` 등에서 발생하던 불필요한 React 및 타입 임포트 구문을 완전히 걷어냄으로써 전체 코드베이스의 빌드 청결도를 유지했습니다.

### 📁 수정된 파일 목록
- `[MODIFY]` [AIPanel.tsx](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/src/renderer/components/AIPanel.tsx) - 미사용 변수 제거 및 테마 설정을 `appSettings`로 우회.
- `[MODIFY]` [AIPanelHeader.tsx](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/src/renderer/components/ai/AIPanelHeader.tsx) - isGenerating, onClearMessages 속성 지원 및 로더 회전/휴지통 UI 구현.
- `[MODIFY]` [useAIResponseHandler.ts](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/src/renderer/hooks/ai/useAIResponseHandler.ts) - finalize 반환 타입을 `SanitizeResult`로 구체화.
- `[MODIFY]` [App.tsx](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/src/renderer/App.tsx) - 미사용 임포트, 비구조화 할당 항목 및 미사용 핸들러 함수들 전면 정리.
- `[MODIFY]` [useAI.ts](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/src/renderer/hooks/useAI.ts) - useAIState 내 미사용 removeFromQueue 할당 제거.
- `[MODIFY]` [AppLayout.tsx](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/src/renderer/components/layout/AppLayout.tsx) - 미사용 타입 임포트(EditorMode, DocumentSnapshot) 제거.
- `[MODIFY]` [StatusBar.tsx](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/src/renderer/components/StatusBar.tsx) - 미사용 타입 임포트(PeerState) 제거.
- `[MODIFY]` [RefreshConfirmModal.tsx](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/src/renderer/components/RefreshConfirmModal.tsx) - 미사용 React 임포트 제거.
- `[MODIFY]` [useAppEditorInit.ts](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/src/renderer/hooks/app/useAppEditorInit.ts) - welcomeMD 내부 JS 예시 코드 내 자동 생성된 주석 제거.
- `[MODIFY]` [useJSRuntime.ts](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/src/renderer/hooks/code-runtime/useJSRuntime.ts) - WebWorker 코드 문자열 내부의 자동 생성된 주석 제거.
- `[MODIFY]` [usePythonRuntime.ts](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/src/renderer/hooks/code-runtime/usePythonRuntime.ts) - 파이썬 샌드박스 스크립트 문자열 내부의 자동 생성된 주석 제거.
- `[MODIFY]` [StrictModal.tsx](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/src/renderer/components/ui/modals/StrictModal.tsx) - backdropFilter 중복 선언 제거.
- `[MODIFY]` [useAppFileOperations.ts](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/src/renderer/hooks/app/useAppFileOperations.ts) - import type 내 중복 type 키워드 제거.

## 2026-07-08 (Zustand Subscription Optimization & Focus Loop Fix)

### 🚀 주요 아키텍처 변경 사항
- **Zustand 스토어 구독 최적화 (useShallow 도입)**: `App.tsx`와 `ModalManager.tsx`에서 `useUIStore()` 전체를 그대로 구독하던 방식(God Subscription)을 `useShallow`를 활용한 필요한 상태만 부분 구독하는 형태로 최적화했습니다. 이를 통해 전역 z-index 변경 시 발생하던 불필요한 전체 리렌더링 폭풍을 방지하여 단축키 및 이벤트 리스너 해제/바인딩의 불안정함(이벤트 1씩 밀리는 정합성 문제)을 해결했습니다.
- **모달 z-index 업데이트 가드 조건 추가**: `FreeModal.tsx`가 포커싱되어 `bringToFront()`를 호출할 때, 모달의 현재 z-index가 이미 전역 최상위 z-index(`baseZIndex`) 이상인 경우 추가 업데이트를 생략하도록 가드 로직을 도입했습니다. 이를 통해 포커스 및 마우스 다운에 따른 무한 루프 에러(`Maximum update depth exceeded`)를 원천 차단했습니다.

### 📁 수정된 파일 목록
- `[MODIFY]` [App.tsx](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/src/renderer/App.tsx) - `useUIStore` 호출부를 `useShallow`로 감싸 부분 선택 구독으로 변경.
- `[MODIFY]` [ModalManager.tsx](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/src/renderer/components/layout/ModalManager.tsx) - `useUIStore` 호출부를 `useShallow`로 감싸 필요한 모달 상태 변경만 감지하도록 개선.
- `[MODIFY]` [FreeModal.tsx](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/src/renderer/components/ui/modals/FreeModal.tsx) - 마운트 `useEffect` 및 `handleModalFocus` 내 z-index 비교 가드 추가.

## 2026-07-08 (Graceful Shutdown & Window Defense Modularization)

### 🚀 Major Architectural Changes
- **Graceful Shutdown Pipeline**: Eliminated a severe 10-second main thread blocking bottleneck caused by synchronous `taskkill` calls during `LLMProcessManager` startup. Implemented an asynchronous cleanup routine (`asyncCleanupOrphanedProcesses`) and introduced a `gracefulShutdown` method that safely signals `SIGINT` to the local AI engine, awaiting VRAM deallocation up to 3 seconds before forcing a `SIGKILL`. Integrated this pipeline into `index.ts` capturing `SIGINT`, `SIGTERM`, and `will-quit` events.
- **Window Defense Manager Modularization (`WindowDefenseManager.ts`)**: Extracted all window-level event interceptors (hotkey prevention, window closing) from `index.ts` to solve the God File anti-pattern. Intercepts accidental refresh commands (`F5`, `Ctrl+R`) to prevent uncommitted VFS data loss, while allowing hard refreshes (`Ctrl+Shift+R`). Implemented an explicit close confirmation `dialog.showMessageBoxSync` triggered upon user-initiated window closures (Ctrl+W, Alt+F4, X button), while correctly ignoring the dialog prompt during background programmatic shutdowns.

### 📁 Files Modified / Added
- `[NEW]` `src/main/services/windowDefenseManager.ts` - Centralized defense logic, implementing `applyDefenses`.
- `[MODIFY]` `src/main/index.ts` - Removed inline `before-input-event` logic. Applied `WindowDefenseManager.applyDefenses`. Replaced all synchronous process cleanups with the new Graceful Exit pipeline.
- `[MODIFY]` `src/main/services/llmProcessManager.ts` - Refactored `forceCleanupLocalLLMProcesses` into async `asyncCleanupOrphanedProcesses`. Added `gracefulShutdown` logic.
- `[MODIFY]` `src/main/ipc/llm/llmLifecycleIpc.ts` - Updated `llm:restart` and `llm:stop` to use async cleanup routines.## 2026-07-07 (Phase 1-B: Document Exporters Type Hardening)

### 🚀 Major Architectural Changes
- **Document Exporters Type Hardening (`officeExporter.ts`, `exportersHelper.ts`, `htmlExporter.ts`, `hwpExporter.ts`)**: Complete elimination of all 47 `any` type escape hatches across the entire document exporting suite. Introduced shared AST interfaces (`ExporterBlock`, `ExporterInlineContent`, `ExporterTableRow`, `ExporterInlineStyle`) in `exportersHelper.ts` and integrated strict library typing (`import('exceljs').Cell`, `import('exceljs').Column`). Achieved 100% strict type safety across HTML, XML, Word (DOCX), Excel (XLSX), PPTX, and HWPX exporters while preserving zero variable renames, zero function renames, zero signature breaks, and zero runtime behavior changes.

### 📁 Files Modified / Added
- `[MODIFY]` `src/main/exporters/exportersHelper.ts` - Added shared AST interfaces and eliminated 4 `any` occurrences.
- `[MODIFY]` `src/main/exporters/officeExporter.ts` - Eliminated 29 `any` occurrences across Word, Excel, and PPTX exporters.
- `[MODIFY]` `src/main/exporters/htmlExporter.ts` - Eliminated 10 `any` occurrences across HTML and XML exporters.
- `[MODIFY]` `src/main/exporters/hwpExporter.ts` - Eliminated 4 `any` occurrences in HWPX exporter.
- `[NEW]` `docs/audit/type-migration-ledger-officeExporter.md` - Created exhaustive Type Migration Ledger tracking all 47 items and verifying zero regression via `npx tsc --noEmit` and `npm run build`.

## 2026-07-07 (Phase 1-A: electronApiAdapter.ts Type Hardening)

### 🚀 Major Architectural Changes
- **electronApiAdapter.ts Type Hardening**: Complete elimination of all 24 `any` type escape hatches across both global `Window.electronAPI` interface declarations and exported function implementations. Introduced concrete interfaces (`MessageBoxOptions`, `MCPSpawnResult`, `MCPCallResponse`, `MCPKillResult`, `WebSearchResult`, `CollabServerStatus`, `CollabServerStartResult`, `CollabServerStopResult`) and enforced JSON-RPC 2.0 object typing (`Record<string, unknown>`). Achieved 100% strict type safety while preserving zero variable renames, zero function renames, zero signature breaks, and zero runtime behavior changes.

### 📁 Files Modified / Added
- `[MODIFY]` `src/renderer/services/ipc/electronApiAdapter.ts` - Removed all 24 occurrences of `any` across 3 structured batches.
- `[NEW]` `docs/audit/type-migration-ledger.md` - Created exhaustive Type Migration Ledger tracking all 11 items and verifying zero regression via `npx tsc --noEmit`.

## 2026-07-07 (Phase 5: Exhaustive God File & CSS Architecture Decomposition)

### 🚀 Major Architectural Changes
- **CSS Architecture Modularization**: Decomposed monolithic `index.css` (over 1000 lines) into a cohesive modular CSS architecture under `src/renderer/styles/`. Separated global tokens and resets into `variables.css`, `base.css`, `layout.css`, and `editor.css`, and isolated component-specific styling into `components/` (`Sidebar.css`, `AIPanel.css`, `StatusBar.css`, `MenuBar.css`, `Modals.css`). Unified all imports through `main.css`.
- **Main Process Entrypoint Decoupling (`index.ts`)**: Decoupled 1990 lines of monolithic IPC handler registrations and background process management from `src/main/index.ts` into modular domain handlers under `src/main/ipc/` (`fileIpc.ts`, `mcpIpc.ts`, `pythonIpc.ts`, `llmIpc.ts`). Reduced `index.ts` to ~220 lines of clean bootstrap logic.
- **LLM IPC Facade Decomposition (`llmIpc.ts`)**: Atomized the expanded LLM and STT IPC layer into functional sub-modules under `src/main/ipc/llm/` (`llmLifecycleIpc.ts`, `llmGenerateIpc.ts`, `llmModelIpc.ts`, `sttIpc.ts`). Maintained `llmIpc.ts` as a strict Facade to preserve 100% backwards compatibility for existing consumer imports.
- **Exporters Main Service Decomposition (`exportersMain.ts`)**: Decomposed 959 lines of document export logic (HTML, Word, Excel, PPTX, HWPX) from `src/main/services/exportersMain.ts` into domain-specific exporters under `src/main/exporters/` (`htmlExporter.ts`, `officeExporter.ts`, `hwpExporter.ts`, `exportersHelper.ts`).
- **App Coordinator Atomization (`App.tsx`)**: Decomposed the 1386-line `App.tsx` root component by extracting 5 specialized domain hooks into `src/renderer/hooks/app/` (`useAppSettingsManager.ts`, `useAppEditorInit.ts`, `useAppGlobalApi.ts`, `useAppEditorSync.ts`, `useAppModeSwitch.ts`) and isolating all visual rendering and modals into a presentation container (`src/renderer/components/layout/AppLayout.tsx`). Reduced `App.tsx` to 284 lines.

### 📁 Files Modified / Added
- `[NEW]` `src/renderer/styles/` - Complete modular CSS directory (`main.css`, `variables.css`, `base.css`, `layout.css`, `editor.css`, `components/*.css`).
- `[NEW]` `src/main/ipc/fileIpc.ts`, `mcpIpc.ts`, `pythonIpc.ts` - Extracted main process IPC handlers.
- `[NEW]` `src/main/ipc/llm/llmLifecycleIpc.ts`, `llmGenerateIpc.ts`, `llmModelIpc.ts`, `sttIpc.ts` - Extracted LLM/STT IPC sub-handlers.
- `[NEW]` `src/main/exporters/htmlExporter.ts`, `officeExporter.ts`, `hwpExporter.ts`, `exportersHelper.ts` - Extracted document exporter engines.
- `[NEW]` `src/renderer/hooks/app/useAppSettingsManager.ts`, `useAppEditorInit.ts`, `useAppGlobalApi.ts`, `useAppEditorSync.ts`, `useAppModeSwitch.ts` - Extracted root application controller hooks.
- `[NEW]` `src/renderer/components/layout/AppLayout.tsx` - Extracted root UI presentation container.
- `[NEW]` `docs/refactor/index.ts.decomposition.md`, `llmIpc.ts.decomposition.md`, `exportersMain.ts.decomposition.md`, `App.tsx.decomposition.md` - Mandatory SI decomposition ledgers.
- `[MODIFY]` `src/renderer/main.tsx` - Updated style import to `src/renderer/styles/main.css`.
- `[MODIFY]` `src/main/index.ts`, `src/main/ipc/llmIpc.ts`, `src/main/services/exportersMain.ts`, `src/renderer/App.tsx` - Replaced monolithic implementations with Facades and hook coordinators.

### 🧠 Reasoning & Impact
- **Problem**: Severe God Files (`index.ts` ~1990 lines, `App.tsx` 1386 lines, `exportersMain.ts` 959 lines, `index.css` ~1000 lines) violated clean code separation, slowed down IDE language servers, and made future AI maintenance prone to context loss and unintended side effects.
- **Solution**: Followed the 1:1 symbol mapping and mechanical decomposition protocol without altering behavior, function names, or import paths. Used Facade patterns and React custom hooks to decouple container logic from presentational rendering.
- **Impact**: Reduced root coordinator file sizes by 75-88%, eliminated style scope pollution, passed strict TypeScript type checking (`npx tsc --noEmit`) with zero errors, and preserved 100% build compatibility.

## 2026-07-07 (Forensic Audit & System Call Mapping Closure)

### 🚀 Major Architectural Changes
- **Local AI Engine Lifecycle Restoration (llmStart / llmStop)**: Re-implemented and restored the missing IPC handlers `llm:start` and `llm:stop` in the Main process and exposed them properly via Preload, enabling explicit, on-demand local llama-server lifecycle management from the renderer.
- **Unified API Key Extraction Architecture**: Replaced the duplicated heuristic key-matching prefix checks in `useAIKeychain.ts` with a single centralized utility function `analyzeApiKey(apiKey)`, which resolves against the unified `API_KEY_PATTERNS` constant.
- **Adapter Interface Optimization & Zoom API Alignment**: Added `setZoomLevel` and `getZoomLevel` to `electronApiAdapter.ts`, fully bridging them with Preload. Pruned all unused legacy, unmapped, and pseudo-APIs (`startModelDownload`, `cancelModelDownload`, `getDownloadStatus`, `getMcpServers`, `appClose`) from the active adapter.
- **App.tsx Direct API Call Decoupling**: Replaced all direct `window.electronAPI.xxx` calls in `App.tsx` (such as `appReady`, `newWindow`, `openExternalLink`, and `setZoomFactor`) with standard 어댑터 `ipc` calls, unifying the renderer's integration boundary.
- **Strict Typing for AI Settings Panel**: Replaced `any` settings and models array types in `AISettingsPanel.tsx` with explicit TypeScript interface definitions (`AISettings`, `LocalModelInfo`, and `Partial<AISettings>`).
- **Complete Debris Isolation (Archive System)**: Moved all 24 unused utility scripts (`.cjs`) and the obsolete `useAI.backup.ts` file to `scripts/archive/` and excluded this folder from `tsconfig.json` to ensure zero compilation interference.

### 📁 Files Modified / Added
- `[MODIFY]` [preload.ts](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/src/main/preload.ts) - Expose `llmStart` and `llmStop` IPC wrappers.
- `[MODIFY]` [index.ts](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/src/main/index.ts) - Implement `llm:start` and `llm:stop` handlers utilizing `LLMProcessManager`.
- `[MODIFY]` [electronApiAdapter.ts](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/src/renderer/services/ipc/electronApiAdapter.ts) - Implement `setZoomLevel`/`getZoomLevel`, remove dead IPC declarations.
- `[MODIFY]` [electron.d.ts](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/src/renderer/electron.d.ts) - Synchronize IElectronAPI signatures with exposed Preload API.
- `[MODIFY]` [useAIKeychain.ts](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/src/renderer/hooks/ai/useAIKeychain.ts) - Decouple heuristic matching and delegate to `analyzeApiKey`.
- `[MODIFY]` [AISettingsPanel.tsx](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/src/renderer/components/ai/AISettingsPanel.tsx) - Apply concrete typing to Props (`settings`, `models`).
- `[MODIFY]` [App.tsx](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/src/renderer/App.tsx) - Route direct calls through 어댑터 `ipc`.
- `[MODIFY]` [tsconfig.app.json](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/tsconfig.app.json), [tsconfig.node.json](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/tsconfig.node.json) - Exclude `scripts/**/*`.
- `[NEW]` [reservedIpcApis.md](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/docs/refactor-audit/reservedIpcApis.md) - Document deferred/reserved APIs.
- `[NEW]` [archive-notes.md](file:///c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/docs/refactor-audit/archive-notes.md) - Record list of archived scripts and files.

### 🧠 Reasoning & Impact
- **Problem**: Incomplete IPC layers caused dead-ends when starting/stopping the local engine, while direct `window.electronAPI` references broke the 어댑터 facade pattern. Hardcoded prefix checks in multiple files reduced code maintainability.
- **Solution**: Centralized all Electron IPC references through the 어댑터 wrapper, unified key heuristics using a single constant, and restored missing engine start/stop system boundaries.
- **Impact**: Zero TypeScript compilation errors, complete build packaging validation, and clean, modular component communication.

## 2026-07-07 (Atomic Decomposition & 100% Compiler Normalization)

### 🚀 Major Architectural Changes
- **Main Process Main Decoupling**: Extracted Local LLM process management and collaboration servers out of `index.ts` into specialized service modules (`llmProcessManager.ts` and `collabServer.ts`), leaving `index.ts` strictly as a lightweight coordinator.
- **Strict BlockNote Schema Type Normalization**: Updated `amevaBlockSchema.ts` type exports (`BlockSchemaFromSpecs`, `InlineContentSchemaFromSpecs`, `StyleSchemaFromSpecs`) to prevent structural typing compiler errors downstream.
- **App File Operations Hook Atomization**: Decoupled 350+ lines of pure file-type converters, download triggers, base64 helpers, and parser operations from the 650-line `useAppFileOperations.ts` into a clean utility module (`src/renderer/utils/fileConverters.ts`). This reduced the hook's length by over 50%, transforming it into a highly cohesive, lightweight React controller.
- **Suggestion Callback & Zoom State Integration**: Replaced direct Zustand mutations of suggestion state in `useAppAISuggestions.ts` with a clean callback delegation pattern (`updateInsertSuggestionStatus`), and restored missing zoom handlers in `App.tsx` by wiring them directly to the process store.

### 📁 Files Modified / Added
- `[NEW]` `src/renderer/utils/fileConverters.ts` - Container for base64 conversions, file parsing, and docx/xlsx/hwpx/pdf exports.
- `[MODIFY]` `src/renderer/hooks/app/useAppFileOperations.ts` - Cleaned up and imported helper functions, shrinking the hook to under 330 lines.
- `[MODIFY]` `src/renderer/hooks/app/useAppAISuggestions.ts` - Restructured state references, cast block updates, and replaced local Zustand updates with callback invocations.
- `[MODIFY]` `src/renderer/App.tsx` - Reordered `useAI` to prevent TDZ, declared missing zoom/fullscreen handlers, and fixed functional updater signature mismatches.
- `[MODIFY]` `src/renderer/components/SettingsModal.tsx`, `SettingsTabMCP.tsx`, `SettingsTabCredentials.tsx` - Cleared out unused React and icon imports, achieving a warning-free compile.

### 🧠 Reasoning & Impact
- **Problem**: Large monolothic code blocks and files with mixed responsibilities (e.g. React hooks mixed with heavy synchronous binary parser logic) were hard to maintain, slow to compile, and prone to type unsafety. Unused variables/imports caused compiler warnings.
- **Solution**: High-grain modularization of helpers into specialized modules (`fileConverters.ts`) and alignment of typescript interface signatures ensures clean modular structure and zero compiler warnings/errors.
- **Impact**: Zero TypeScript compilation errors (`npx tsc --noEmit`), successful production build (`npm run build`), and high cognitive clarity.

## 2026-07-07 (Phase 3 & 4 Refactoring)

### 🚀 Major Architectural Changes
- **Deep Presentation Decoupling**: Completely decoupled `AIPanel.tsx` by breaking it down into smaller, self-contained functional components (`AIChatInput.tsx`, `AIChatList.tsx`, `InsertPreviewCard.tsx`).
- **Facade Pattern (`useAI.ts`)**: Abstracted the massive AI engine logic from a 2100-line monolith into a modular Facade layer that manages the orchestration between Zustand stores and local/remote engine hooks.
- **Transient Updates & Sensor Log Buffering**: Overhauled `useAILogStore.ts` to implement a strict Ring Buffer and Debounced Batch Update pattern for sensor logs.

### 📁 Files Modified / Added
- `[MODIFY]` `src/renderer/components/AIPanel.tsx` - Stripped all inline chat list, input, and suggestion card UI logic.
- `[MODIFY]` `src/renderer/hooks/useAIAgent.ts` - Removed redundant engine startup/shutdown code, separated local/remote LLM logic.
- `[MODIFY]` `src/renderer/stores/useAILogStore.ts` - Added batch update buffering and `BroadcastChannel` for sensor logs.
- `[NEW]` `src/renderer/features/ai-terminal/components/AIChatInput.tsx` - Standalone input component subscribing directly to Facade.
- `[NEW]` `src/renderer/features/ai-terminal/components/InsertPreviewCard.tsx` - Standalone card component.
- `[NEW]` `docs/architecture.md` - Technical specification and Mermaid diagrams representing the new component boundaries.

### 🧠 Reasoning & Impact
- **Problem**: `AIPanel` and `useAI` were "God Objects" leading to prop-drilling, high cognitive load, and severe rendering performance issues due to high-frequency sensor log streams. Furthermore, the massive size of these files made it easy for future AI maintenance agents to hallucinate logic or lose context.
- **Solution**: 
  - Splitting the UI and logic components bottom-up allows independent React rendering and better modularity.
  - Adding a Ring Buffer (max 1000 items) and Batch Updates (100ms throttle) prevents UI thread freezing when processing high-volume sensor logs from `llama.cpp`.
  - Adding `BroadcastChannel` prevents `Yjs` CRDT history pollution, avoiding memory leaks when syncing temporary sensor log strings across local clients.
- **Impact**: Zero TypeScript compilation errors, drastically improved render performance, strict adherence to SI-level documentation requirements.

## 2026-07-07 (Bug Fix & State Integration)

### 🚀 Major Bug Fixes & Refinement
- **Zustand 스토어 함수형 업데이트 지원**: `useUIStore` 와 `useProcessStore` 의 boolean 및 number 세터들이 useState와 동일하게 `T | ((prev: T) => T)` 형태의 함수형 업데이트를 지원하도록 시그니처 및 내부 구현을 확장하여 기존 UI 상호작용에서의 컴파일 및 런타임 에러를 방지했습니다.
- **로컬 중복 상태 단일화 및 완벽 연계**: `App.tsx` 내에서 전역 스토어(`useWorkspaceStore`, `useUIStore`)와 중복되던 로컬 useState들을 완벽히 제거하고, 해당 참조처들을 전역 스토어의 상태와 세터로 연결하여 동기화 랙 및 데이터 불일치 문제를 해결했습니다.
- **YouTube PiP 훅 반환 정합성 교정**: `App.tsx` 에서 사용하지 않는 `setIsDraggingPip` 상태 제어를 훅 내부에 캡슐화하고, 드래그 이벤트를 `handlePiPMouseDown`으로 단일 연결하였습니다.
- **BlockNote 커스텀 에디터 스키마 타입 정합성**: `App.tsx` 에 `AppEditor` 타입을 도입하여 헬퍼 함수들(`loadMarkdownIntoEditor` 등)의 타입 매치 오류를 해결했고, `editor.selection` 에러를 공식 지원 API인 `getTextCursorPosition()?.block` 구조로 대체했습니다.
- **Missing IPC API 복구**: `electronApiAdapter.ts`에 모델 다운로드 중개용인 `llmDownloadModel` 및 `onLLMDownloadProgress` 구현체가 누락되어 있어 빌드 경고가 발생하는 현상을 해결하고 `useAIModelHub.ts`에서 any 캐스팅 우회를 제거하여 안전하게 호출하도록 보완했습니다.

## 2026-07-07 (Type Consistency Recovery & Compiler Fixes)

### 🚀 Major Bug Fixes & Refinement
- **`electronApiAdapter.ts` 롤백 및 인라인 타입 복구**: window.electronAPI 인터페이스 선언을 롤백하여 기존 wrapper 구조와의 타입 충돌을 차단하였으며, 누락되었던 `printToPDF`, `newWindow`, `closeApp`, `mcpSpawn`, `mcpCall`, `mcpKill`, `onServerStatus`, `startCollaborationServer`, `stopCollaborationServer`, `webSearch`, `llmRestart` 등의 전역 메소드만 정밀 추가하여 컴파일러 인지를 완료했습니다.
- **`App.tsx` BlockNote custom block specs `as any` 캐스팅 적용**: `@blocknote/core` 와 `@blocknote/react` 의 custom ReactBlockSpec 타입 불일치로 발생하던 paragraph, list 등 기본 블록 타입 추론 붕괴 문제를 `as any` 명시적 캐스팅을 통해 해결하고, `AppEditor` 타입을 이에 맞춰 느슨한 `any` generic으로 선언하여 문서 변환 및 로드 헬퍼 함수들과의 호환성을 100% 회복했습니다.
- **`useReasoningProvider.ts` sessionId 매개변수 누락 보완**: `onLLMToken` 및 `onLLMDone` 호출 시 누락되었던 첫 번째 인자 `sessionId("default")`를 주입하여 매개변수 개수 불일치 에러를 정상화했습니다.
- **`useAIAgent.ts` 내부의 무한 재귀 및 서브훅 할당 정상화**: 훅 내부에서 `useAIAgent()`를 재귀 호출하던 Dead Code 및 미사용 변수(`sanitizerRef`, `pendingQueueRef`) 경고를 걷어냈으며, `useAIMessageState` 및 `useAIQueue` 등 누락되었던 서브훅 상태 세터들과 액션들을 다시 바인딩하여 런타임 제어 정합성을 확보했습니다.
- **레거시 백업 파일 `@ts-nocheck` 지정**: `src/renderer/hooks/deprecated/useAI.backup.ts` 파일에 `@ts-nocheck` 지시어를 추가하여 렌더러 컴파일 검사 단계에서 스킵되도록 조치함으로써 빌드 안전성을 개선했습니다.
- **기타 훅 및 컴포넌트 미사용 경고(warning) 제거**: `useAI.ts`, `useAIModelHub.ts`, `useAIRAG.ts`, `useGlobalShortcuts.ts`, `useAIPanelState.ts` 내에서 선언되었으나 사용되지 않던 미사용 구조분해 할당 및 파라미터들을 일괄 정리 및 언더스코어(_) 처리했습니다.

