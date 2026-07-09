/**
 * @file thoughtParser.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/features/ai-terminal/utils/thoughtParser.ts
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

/**
 * AI의 사고 과정(Thought)을 담는 트리 노드 구조체입니다.
 * 계층적으로 파싱된 마크다운 텍스트 라인들을 부모-자식 관계로 묶습니다.
 */
export interface ThoughtNode {
  id: string;
  title: string;
  level: number;
  isHeader: boolean;
  children: ThoughtNode[];
  status: 'completed' | 'running' | 'pending';
}

/**
 * AI가 생성한 사고 과정(Thought) 텍스트를 파싱하여 트리 형태의 `ThoughtNode` 배열로 반환합니다.
 * 들여쓰기 뎁스(Depth)를 감지하여 자동으로 부모-자식 관계를 형성하며,
 * `isStreaming`이 true일 경우 가장 마지막 노드를 `running` 상태로 애니메이션 마킹합니다.
 * 
 * @param text 파싱할 원본 사고 과정(Thought) 마크다운 텍스트
 * @param isStreaming 현재 텍스트가 실시간으로 스트리밍 중인지 여부
 * @returns 계층 구조가 형성된 `ThoughtNode` 트리 배열
 */
export function parseThoughtText(text: string, isStreaming: boolean): ThoughtNode[] {
  const lines = text.split('\n');
  const roots: ThoughtNode[] = [];
  const stack: ThoughtNode[] = [];
  let nodeIdCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // 들여쓰기(Indentation) 넓이를 기반으로 뎁스를 파악합니다. (탭은 4칸으로 치환)
    const leadingWhitespace = line.match(/^(\s*)/)?.[0] || '';
    const indentWidth = leadingWhitespace.replace(/\t/g, '    ').length;

    const trimmed = line.trim();
    
    // [Header Name] 형태의 대괄호 헤더 섹션을 파싱합니다.
    const headerMatch = trimmed.match(/^\[([^\]]+)\]$/);
    
    if (headerMatch) {
      const title = headerMatch[1].trim();
      const node: ThoughtNode = {
        id: `thought_node_${nodeIdCounter++}`,
        title,
        level: 0,
        isHeader: true,
        children: [],
        status: 'completed',
      };
      roots.push(node);
      stack.length = 0; // 새로운 섹션이 시작되므로 스택을 초기화
      stack.push(node);
    } else {
      // 일반 마크다운 리스트 아이템 파싱 (-, *, +, 1., 2. 등을 제거)
      const content = trimmed.replace(/^[-*+]\s+|^[0-9]+[.)]\s+/, '').trim();
      if (!content) continue;

      let level = 1;
      if (indentWidth > 0) {
        level = Math.floor(indentWidth / 2) + 1;
      }

      const node: ThoughtNode = {
        id: `thought_node_${nodeIdCounter++}`,
        title: content,
        level,
        isHeader: false,
        children: [],
        status: 'completed',
      };

      // 스택을 역추적하며 현재 뎁스보다 얕은 부모 노드를 찾습니다.
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      if (stack.length > 0) {
        stack[stack.length - 1].children.push(node);
      } else {
        roots.push(node);
      }
      stack.push(node);
    }
  }

  // 스트리밍 중이라면 가장 마지막 트리를 순회하여 'running' 상태로 마킹합니다.
  if (isStreaming) {
    let lastLeaf: ThoughtNode | null = null;
    
    function findLastLeaf(nodes: ThoughtNode[]) {
      if (nodes.length === 0) return;
      lastLeaf = nodes[nodes.length - 1];
      if (lastLeaf.children && lastLeaf.children.length > 0) {
        findLastLeaf(lastLeaf.children);
      }
    }
    
    findLastLeaf(roots);
    
    if (lastLeaf) {
      (lastLeaf as ThoughtNode).status = 'running';
      
      // 말단 노드가 running이라면 부모 체인도 모두 running으로 마킹
      function markParentChain(nodes: ThoughtNode[]): boolean {
        let hasRunningChild = false;
        for (const node of nodes) {
          const childRunning = markParentChain(node.children);
          if (node.status === 'running' || childRunning) {
            node.status = 'running';
            hasRunningChild = true;
          }
        }
        return hasRunningChild;
      }
      markParentChain(roots);
    }
  }

  return roots;
}

/**
 * 파싱된 Thought 트리 데이터를 기반으로 총 진행 단계 수와 완료된 단계 수를 계산합니다.
 * UI 프로그레스 바(Progress Bar) 등을 렌더링하기 위한 요약 정보입니다.
 * 
 * @param text 원본 텍스트
 * @param isStreaming 스트리밍 중 여부
 * @returns { totalSteps, completedSteps, activeStep } 계산된 진행 요약 메타데이터 객체
 */
export function getThoughtSummary(text: string, isStreaming: boolean) {
  const nodes = parseThoughtText(text, isStreaming);
  let totalSteps = 0;
  let completedSteps = 0;
  
  function count(items: ThoughtNode[]) {
    for (const n of items) {
      if (!n.isHeader) {
        totalSteps++;
        if (n.status === 'completed') {
          completedSteps++;
        }
      }
      if (n.children) {
        count(n.children);
      }
    }
  }
  count(nodes);
  
  const activeStep = isStreaming ? completedSteps + 1 : totalSteps;
  return { totalSteps, completedSteps, activeStep };
}
