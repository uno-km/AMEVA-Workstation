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

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `execAsync`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const execAsync = ...` 형태로 안전 캐싱 후 가공 기동.
       */
const execAsync = promisify(exec);

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `registerTerminalIpc`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `registerTerminalIpc(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function registerTerminalIpc(): void {
  // 기본 CWD는 프로젝트 루트로 설정
  let currentCwd = process.cwd();

  ipcMain.handle('terminal:execute', async (_event, cmd: string, cwd?: string) => {
    try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `execCwd`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const execCwd = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const execCwd = cwd || currentCwd;
      
      // cd 명령어 가로채기 (상태 관리용)
      if (cmd.trim().startsWith('cd ')) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `targetDir`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const targetDir = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const targetDir = cmd.trim().substring(3).trim();
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `newDir`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const newDir = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        let newDir = targetDir;
        
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `targetDir === '~'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (targetDir === '~')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (targetDir === '~') {
          newDir = os.homedir();
        } else if (!path.isAbsolute(targetDir)) {
          newDir = path.resolve(execCwd, targetDir);
        }
        
        // 디렉터리 존재 여부 확인을 위해 더미 명령어 실행
        try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `fs`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const fs = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const fs = require('fs');
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `fs.existsSync(newDir) && fs.statSync(newDir).isDirectory()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (fs.existsSync(newDir) && fs.statSync(newDir).isDirectory())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
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
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `process.platform === 'win32'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (process.platform === 'win32')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
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

