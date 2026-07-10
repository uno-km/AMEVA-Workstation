<!--
 * AMEVA OS Documentation - architecture_review.md
 * Location: src/renderer/features/ai-terminal/docs/architecture_review.md
 * Purpose: AI 에이전트 및 휴먼 개발자를 위한 시스템 가이드 및 백업 이력 아카이브.
-->
# AMEVA OS - AI Terminal Architecture Review

현재까지 진행된 리팩토링 및 쪼개기 작업에 대한 중간 점검 문서입니다.

## 1. 컴포넌트 & 스토어 아키텍처 다이어그램

```mermaid
graph TD
    %% Stores (Zustand)
    subgraph Zustand Stores [상태 관리 계층]
        useAIState[useAIState<br>(상태/설정)]
        useAILogStore[useAILogStore<br>(메시지/스트리밍/센서로그)]
    end

    %% Engine Hooks
    subgraph Engine Layer [AI 엔진 계층]
        useLocalAIEngine[useLocalAIEngine<br>(Llama.cpp 로컬)]
        useRemoteAIEngine[useRemoteAIEngine<br>(API/Ollama 원격)]
    end

    %% Facade
    subgraph Facade Layer [파사드 패턴]
        useAI[useAIAgent / useAI<br>(Orchestrator)]
        useAI --> useAIState
        useAI --> useAILogStore
        useAI --> useLocalAIEngine
        useAI --> useRemoteAIEngine
    end

    %% UI Components
    subgraph UI Layer [프레젠테이션 계층]
        AIPanel[AIPanel.tsx<br>(메인 패널 컨테이너)]
        AIChatInput[AIChatInput.tsx<br>(입력창 컴포넌트)]
        AIChatList[AIChatList.tsx<br>(메시지 목록 컴포넌트)]
        MessageBubble[MessageBubble.tsx<br>(개별 메시지 버블)]
        InsertPreviewCard[InsertPreviewCard.tsx<br>(제안 미리보기 UI)]
    end

    %% Dependencies
    AIPanel --> AIChatInput
    AIPanel --> AIChatList
    AIChatList --> MessageBubble
    MessageBubble --> InsertPreviewCard

    %% Direct Zustand/Facade binding
    AIChatInput -->|직접 구독| useAI
    AIPanel -.->|과거 Props 드릴링 끊어냄| AIChatInput
    AIPanel -.->|과거 Props 드릴링 끊어냄| AIChatList
```

## 2. 지금까지 진행된 내용 요약 (중간 점검)

1. **`useAI.ts` 2100줄 파사드 패턴 분해 완료**
   - 엔진 로직을 `useLocalAIEngine.ts`와 `useRemoteAIEngine.ts`로 완벽 분리.
   - 포맷팅/파싱 유틸리티 함수들을 `src/shared/utils` 및 `src/renderer/features/ai-terminal/utils`로 추출.
   - TS 타입들을 `aiTypes.ts`로 분리 후 `import type` 도입으로 빌드 에러 해결.

2. **UI 바텀업(Bottom-up) 파편화 및 직접 결합 (진행 완료)**
   - `AIPanel.tsx` 안에서 1000줄 넘게 차지하던 UI들을 기능별로 완전 분리.
   - `InsertPreviewCard.tsx`: AI 수정 제안용 UI 독립화.
   - `AIChatInput.tsx`: 입력 창 및 생성 중단 버튼 등 캡슐화, 부모 Props 없이 직접 `useAI`를 구독하여 상태 통신.
   - `AIChatList.tsx`: 메시지 목록 컨테이너 모듈화 완료.

3. **기본적인 하드코딩 억제 구조 세팅 완료**
   - `DEFAULT_SETTINGS` 분리 완료.
   - 타입 익스포트/임포트 분리 완료 (TS Vite 오류 해결).
   - 예외 처리 빈칸(Empty Catch) 금지 및 중단(Abort) 예외 시 로그 스트림 유지 원칙 적용.

## 3. 앞으로 남은 단계 (Next Steps)

1. **센서 데이터 Yjs 충돌 방지 및 Transient Updates 구현 (최우선 과제)**
   - Yjs CRDT 모델이 실시간 쏟아지는 로그에 의해 메모리 누수를 일으키는 것을 막기 위함.
   - 링 버퍼(Ring Buffer)와 React 렌더링 우회(DOM 직접 업데이트)를 적용한 스트리밍 구조 고도화.
   - 브로드캐스트 채널을 통해 다중 클라이언트 간 센서 로그 임시 동기화(비영구적) 기능 구현.

2. **문서화 강제 시스템(Docs Manager 스킬) 도입 여부**
   - 현재처럼 대규모 리팩토링 및 아키텍처 변경이 있을 시, 이 `architecture_review.md`나 `AGENTS.md`의 규칙을 AI가 놓치지 않게 강제하는 MCP 또는 스킬 파이프라인 구성.

3. **추가 컴포넌트의 상태 결합 심화**
   - `AIPanel`이 여전히 관장하고 있는 설정(Settings) 탭이나 모델 다운로드 UI도 Zustand 스토어와 직접 통신하도록 파편화 가능성이 남음 (선택적 최적화).

<!-- [VERIFICATION-TOKEN] AMEVA-OS-283-DOC-VERIFIED -->
<!-- [VERIFICATION-TOKEN] AMEVA-OS-283-DOC-VERIFIED -->
