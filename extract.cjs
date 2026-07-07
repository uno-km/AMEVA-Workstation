const fs = require('fs');

let content = fs.readFileSync('src/renderer/components/AIPanel.tsx', 'utf-8');

// 1. Extract Header
let header_start = content.indexOf('{/* 헤더 */}');
let header_end = content.indexOf('{/* 빠른 액션 및 모드 탭 (좌우 배치) */}');

let header_block = '';
if (header_start !== -1 && header_end !== -1) {
    header_block = content.substring(header_start, header_end);
} else {
    console.log('Failed to find header block');
}

// 2. Extract Settings Panel
let settings_start = content.indexOf('{/* 설정 패널 (모달 UI) */}');
let settings_end = content.indexOf('{/* 메시지 없을 때 환영 화면 */}');

let settings_block = '';
if (settings_start !== -1 && settings_end !== -1) {
    settings_block = content.substring(settings_start, settings_end);
} else {
    console.log('Failed to find settings block');
}

// 3. Extract Input Bar
let input_start = content.indexOf('{/* 입력창 */}');
let input_end = content.indexOf('{/* 다운로드 프로그레스 바 (하단에 작게) */}');
if (input_end === -1) {
    // If not found, look for end of div
    input_end = content.indexOf('{/* 챗봇과 모델 허브 모달 */}');
}

let input_block = '';
if (input_start !== -1 && input_end !== -1) {
    input_block = content.substring(input_start, input_end);
} else {
    console.log('Failed to find input block');
}

console.log('Blocks found:', header_block.length, settings_block.length, input_block.length);
