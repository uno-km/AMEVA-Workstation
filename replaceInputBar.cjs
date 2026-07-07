const fs = require('fs');

let content = fs.readFileSync('src/renderer/components/AIPanel.tsx', 'utf-8');

const focusIdx = content.indexOf('data-focus-region="ai-input"');
if (focusIdx === -1) {
    console.error("Could not find data-focus-region");
    process.exit(1);
}

const startIdx = content.lastIndexOf('<div', focusIdx);
if (startIdx === -1) {
    console.error("Could not find start index for input bar.");
    process.exit(1);
}

// Search for the end of the block.
// The button has title="전송 (Enter)"
const sendTitleIdx = content.indexOf('title="', focusIdx);
const buttonCloseIdx = content.indexOf('</button>', sendTitleIdx);
const divCloseIdx = content.indexOf('</div>', buttonCloseIdx);
const endIdx = divCloseIdx + 6;

const beforeInput = content.substring(0, startIdx);
const afterInput = content.substring(endIdx);

const replacement = `<AIInputBar
            value={input}
            disabled={!isInputEnabled}
            isGenerating={isGenerating}
            placeholder={isInputEnabled ? '메시지를 입력하세요... (Shift+Enter: 줄바꿈)' : 'llama.cpp 구동 대기중...'}
            textareaRef={textareaRef}
            onChange={setInput}
            onSubmit={handleSend}
            onAbort={onAbort}
            onKeyDown={handleKeyDown}
            selectedText={selectedText}
          />`;

let finalContent = beforeInput + replacement + afterInput;

if (!finalContent.includes("import { AIInputBar }")) {
    finalContent = finalContent.replace("import { AIChatList }", "import { AIChatList }\nimport { AIInputBar } from './ai/AIInputBar'");
}

fs.writeFileSync('src/renderer/components/AIPanel.tsx', finalContent, 'utf-8');
console.log("Updated AIPanel.tsx to use AIInputBar");
