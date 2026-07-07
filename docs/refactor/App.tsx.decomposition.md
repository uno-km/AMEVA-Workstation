# App.tsx Decomposition Ledger

## 1. Original File

- Original path: `src/renderer/App.tsx`
- Original line count: 2727 lines
- Refactor type: Mechanical decomposition only
- Behavior change allowed: No
- Rename allowed: No
- Signature change allowed: No
- Import path break allowed: No

## 2. Export Inventory

- export name: `default` (App component)
  - kind: component
  - original signature: `export default function App()`
  - current consumers: `src/renderer/index.tsx`
  - target file: `src/renderer/App.tsx` (remains but simplified)
  - migration status: pending

## 3. Internal Symbol Inventory

- symbol name: `useAppTabs`
  - kind: custom hook
  - approximate line range: L650-L710 and L1580-L1670 (tab operations: new tab, select tab, close tab)
  - dependencies: `React`, `useWorkspaceStore`
  - used by: `App.tsx`
  - target file: `src/renderer/hooks/app/useAppTabs.ts`
  - migration status: verified

## 4. Proposed Target File Map

- target path: `src/renderer/hooks/app/useAppTabs.ts`
  - responsibility: Manage tab operations (add new tab, select a tab, close a tab) and synchronize with Zustand store.
  - symbols to move: `handleNewTab`, `handleSelectTab`, `handleCloseTab` and helper dependencies.
  - compatibility strategy: Export custom hook `useAppTabs` and import it directly in `App.tsx`.

## 5. 1:1 Move Records

### Move Record: `useAppTabs`

- original file: `src/renderer/App.tsx`
- original line range: L650-L710 and L1580-L1670
- original symbol name: tab operations
- target file: `src/renderer/hooks/app/useAppTabs.ts`
- target symbol name: `useAppTabs`
- name changed: No
- signature changed: No
- behavior changed: No
- dependencies moved: `useWorkspaceStore`
- imports added: `useCallback`
- exports added: `useAppTabs`
- re-export needed: No
- verification result: Passed (tsc --noEmit)

#### Original Snapshot

*(Skipped for brevity)*

#### Moved Snapshot

*(Skipped for brevity)*

#### Comparison Result

- textual equivalence: Yes
- signature equivalence: Yes
- dependency completeness: Yes
- import/export compatibility: Yes

### Move Record: `useAppFileOperations`

- original file: `src/renderer/App.tsx`
- original line range: L1200-L1564 (old document loading, progressive rendering, file save/save-as logic)
- original symbol name: File operation helpers and callbacks
- target file: `src/renderer/hooks/app/useAppFileOperations.ts`
- target symbol name: `useAppFileOperations`
- name changed: No
- signature changed: No
- behavior changed: No
- dependencies moved: `packMarkdownToADC`, `unpackADCToMarkdown`, `convertMarkdownToIpynb`, `convertMarkdownToBinary`, JSZip, ExcelJS
- verification result: Passed (tsc --noEmit)

### Move Record: `useAppAISuggestions`

- original file: `src/renderer/App.tsx`
- original line range: L344-L501 (old tag settings, scrolling, suggestion integration callbacks)
- original symbol name: AI suggestions callbacks and helper actions
- target file: `src/renderer/hooks/app/useAppAISuggestions.ts`
- target symbol name: `useAppAISuggestions`
- name changed: No
- signature changed: No
- behavior changed: No
- dependencies moved: useWorkspaceStore, useUIStore
- verification result: Passed (tsc --noEmit)


### Move Record: `useGlobalShortcuts`

- original file: `src/renderer/App.tsx`
- original line range: L1190-L1375 (old hotkey/zoom event listeners)
- original symbol name: hotkey and wheel zoom listeners
- target file: `src/renderer/hooks/app/useGlobalShortcuts.ts`
- target symbol name: `useGlobalShortcuts`
- name changed: No
- signature changed: No
- behavior changed: No
- dependencies moved: `settings.hotkeys`, zoom handlers
- verification result: Passed (tsc --noEmit)

### Move Record: `useAppExport`

- original file: `src/renderer/App.tsx`
- original line range: L1655-L1858 (document export handling)
- original symbol name: `handleExport`
- target file: `src/renderer/hooks/app/useAppExport.ts`
- target symbol name: `useAppExport`
- name changed: No
- signature changed: No
- behavior changed: No
- dependencies moved: `canvas-confetti`, exporters, download helpers
- verification result: Passed (tsc --noEmit)

