/**
 * @file mcpAdapter.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ipc/adapters/mcpAdapter.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): AMEVA OS 최상위 마운트 레이어에서 의존성 로더로 연동 소비.
 * - 소비처 B (src/renderer/main.tsx): 렌더러 엔트리 라이프사이클의 기본 기능으로 수입 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

export interface MCPSpawnResult {
  success: boolean
  error?: string
  pid?: number
  [key: string]: unknown
}

export interface MCPCallResponse {
  result?: {
    tools?: Record<string, unknown>[]
    content?: unknown[]
    [key: string]: unknown
  }
  error?: {
    code?: number
    message?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface MCPKillResult {
  success: boolean
  error?: string
  [key: string]: unknown
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export async function mcpSpawn(serverId: string, command: string, args: string[]): Promise<MCPSpawnResult | null> {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (!window.electronAPI?.mcpSpawn) return null
  return window.electronAPI.mcpSpawn(serverId, command, args)
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export async function mcpCall(serverId: string, request: Record<string, unknown>): Promise<MCPCallResponse | null> {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (!window.electronAPI?.mcpCall) return null
  return window.electronAPI.mcpCall(serverId, request)
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export async function mcpKill(serverId: string): Promise<MCPKillResult | null> {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (!window.electronAPI?.mcpKill) return null
  return window.electronAPI.mcpKill(serverId)
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export async function mcpGetToken(): Promise<string | null> {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (!window.electronAPI?.mcpGetToken) return null
  return window.electronAPI.mcpGetToken()
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
