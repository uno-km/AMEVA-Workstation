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

### 2.4 Utility Layer
- **`fileConverters.ts`**: Standalone utility module encapsulating base64 conversions, file parsing, and docx/xlsx/hwpx/pdf exporters to keep React hooks lightweight and focused.

## 3. Mermaid Architecture Diagram

```mermaid
graph TD
    %% Stores (Zustand)
    subgraph Zustand Stores [상태 관리 계층]
        useAIState[useAIState<br>(상태/설정)]
        useAILogStore[useAILogStore<br>(메시지/스트리밍/센서로그)]
    end

    %% Engine Hooks
    subgraph Engine Layer [AI 엔진 계층]
        useLocalAIEngine[useLocalAIEngine<br>(Llama.cpp 로컬)]
        useRemoteAIEngine[useRemoteAIEngine<br>(API/Ollama 원격)]
    end

    %% Facade
    subgraph Facade Layer [파사드 패턴]
        useAI[useAIAgent / useAI<br>(Orchestrator)]
        useAI --> useAIState
        useAI --> useAILogStore
        useAI --> useLocalAIEngine
        useAI --> useRemoteAIEngine
    end

    %% UI Components
    subgraph UI Layer [프레젠테이션 계층]
        AIPanel[AIPanel.tsx<br>(메인 패널 컨테이너)]
        AIChatInput[AIChatInput.tsx<br>(입력창 컴포넌트)]
        AIChatList[AIChatList.tsx<br>(메시지 목록 컴포넌트)]
        MessageBubble[MessageBubble.tsx<br>(개별 메시지 버블)]
        InsertPreviewCard[InsertPreviewCard.tsx<br>(제안 미리보기 UI)]
    end

    %% Dependencies
    AIPanel --> AIChatInput
    AIPanel --> AIChatList
    AIChatList --> MessageBubble
    MessageBubble --> InsertPreviewCard

    %% Direct Zustand/Facade binding
    AIChatInput -->|직접 구독| useAI
    AIPanel -.->|Props 드릴링 없음| AIChatInput
    AIPanel -.->|Props 드릴링 없음| AIChatList
```
