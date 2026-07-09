/**
 * @file terminalIpc.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/main/ipc/terminalIpc.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/main/index.ts): 일렉트론 메인 라이프사이클(ready/will-quit) 및 윈도우 생성 시점에 결합 구동.
 * - 소비처 B (src/main/preload.ts): contextBridge 안전 통로 노출을 위한 핵심 백엔드 기능 공급자로 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

import { ipcMain } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export function registerTerminalIpc(): void {
  // 기본 CWD는 프로젝트 루트로 설정
  let currentCwd = process.cwd();

  ipcMain.handle('terminal:execute', async (_event, cmd: string, cwd?: string) => {
    try {
      const execCwd = cwd || currentCwd;
      
      // cd 명령어 가로채기 (상태 관리용)
      if (cmd.trim().startsWith('cd ')) {
        const targetDir = cmd.trim().substring(3).trim();
        let newDir = targetDir;
        
        if (targetDir === '~') {
          newDir = os.homedir();
        } else if (!path.isAbsolute(targetDir)) {
          newDir = path.resolve(execCwd, targetDir);
        }
        
        // 디렉터리 존재 여부 확인을 위해 더미 명령어 실행
        try {
          const fs = require('fs');
          if (fs.existsSync(newDir) && fs.statSync(newDir).isDirectory()) {
            currentCwd = newDir;
            return { stdout: '', stderr: '', newCwd: currentCwd };
          } else {
            return { stdout: '', stderr: `cd: ${targetDir}: No such file or directory`, newCwd: execCwd };
          }
        } catch (e: any) {
          return { stdout: '', stderr: e.message, newCwd: execCwd };
        }
      }

      // pwd 명령어 가로채기
      if (cmd.trim() === 'pwd') {
        return { stdout: execCwd, stderr: '', newCwd: execCwd };
      }

      // 일반 명령어 실행
      let finalCmd = cmd;
      if (process.platform === 'win32') {
        finalCmd = `chcp 65001 >$null; ${cmd}`;
      }
      const { stdout, stderr } = await execAsync(finalCmd, { cwd: execCwd, shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash' });
      return { stdout, stderr, newCwd: execCwd };
    } catch (error: any) {
      return { stdout: '', stderr: error.message || String(error), newCwd: currentCwd };
    }
  });
}
