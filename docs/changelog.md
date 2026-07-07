# AMEVA OS Changelog

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
