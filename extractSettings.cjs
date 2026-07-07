const fs = require('fs');

let content = fs.readFileSync('src/renderer/components/AIPanel.tsx', 'utf-8');

const startMarker = "{/* 설정 패널 (모달 UI) */}";
const endMarker = "{/* 메시지 없을 때 환영 화면 */}";

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find start/end markers for settings panel.");
    process.exit(1);
}

// Find `{showSettings && (`
const blockStart = content.indexOf("{showSettings && (", startIdx);
if (blockStart === -1 || blockStart > endIdx) {
    console.error("Could not find {showSettings && (");
    process.exit(1);
}

let settingsBlockContent = content.substring(blockStart, endIdx);

// settingsBlockContent ends with `\n      ` because `endMarker` is `{/* 메시지 없을 때 환영 화면 */}`.
// The `)}` closing for showSettings is right above `endMarker`.
// Let's strip out the `{showSettings && (` at the start, and the `)}` at the end.
settingsBlockContent = settingsBlockContent.replace(/\{showSettings && \(\s*/, '');
// For the end, remove the last occurrence of `)}`
const lastClosingIdx = settingsBlockContent.lastIndexOf(')}');
if (lastClosingIdx !== -1) {
    settingsBlockContent = settingsBlockContent.substring(0, lastClosingIdx) + settingsBlockContent.substring(lastClosingIdx + 2);
}

let newComponent = `import React from 'react'
import { X, Check, Trash2, AlertCircle } from 'lucide-react'
import { PROVIDER_MODELS, API_ENDPOINTS } from '../../shared/constants/aiSettings'

export interface AISettingsPanelProps {
  settings: any
  onUpdateSettings: (s: any) => void
  models: any[]
  isKeySaved: Record<string, boolean>
  handleApiKeyChange: (val: string) => void
  handleSaveKey: () => void
  handleDeleteKey: () => void
  onClose: () => void
}

export function AISettingsPanel({
  settings,
  onUpdateSettings,
  models,
  isKeySaved,
  handleApiKeyChange,
  handleSaveKey,
  handleDeleteKey,
  onClose
}: AISettingsPanelProps) {
  const { apiType = 'wasm', apiProvider = 'gemini', apiKey = '', apiEndpoint = '', apiModel = '', gpuOnly = true } = settings
  const isWhiteTheme = settings.theme === 'white'

  return (
    ${settingsBlockContent.replace(/setShowSettings\(false\)/g, 'onClose()')}
  )
}
`;

fs.writeFileSync('src/renderer/components/ai/AISettingsPanel.tsx', newComponent, 'utf-8');
console.log("Extracted AISettingsPanel.tsx");

// Update AIPanel.tsx
const beforeSettings = content.substring(0, startIdx);
const afterSettings = content.substring(endIdx);

const replacement = `{/* 설정 패널 (모달 UI) */}
      {showSettings && (
        <AISettingsPanel
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          models={models}
          isKeySaved={isKeySaved}
          handleApiKeyChange={handleApiKeyChange}
          handleSaveKey={handleSaveKey}
          handleDeleteKey={handleDeleteKey}
          onClose={() => setShowSettings(false)}
        />
      )}
      `;

let finalContent = beforeSettings + replacement + afterSettings;
fs.writeFileSync('src/renderer/components/AIPanel.tsx', finalContent, 'utf-8');
console.log("Updated AIPanel.tsx to use AISettingsPanel");
