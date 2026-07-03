/**
 * focusRegion.ts
 * ──────────────────────────────────────────────────────────────
 * 전역 포커스 영역 관리 모듈 (React 의존 없음)
 *
 * 사용법:
 *   HTML 요소에 data-focus-region="region-id" 속성을 추가하면 자동 동작.
 *   클릭 시 해당 요소에 CSS class "focus-region-active" 가 토글됨.
 *
 * 확장:
 *   - 새 패널/모달 추가 시 data-focus-region="my-panel" 만 추가하면 됨.
 *   - subscribe() 로 활성 region 변경을 구독할 수 있음 (React 훅 등).
 *   - activate() 로 프로그래매틱하게 활성화 가능.
 *
 * 내부 동작:
 *   document mousedown (capture phase) 에서 closest('[data-focus-region]') 탐색.
 *   이전 active 제거 → 새 active 부여 → 구독자에게 알림.
 * ──────────────────────────────────────────────────────────────
 */

export const FOCUS_REGION_ATTR = 'data-focus-region'
export const FOCUS_REGION_CLASS = 'focus-region-active'

// ── 구독자 타입 ─────────────────────────────────────────────────
type Listener = (activeId: string | null) => void

// ── 모듈 상태 ───────────────────────────────────────────────────
let currentActiveId: string | null = null
const listeners = new Set<Listener>()

// ── 내부 헬퍼 ───────────────────────────────────────────────────
function notify() {
  listeners.forEach(l => l(currentActiveId))
}

function applyClass(id: string | null, add: boolean) {
  if (!id) return
  document.querySelectorAll(`[${FOCUS_REGION_ATTR}="${id}"]`).forEach(el => {
    if (add) {
      el.classList.add(FOCUS_REGION_CLASS)
    } else {
      el.classList.remove(FOCUS_REGION_CLASS)
    }
  })
}

// ── 공개 API ─────────────────────────────────────────────────────

/**
 * 특정 region을 활성화합니다.
 * null 전달 시 현재 active region 비활성화.
 */
export function activate(id: string | null): void {
  if (id === currentActiveId) return

  // 이전 active 제거
  applyClass(currentActiveId, false)

  currentActiveId = id

  // 새 active 부여
  applyClass(currentActiveId, true)

  notify()
}

/**
 * 현재 활성화된 region ID를 반환합니다.
 */
export function getActiveId(): string | null {
  return currentActiveId
}

/**
 * region 변경 구독 (언구독 함수 반환)
 * @example
 *   const unsub = subscribe(id => console.log('active:', id))
 *   // 나중에:
 *   unsub()
 */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// ── 전역 mousedown delegation ─────────────────────────────────────
// 문서 어디를 클릭하든 가장 가까운 [data-focus-region] 조상을 찾아 활성화
// capture phase 사용: 이벤트가 innermost 요소로 내려가기 전에 감지

function handleGlobalMouseDown(e: MouseEvent): void {
  const target = e.target as Element | null
  if (!target) {
    activate(null)
    return
  }
  const regionEl = target.closest(`[${FOCUS_REGION_ATTR}]`)
  const id = regionEl?.getAttribute(FOCUS_REGION_ATTR) ?? null
  activate(id)
}

// 모듈 로드 시 단 한 번 등록 (싱글턴)
document.addEventListener('mousedown', handleGlobalMouseDown, true)

// ── 접근성: 키보드 Tab 이동도 추적 ──────────────────────────────
// Tab 키로 포커스가 이동하면 해당 region도 활성화
function handleGlobalFocusIn(e: FocusEvent): void {
  const target = e.target as Element | null
  if (!target) return
  // 이미 mousedown에서 처리됐으면 불필요하지만, 키보드 전용 이동 감지를 위해 유지
  const regionEl = target.closest(`[${FOCUS_REGION_ATTR}]`)
  if (!regionEl) return
  const id = regionEl.getAttribute(FOCUS_REGION_ATTR)
  if (id && id !== currentActiveId) activate(id)
}

document.addEventListener('focusin', handleGlobalFocusIn, true)
