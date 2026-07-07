const fs = require('fs');

let content = fs.readFileSync('src/renderer/components/AIPanel.tsx', 'utf-8');

const startMarker = "{/* 텍스트 입력 + 버튼 */}";
const endMarker = "{/* 🤖 AMEVA AI 추천 모델 다운로드 허브 모달 */}";

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find start/end markers for input bar.");
    process.exit(1);
}

// Search backwards from endMarker to find the closing div of the container 
// (or we can just replace up to `<div data-focus-region="ai-input"` closing tag)
// Wait, looking at the grep earlier:
// 1482: {/* 텍스트 입력 + 버튼 */}
// 1494: {/* 🤖 AMEVA AI 추천 모델 다운로드 허브 모달 */}
// There are only 12 lines between these two markers! Wait... is that true?
// No, the line numbers in grep_search earlier were shifted because I deleted huge blocks from the file using the previous scripts!
// Let's just find the closing tag. We'll replace the block from `startMarker` to `endMarker`. 

// BUT wait! There is a closing `</div>` right before endMarker for the parent `<div>`.
// Let's print out the slice first to be absolutely sure.
const slice = content.substring(startIdx, endIdx);
console.log(slice);

let beforeInput = content.substring(0, startIdx);
let afterInput = content.substring(endIdx);

const replacement = `<AIInputBar
          value={input}
          disabled={!isInputEnabled}
          isGenerating={isGenerating}
          placeholder={isInputEnabled ? '메시지를 입력하세요... (Shift+Enter: 줄바꿈)' : 'llama.cpp 구동 대기중...'}
          textareaRef={textareaRef}
          onChange={setInput}
          onSubmit={() => handleKeyDown({ key: 'Enter', shiftKey: false, preventDefault: () => {} } as any)}
          onAbort={onAbort}
          onKeyDown={handleKeyDown}
          selectedText={selectedText}
        />
      </div>
      `;

let finalContent = beforeInput + replacement + afterInput;

fs.writeFileSync('src/renderer/components/AIPanel.tsx', finalContent, 'utf-8');
console.log("Updated AIPanel.tsx to use AIInputBar");
