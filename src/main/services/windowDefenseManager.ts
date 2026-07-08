import { BrowserWindow, dialog } from 'electron'

/**
 * [SEC-W-022] Window Defense Manager
 * 
 * 윈도우 단축키 방어 및 강제 종료 방어를 담당합니다.
 * - 일반 새로고침(F5, Ctrl+R) 방지
 * - 강력 새로고침(Ctrl+Shift+R) 허용
 * - 창 닫기 시 확인 팝업 (데이터 유실 방지)
 */
export class WindowDefenseManager {
  static applyDefenses(window: BrowserWindow, isShuttingDown: () => boolean) {
    // 1. 단축키 방어 (새로고침 등)
    window.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown') {
        const isF5 = input.key === 'F5'
        const isCtrlR = input.control && input.key.toLowerCase() === 'r' && !input.shift
        
        if (isF5 || isCtrlR) {
          event.preventDefault()
        }
      }
    })

    // 2. 창 닫기 방어 (Ctrl+W, Alt+F4, X버튼 등)
    let isForceQuit = false
    window.on('close', (e) => {
      // 시스템 전체 셧다운 플래그가 켜져있거나, 이미 종료 승인을 받은 경우 방어 해제
      if (isShuttingDown() || isForceQuit) {
        return
      }

      // 기본 종료 동작 중지
      e.preventDefault()

      // 동기 다이얼로그 호출
      const choice = dialog.showMessageBoxSync(window, {
        type: 'question',
        buttons: ['예(종료)', '아니오(취소)'],
        title: '시스템 종료',
        message: '진짜 종료하시겠습니까?',
        detail: '저장하지 않은 작업은 소실될 수 있습니다.',
        defaultId: 1, // 엔터 쳤을 때 기본적으로 '아니오' 선택
        cancelId: 1
      })

      // '예' 선택 (0번 버튼)
      if (choice === 0) {
        isForceQuit = true
        window.close() // 다시 종료 시도 (이번엔 isForceQuit이 true라 통과됨)
      }
    })
  }
}
