import os
import re

with open('src/renderer/components/AIPanel.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Extract Header
header_start = content.find('{/* 헤더 */}')
header_end = content.find('{/* 빠른 액션 및 모드 탭 (좌우 배치) */}')

if header_start != -1 and header_end != -1:
    header_block = content[header_start:header_end]
else:
    print('Failed to find header block')

# 2. Extract Settings Panel
settings_start = content.find('{/* 설정 패널 (모달 UI) */}')
settings_end = content.find('{/* 메시지 없을 때 환영 화면 */}')

if settings_start != -1 and settings_end != -1:
    settings_block = content[settings_start:settings_end]
else:
    print('Failed to find settings block')

# 3. Extract Input Bar
input_start = content.find('{/* 입력창 */}')
input_end = content.find('{/* 다운로드 프로그레스 바 (하단에 작게) */}')

if input_start != -1 and input_end != -1:
    input_block = content[input_start:input_end]
else:
    print('Failed to find input block')

print('Blocks found:', len(header_block), len(settings_block), len(input_block))
