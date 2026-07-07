const fs = require('fs');

let content = fs.readFileSync('src/renderer/components/AIPanel.tsx', 'utf-8');

const startMarker = "{/* 헤더 */}";
const endMarker = "{/* 설정 패널 (모달 UI) */}";

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find start/end markers for header.");
    process.exit(1);
}

const beforeHeader = content.substring(0, startIdx);
const afterHeader = content.substring(endIdx);

const replacement = `<AIPanelHeader
          title={apiType === 'wasm' ? 'Local Edge' : 'Cloud API'}
          providerLabel={apiProvider === 'gemini' ? 'Google Gemini' : apiProvider === 'anthropic' ? 'Anthropic Claude' : 'OpenAI GPT'}
          modelLabel={apiModel || 'auto'}
          isGenerating={isGenerating}
          showSettings={showSettings}
          onOpenSettings={() => setShowSettings(!showSettings)}
          onClearMessages={onClear}
          onClose={onClose}
        />
        `;

let finalContent = beforeHeader + replacement + afterHeader;

if (!finalContent.includes("import { AIPanelHeader }")) {
    finalContent = finalContent.replace("import { AIChatList }", "import { AIChatList }\nimport { AIPanelHeader } from './ai/AIPanelHeader'");
}

fs.writeFileSync('src/renderer/components/AIPanel.tsx', finalContent, 'utf-8');
console.log("Updated AIPanel.tsx to use AIPanelHeader");
