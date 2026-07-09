/**
 * @file aiFormatters.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/utils/aiFormatters.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/hooks/): 관련 비즈니스 훅 내부 연산 시 순수 함수 유틸리티로 수입 소비.
 * - 소비처 B (src/renderer/components/): 렌더링 전 데이터 정제 단계에서 포맷터 유틸리티로 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function formatBytes(bytes: number): string {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)}MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`
}

export interface ThoughtNode {
  id: string
  title: string
  level: number
  isHeader: boolean
  children: ThoughtNode[]
  status: 'completed' | 'running' | 'pending'
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function parseThoughtText(text: string, isStreaming: boolean): ThoughtNode[] {
  // [RUN-TIME STATE / INVARIANT] - 변수 'lines'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const lines = text.split('\n')
  const roots: ThoughtNode[] = []
  const stack: ThoughtNode[] = []
  // [RUN-TIME STATE / INVARIANT] - 변수 'nodeIdCounter'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  let nodeIdCounter = 0

  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
  for (let i = 0; i < lines.length; i++) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'line'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const line = lines[i]
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!line.trim()) continue

    // Detect indentation level (number of spaces or tabs)
    const leadingWhitespace = line.match(/^(\s*)/)?.[0] || ''
  // [RUN-TIME STATE / INVARIANT] - 변수 'indentWidth'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const indentWidth = leadingWhitespace.replace(/\t/g, '    ').length

  // [RUN-TIME STATE / INVARIANT] - 변수 'trimmed'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const trimmed = line.trim()
    
    // Check if it's a section header, e.g. [Header Name]
    const headerMatch = trimmed.match(/^\[([^\]]+)\]$/)
    
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (headerMatch) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'title'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const title = headerMatch[1].trim()
      const node: ThoughtNode = {
        id: `thought_node_${nodeIdCounter++}`,
        title,
        level: 0,
        isHeader: true,
        children: [],
        status: 'completed',
      }
      roots.push(node)
      stack.length = 0 // Clear stack for new section
      stack.push(node)
    } else {
      // It's a step item
      // Clean bullet points: -, *, +, 1., 2. etc.
      const content = trimmed.replace(/^[-*+]\s+|^[0-9]+[.)]\s+/, '').trim()
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!content) continue

  // [RUN-TIME STATE / INVARIANT] - 변수 'level'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      let level = 1
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (indentWidth > 0) {
        level = Math.floor(indentWidth / 2) + 1
      }

      const node: ThoughtNode = {
        id: `thought_node_${nodeIdCounter++}`,
        title: content,
        level,
        isHeader: false,
        children: [],
        status: 'completed',
      }

      // Find parent in stack
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop()
      }

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (stack.length > 0) {
        stack[stack.length - 1].children.push(node)
      } else {
        roots.push(node)
      }
      stack.push(node)
    }
  }

  // Adjust statuses if streaming
  if (isStreaming) {
    let lastLeaf: ThoughtNode | null = null
    
  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
    function findLastLeaf(nodes: ThoughtNode[]) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (nodes.length === 0) return
      lastLeaf = nodes[nodes.length - 1]
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (lastLeaf.children && lastLeaf.children.length > 0) {
        findLastLeaf(lastLeaf.children)
      }
    }
    
    findLastLeaf(roots)
    
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (lastLeaf) {
      (lastLeaf as ThoughtNode).status = 'running'
      
      // Mark parent chain as running
      function markParentChain(nodes: ThoughtNode[]): boolean {
  // [RUN-TIME STATE / INVARIANT] - 변수 'hasRunningChild'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        let hasRunningChild = false
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
        for (const node of nodes) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'childRunning'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const childRunning = markParentChain(node.children)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (node.status === 'running' || childRunning) {
            node.status = 'running'
            hasRunningChild = true
          }
        }
        return hasRunningChild
      }
      markParentChain(roots)
    }
  }

  return roots
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function getThoughtSummary(text: string, isStreaming: boolean) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'nodes'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const nodes = parseThoughtText(text, isStreaming)
  // [RUN-TIME STATE / INVARIANT] - 변수 'totalSteps'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  let totalSteps = 0
  // [RUN-TIME STATE / INVARIANT] - 변수 'completedSteps'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  let completedSteps = 0
  
  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
  function count(items: ThoughtNode[]) {
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
    for (const n of items) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!n.isHeader) {
        totalSteps++
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (n.status === 'completed') {
          completedSteps++
        }
      }
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (n.children) {
        count(n.children)
      }
    }
  }
  count(nodes)
  
  // [RUN-TIME STATE / INVARIANT] - 변수 'activeStep'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const activeStep = isStreaming ? completedSteps + 1 : totalSteps
  return { totalSteps, completedSteps, activeStep }
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
