# AMEVA OS Architecture Specification

## 1. System Overview
AMEVA OS is a serverless local AI & WASM hybrid operating system that executes commands inside a browser sandbox and acts as an MCP server.

## 2. Core Modules

### 2.1 AI Engine Layer
- **`useLocalAIEngine.ts`**: Handles Llama.cpp CLI execution via Electron IPC, streaming tokens, and managing model processes.
- **`useRemoteAIEngine.ts`**: Manages API/Ollama connections for remote/cloud inference.

### 2.2 Store Layer (Zustand)
- **`useAIState.ts`**: Manages global UI settings, current models, and generation status.
- **`useAILogStore.ts`**: Manages sensor logs, chat messages, and transient updates.
  - *Note*: Implements a Ring Buffer pattern for sensor logs to prevent memory leaks.
  - *Note*: Implements a debounced Batch Update for sensor logs to prevent CPU thrashing.
  - *Note*: Utilizes `BroadcastChannel` to synchronize transient logs across local client instances without writing them to the persistent Yjs CRDT model.

### 2.3 Presentation Layer
- **`AIPanel.tsx`**: The main terminal interface. Acts as a layout wrapper and orchestrator for tabs.
- **`AIChatInput.tsx`**: (Presentational + Direct Subscription) Handles prompt input and AI generation triggering. Directly subscribes to `useAI()`.
- **`AIChatList.tsx`**: (Container) Renders the virtualized list of AI messages.
- **`MessageBubble.tsx`**: (Presentational) Renders individual chat messages and parses markdown.
- **`InsertPreviewCard.tsx`**: (Presentational) Renders the inline UI for AI text insertion/modification suggestions.
- **`AppLayout.tsx`**: (Container + Layout) Root presentation container rendering `MenuBar`, `Sidebar`, `MarkdownEditor`, `Minimap`, `AIPanel`, `RightTabStrip`, `StatusBar`, and modals.

### 2.4 Utility Layer
- **`fileConverters.ts`**: Standalone utility module encapsulating base64 conversions, file parsing, and docx/xlsx/hwpx/pdf exporters to keep React hooks lightweight and focused.
- **`analyzeApiKey.ts`**: Centralized API key parser evaluating provided credentials against strict patterns to automatically extract provider endpoints and default models.

### 2.5 IPC Bridge Layer
- **`electronApiAdapter.ts`**: Unifies and wraps all IPC invocations to safe Electron contexts. Restricts renderer code from bypassing this layer to directly access the global window API.
- **`preload.ts` & `index.ts`**: Serves as the security and message mapping boundary between the Electron renderer and native main process.

### 2.6 Main Process & IPC Domain Layer
- **`index.ts` (Coordinator)**: Slim main process entrypoint (~220 lines) responsible for app bootstrap, window creation, and delegating domain registration.
- **`fileIpc.ts`**: Handles native file dialogs, file reads/writes, and directory listing.
- **`mcpIpc.ts`**: Handles Model Context Protocol server spawning, proxying, tool calls, and lifecycle management.
- **`pythonIpc.ts`**: Handles embedded Python environment execution, virtual environments, and package installations.
- **`llmIpc.ts` (Facade)**: Unifies AI engine IPC handlers while delegating implementation to specialized sub-modules:
  - `llm/llmLifecycleIpc.ts`: Engine start, stop, restart, health check, logs, and GPU detection.
  - `llm/llmGenerateIpc.ts`: Token generation, streaming sender, and request abortion.
  - `llm/llmModelIpc.ts`: Local model enumeration, file import, HF downloads, and download cancellation.
  - `llm/sttIpc.ts`: Speech-to-Text audio transcription and temp directory allocation.

### 2.7 Exporters Engine Layer
- **`exportersMain.ts` (Facade)**: Main process coordinator for document exports, preserving 100% import compatibility.
- **`exporters/htmlExporter.ts`**: Handles HTML document packaging and XML serialization.
- **`exporters/officeExporter.ts`**: Handles Word (.docx), Excel (.xlsx), and PowerPoint (.pptx) document generation.
- **`exporters/hwpExporter.ts`**: Handles Korean Hangul (.hwpx) document generation.
- **`exporters/exportersHelper.ts`**: Shared formatting, escaping, and inline content transformation utilities.

### 2.8 Root Application Controller Layer
- **`App.tsx` (Root Coordinator)**: Slim top-level React component (~284 lines) orchestrating global state stores, hooks, and layout rendering.
- **`useAppSettingsManager.ts`**: Manages app settings, localStorage persistence, hotkey normalization, and plugin install/uninstall.
- **`useAppEditorInit.ts`**: Initializes BlockNoteEditor instance with collaborative Y.js provider or standalone local storage.
- **`useAppGlobalApi.ts`**: Registers window-level API bridges (`AMEVA_INSERT_TEXT_TO_EDITOR`, `AMEVA_ASK_AGENT`, etc.).
- **`useAppEditorSync.ts`**: Manages editor change listeners, heading markdown auto-formatting, URL link preview conversion, and auto-snapshot timers.
- **`useAppModeSwitch.ts`**: Manages transitions between editor modes (`edit`, `preview`, `raw`), welcome screen bootstrap, and document rollback.

### 2.9 CSS Design System & Architecture
- **`src/renderer/styles/main.css`**: Central CSS entrypoint aggregating design tokens, base styles, layout grids, editor overrides, and modular component styles.
- **`variables.css`**: Defines global HSL/RGB design tokens, themes (`dark`, `light`, `white`), and z-index layers.
- **`base.css`**: Global resets, typography rules, scrollbars, and utility animations.
- **`layout.css`**: Main layout grid, split panes, titlebar spacers, and resize handle styles.
- **`editor.css`**: BlockNote editor theming, code block styling, and markdown preview overrides.
- **`components/*.css`**: Component-isolated styles (`Sidebar.css`, `AIPanel.css`, `StatusBar.css`, `MenuBar.css`, `Modals.css`).

## 3. Mermaid Architecture Diagram

```mermaid
graph TD
    %% Main Process Layer
    subgraph Main Process [메인 프로세스 계층]
        MainIndex[index.ts<br>(Root Coordinator)]
        MainIndex --> FileIPC[fileIpc.ts]
        MainIndex --> McpIPC[mcpIpc.ts]
        MainIndex --> PythonIPC[pythonIpc.ts]
        MainIndex --> LlmIPC[llmIpc.ts<br>(Facade)]
        MainIndex --> ExportersMain[exportersMain.ts<br>(Facade)]
        
        LlmIPC --> LlmLife[llmLifecycleIpc.ts]
        LlmIPC --> LlmGen[llmGenerateIpc.ts]
        LlmIPC --> LlmMod[llmModelIpc.ts]
        LlmIPC --> SttIpc[sttIpc.ts]
        
        ExportersMain --> HtmlExp[htmlExporter.ts]
        ExportersMain --> OfficeExp[officeExporter.ts]
        ExportersMain --> HwpExp[hwpExporter.ts]
    end

    %% Stores (Zustand)
    subgraph Zustand Stores [상태 관리 계층]
        useAIState[useAIState<br>(상태/설정)]
        useAILogStore[useAILogStore<br>(메시지/스트리밍/센서로그)]
        useWorkspaceStore[useWorkspaceStore<br>(문서/탭/블록)]
        useUIStore[useUIStore<br>(모달/패널/테마)]
    end

    %% Renderer Controllers
    subgraph Renderer Controllers [렌더러 제어 계층]
        AppRoot[App.tsx<br>(Root Coordinator)]
        AppRoot --> AppSettingsMgr[useAppSettingsManager]
        AppRoot --> AppEditorInit[useAppEditorInit]
        AppRoot --> AppGlobalApi[useAppGlobalApi]
        AppRoot --> AppEditorSync[useAppEditorSync]
        AppRoot --> AppModeSwitch[useAppModeSwitch]
    end

    %% UI Components
    subgraph UI Layer [프레젠테이션 계층]
        AppLayout[AppLayout.tsx<br>(Presentation Container)]
        AppRoot --> AppLayout
        AppLayout --> MenuBar[MenuBar.tsx]
        AppLayout --> Sidebar[Sidebar.tsx]
        AppLayout --> MarkdownEditor[MarkdownEditor.tsx]
        AppLayout --> AIPanel[AIPanel.tsx]
        AppLayout --> StatusBar[StatusBar.tsx]
    end

    %% IPC Bridge
    subgraph IPC Bridge [IPC 브릿지 계층]
        Adapter[electronApiAdapter.ts]
    end

    AppLayout --> Adapter
    Adapter <-->|Electron IPC| MainIndex
```
