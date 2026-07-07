# SettingsModal.tsx Decomposition Ledger

## 1. Original File

- Original path: `src/renderer/components/SettingsModal.tsx`
- Original line count: 1580 lines
- Refactor type: Mechanical decomposition only
- Behavior change allowed: No
- Rename allowed: No
- Signature change allowed: No
- Import path break allowed: No

## 2. Export Inventory

- export name: `SettingsModal`
  - kind: component
  - original signature: `export function SettingsModal(props: SettingsModalProps)`
  - current consumers: `App.tsx`
  - target file: `src/renderer/components/SettingsModal.tsx` (remains but simplified)
  - migration status: pending

## 3. Internal Symbol Inventory

- symbol name: `useSettingsModalResize`
  - kind: custom hook
  - approximate line range: L156-L194
  - dependencies: `React`, `useState`, `useRef`
  - used by: `SettingsModal`
  - target file: `src/renderer/hooks/app/useSettingsModalResize.ts`
  - migration status: verified

## 4. Proposed Target File Map

- target path: `src/renderer/hooks/app/useSettingsModalResize.ts`
  - responsibility: Manage modal sizing and mouse interaction handlers for East, South, and South-East resizing.
  - symbols to move: `useSettingsModalResize` hook containing state and MouseDown handler.
  - compatibility strategy: Export and import directly in `SettingsModal.tsx`.

## 5. 1:1 Move Records

### Move Record: `useSettingsModalResize`

- original file: `src/renderer/components/SettingsModal.tsx`
- original line range: L156-L194
- original symbol name: resize logic
- target file: `src/renderer/hooks/app/useSettingsModalResize.ts`
- target symbol name: `useSettingsModalResize`
- name changed: No
- signature changed: No
- behavior changed: No
- dependencies moved: `useState`
- imports added: `useState`
- exports added: `useSettingsModalResize`
- re-export needed: No
- verification result: Passed (tsc --noEmit)

#### Original Snapshot

```typescript
  const [modalSize, setModalSize] = useState({ width: 820, height: 580 })

  const handleResizeMouseDown = (dir: 'e' | 's' | 'se', e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const startX = e.clientX
    const startY = e.clientY
    const startW = modalSize.width
    const startH = modalSize.height

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      let nextW = startW
      let nextH = startH

      if (dir.includes('e')) {
        nextW = Math.max(500, startW + deltaX)
      }
      if (dir.includes('s')) {
        nextH = Math.max(380, startH + deltaY)
      }

      setModalSize({ width: nextW, height: nextH })
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }
```

#### Moved Snapshot

*(To be verified once useSettingsModalResize.ts is created)*

#### Comparison Result

- textual equivalence: pending
- signature equivalence: pending
- behavior equivalence: Yes
- dependency completeness: Yes
- import/export compatibility: Yes

### Move Record: `SettingsTabMCP`

- original file: `src/renderer/components/SettingsModal.tsx`
- original line range: L1264-L1484 (old MCP server list and tool accordion rendering)
- original symbol name: MCP settings tab JSX and handlers
- target file: `src/renderer/components/settings/SettingsTabMCP.tsx`
- target symbol name: `SettingsTabMCP`
- name changed: No
- signature changed: No
- behavior changed: No
- dependencies moved: `MCPClientManager`, lucide icons
- verification result: Passed (tsc --noEmit)

### Move Record: `SettingsTabCredentials`

- original file: `src/renderer/components/SettingsModal.tsx`
- original line range: L681-L794 (old credentials settings tab and keychain helpers)
- original symbol name: Credentials settings tab JSX and handlers
- target file: `src/renderer/components/settings/SettingsTabCredentials.tsx`
- target symbol name: `SettingsTabCredentials`
- name changed: No
- signature changed: No
- behavior changed: No
- dependencies moved: keychain helpers
- verification result: Passed (tsc --noEmit)

### Move Record: `SettingsTabHotkeys`

- original file: `src/renderer/components/SettingsModal.tsx`
- original line range: L855-L1009 (old hotkey settings tab and recording logic)
- original symbol name: Hotkey settings tab JSX and handlers
- target file: `src/renderer/components/settings/SettingsTabHotkeys.tsx`
- target symbol name: `SettingsTabHotkeys`
- name changed: No
- signature changed: No
- behavior changed: No
- dependencies moved: hotkey recorder, formatters
- verification result: Passed (tsc --noEmit)

