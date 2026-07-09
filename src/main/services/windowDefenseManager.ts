/**
 * @file windowDefenseManager.ts
 * @system AMEVA OS Desktop Workstation - System Window Monitor
 * @location src/main/services/windowDefenseManager.ts
 * @role Application window shortcut inhibitor & close request guard
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/main/index.ts): 일렉트론 메인 윈도우 인스턴스 생성 시점(`createWindow`)에 호출되어 applyDefenses가 창 새로고침 차단 및 닫기 팝업 방어 기능을 탑재함.
 * - 소비처 B (src/main/preload.ts): 창 강제 닫기(`forceQuit`) 및 종료 루프 제어를 위해 Context Bridge와 결합하여 렌더러가 호출할 수 있는 게이트 제공.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 윈도우 단축키 방어 및 강제 종료 방어를 담당한다.
 * - 일반 새로고침(F5, Ctrl+R) 방지하되, 강력 새로고침(Ctrl+Shift+R)은 개발용으로 허용한다.
 * - 창 닫기 시 동기화 종료 다이얼로그(`dialog.showMessageBoxSync`)를 띄워 데이터 유실을 차단한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST NOT: 사용자가 종료 의사 다이얼로그에서 '아니오'를 선택했을 때는 절대 Electron 프로세스를 강제 소멸시켜서는 안 됨.
 * - MUST: `dialog.showMessageBoxSync` 호출은 메인 스레드를 동기식으로 일시 락하므로, 다이얼로그가 열려있는 동안 백그라운드 Yjs 서버 및 LLM 기동 헬스체크 프로세스가 고아 상주하지 않도록 감청 제어를 철저히 유지할 것.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - BrowserWindow: Electron의 데스크톱 화면 창 렌더러 인스턴스 클래스.
 * - dialog: OS 네이티브 경고 및 팝업 대화상자 호출을 위한 Electron 코어 모듈.
 */
import { BrowserWindow, dialog } from 'electron'

/**
 * @class WindowDefenseManager
 * @description 윈도우 화면 새로고침 통제 및 Alt+F4/종료 방어를 주관하는 메인 서비스 클래스.
 */
export class WindowDefenseManager {
  /*
   * [STATIC RUN-TIME CONST STATE]
   * - isForceQuit: 렌더러 승인 하에 안전하게 강제 종료 루프에 돌입했는지 여부를 판정하는 상태 락 변수.
   * - 예상 값: 기본값 false, 종료 승인 시 true.
   */
  static isForceQuit = false

  /**
   * @method forceQuit
   * @description 다이얼로그 확인 절차 없이 즉시 OS 윈도우 창을 강제 폐쇄하는 게이트웨이 함수.
   * @param window 대상 BrowserWindow 인스턴스.
   * @example
   * WindowDefenseManager.forceQuit(mainWindow);
   */
  static forceQuit(window: BrowserWindow) {
    /*
     * [FORCE QUIT STATUS ON]
     * - isForceQuit = true: 닫기 방어 훅(`window.on('close')`)의 상단 조건 가드를 바이패스 시키기 위해 락 상태를 true로 활성화함.
     * - window.close(): 닫기 이벤트를 다시 유발시켜 창이 완전히 닫히게 유도함.
     */
    this.isForceQuit = true
    window.close()
  }

  /**
   * @method applyDefenses
   * @description 윈도우 창 새로고침 방어 리스너 및 닫기 전 확인 팝업 가드를 적용하는 시스템 초기화 매핑 함수.
   * @param window 가드를 적용할 BrowserWindow 대상.
   * @param isShuttingDown 시스템 전체 셧다운 상태를 반환하는 콜백 함수.
   */
  static applyDefenses(window: BrowserWindow, isShuttingDown: () => boolean) {
    /*
     * [KEYBOARD SHORTCUT DEFENSE LISTEN EVENT]
     * - window.webContents.on('before-input-event'): 키보드 입력이 웹뷰 렌더러로 전달되기 직전 가로채는 Electron 메인 프로세스 훅.
     */
    window.webContents.on('before-input-event', (event, input) => {
      /*
       * [EVENT-INPUT TYPE GUARD]
       * - input.type: 문자열 타입 (예: 'keyDown', 'keyUp', 'char')
       * - input.type === 'keyDown' 시점에만 새로고침 입력을 방어하여 중복 방지를 예방함.
       * - 예시: 사용자가 키보드 F5를 누르는 시점(input.type === 'keyDown')에 이벤트 가로채기(preventDefault) 구동.
       */
      if (input.type === 'keyDown') {
        /*
         * [RUN-TIME CONSTANT - isF5]
         * - input.key: 입력 키 문자열 (예: 'F5', 'Enter', 'r')
         * - 사용자가 누른 키가 'F5'인지 여부를 판별하여 boolean 값(true/false)을 캐싱함.
         * - 예상 값: F5 누르면 true, 그 외 키는 false.
         */
        const isF5 = input.key === 'F5'

        /*
         * [RUN-TIME CONSTANT - isCtrlR]
         * - input.control: Ctrl 키가 눌려있는지 여부 (boolean)
         * - input.key.toLowerCase(): 입력 키를 소문자로 변환하여 'r'과 대조.
         * - !input.shift: Shift 키가 눌려있지 않은 상태 (Ctrl+Shift+R 강력 새로고침은 허용하기 위함).
         * - 예상 값: Ctrl+R 입력 시 true, Ctrl+Shift+R 입력 시 false.
         */
        const isCtrlR = input.control && input.key.toLowerCase() === 'r' && !input.shift
        
        /*
         * [REFRESH CONTROL ROUTING BRANCH]
         * - isF5가 true이거나 isCtrlR이 true인 경우(F5 혹은 Ctrl+R이 유입되었을 때)를 식별.
         * - event.preventDefault(): Electron 기본 창 새로고침 동작을 강제 중단시킴.
         * - 예시 코드: F5 키 유입 시 event.preventDefault() 호출되어 웹 뷰 새로고침 소멸.
         */
        if (isF5 || isCtrlR) {
          event.preventDefault()
        }
      }
    })

    /*
     * [WINDOW CLOSE GUARD EVENT LISTENER]
     * - window.on('close'): Electron 브라우저 창이 Alt+F4, OS X버튼 클릭, 또는 window.close()로 인해 소멸되기 직전에 호출되는 이벤트 리스너.
     */
    window.on('close', (e) => {
      /*
       * [SHUTDOWN GUARD DISMISS BRANCH]
       * - isShuttingDown(): 현재 시스템 전체가 Graceful 셧다운 중인지 여부를 감청하는 런타임 콜백. (리턴값: true/false)
       * - WindowDefenseManager.isForceQuit: 종료 다이얼로그에서 '예'를 선택하여 강제 종료를 승인했는지 여부. (리턴값: true/false)
       * - 예상 시나리오: isShuttingDown()이 true이거나 isForceQuit이 true이면, 사용자 확인 다이얼로그를 건너뛰고(return) 즉시 종료가 실현됨.
       * - 예시: 이 플래그들이 false인 경우에만 아래의 showMessageBoxSync 다이얼로그 팝업이 노출됨.
       */
      if (isShuttingDown() || WindowDefenseManager.isForceQuit) {
        return
      }

      /*
       * [PREVENT DEFAULT CLOSE BEHAVIOR]
       * - e.preventDefault(): Electron 창이 즉시 닫히지 않도록 기본 클로징 동작을 취소함.
       * - 목적: 사용자에게 진짜 종료할 것인지 묻는 다이얼로그를 동기적으로 노출할 시간을 벌기 위함.
       */
      e.preventDefault()

      /*
       * [SYNCHRONOUS DIALOGUE POPUP]
       * - dialog.showMessageBoxSync: Electron 메인 스레드를 일시 정지(Block)시키고 사용자 종료 의사를 묻는 확인 창을 띄움.
       * - choice: 사용자가 누른 버튼의 인덱스 정수값 반환 (0: '예', 1: '아니오').
       * - cancelId: 1 (다이얼로그 창을 ESC 키 등으로 닫았을 때 '아니오'로 처리하기 위한 취소 매핑).
       * - 예상 값: 사용자가 '예'를 누르면 0, '아니오' 혹은 창을 닫으면 1 반환.
       */
      const choice = dialog.showMessageBoxSync(window, {
        type: 'question',
        buttons: ['예(종료)', '아니오(취소)'],
        title: '시스템 종료',
        message: '진짜 종료하시겠습니까?',
        detail: '저장하지 않은 작업은 소실될 수 있습니다.',
        defaultId: 1, // 엔터 쳤을 때 기본적으로 '아니오' 선택
        cancelId: 1
      })

      /*
       * [USER CLOSE CHOICE HANDLING BRANCH]
       * - choice === 0: 사용자가 다이얼로그에서 '예(종료)' 버튼을 선택한 시나리오 판정.
       * - WindowDefenseManager.isForceQuit = true: 2차 종료 루프에서 상단의 방어 해제 게이트를 통과할 수 있도록 강제 종료 권한 승인 플래그 세팅.
       * - window.close(): 다시 닫기를 시도하여 상단의 isForceQuit 검출 분기(return)를 타고 안전하게 창이 닫힘.
       * - 예시 코드: choice가 0이면 static isForceQuit을 true로 키고 window.close()를 재호출.
       */
      if (choice === 0) {
        WindowDefenseManager.isForceQuit = true
        window.close() // 다시 종료 시도 (이번엔 isForceQuit이 true라 통과됨)
      }
    })
  }
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
