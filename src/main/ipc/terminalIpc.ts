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
