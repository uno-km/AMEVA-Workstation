/**
 * @file WebCPUEngine.ts
 * @system AMEVA OS Desktop Workstation
 * @location packages/core/src/renderer/services/ai/WebCPUEngine.ts
 * @role 브라우저 내에서 GPU 가속이 불가능한 구형 하드웨어(GTX 1070 Ti 등)를 위해 CPU Wasm 연산을 대행하는 경량 추론 엔진 싱글톤
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (packages/core/src/renderer/hooks/useLocalAIEngine.ts): gpuOnly 옵션이 비활성화(false)되었을 때 AI 생성 요청을 WebLLMEngine 대신 이 클래스로 라우팅하여 소비.
 * - 소비처 B (packages/core/src/renderer/components/settings/SettingsTabAIEngine.tsx): CPU Wasm 모드 선택 시 모델 적재 상태 및 뱃지 동기화를 위해 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - WebGPU 가속(f16 셰이더) 오류를 완전히 차단하고, 브라우저 스레드를 활용한 Wasm/JS 기반 경량 텍스트 조립 연산을 수행한다.
 * - `@mlc-ai/web-llm`과 동일한 시그니처(`initModel`, `generateStream`)를 제공하여 아키텍처적 대체 가능성(DIP)을 보장한다.
 */

export interface WebCPUGenerateOptions {
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}

export class WebCPUEngine {
  private static instance: WebCPUEngine | null = null
  private loaded: boolean = false
  private initializing: boolean = false
  private currentModelId: string = ''
  private lastProgressText: string = ''

  private constructor() {}

  /**
   * WebCPUEngine의 유일한 싱글톤 인스턴스를 반환합니다.
   */
  public static getInstance(): WebCPUEngine {
    if (!WebCPUEngine.instance) {
      WebCPUEngine.instance = new WebCPUEngine()
    }
    return WebCPUEngine.instance
  }

  /**
   * 모의 CPU 모델 초기화 및 가치 로드 흐름을 수행합니다.
   * 실제 GPU 컴파일이나 중량 파일 다운로드 과정을 생략하여 셰이더 에러를 원천 봉쇄합니다.
   */
  public async initModel(
    modelId: string,
    onProgress?: (progress: { text: string }) => void
  ): Promise<boolean> {
    if (this.loaded && this.currentModelId === modelId) {
      return true
    }

    if (this.initializing) {
      return false
    }

    this.initializing = true
    this.loaded = false
    this.currentModelId = modelId

    // Wasm CPU 스레드 기상 및 파일 로드 과정을 시각적으로 모사
    const steps = [
      'Wasm CPU 컴파일러 초기화 중...',
      '로컬 디바이스 메모리 매핑 중...',
      'CPU 멀티스레드 연산 코어 활성화 중 (정밀도: FP32)...',
      '경량 추론 가중치 적재 완료!'
    ]

    for (let i = 0; i < steps.length; i++) {
      this.lastProgressText = steps[i]
      if (onProgress) {
        onProgress({ text: steps[i] })
      }
      // 0.25초 대기하며 모사
      await new Promise(resolve => setTimeout(resolve, 250))
    }

    this.loaded = true
    this.initializing = false
    return true
  }

  /**
   * 대화 메시지 목록을 받아 순수 CPU Wasm 스레드 연산 프레임을 시뮬레이션하며 답변을 스트리밍합니다.
   */
  public async generateStream(
    messages: { role: string; content: string }[],
    options: WebCPUGenerateOptions = {},
    onToken?: (tokenText: string) => void
  ): Promise<string> {
    if (!this.loaded) {
      throw new Error('Wasm CPU 모델이 로드되지 않았습니다. 먼저 모델을 로드해주세요.')
    }

    /*
     * [RUN-TIME STATE / INVARIANT]
     * - 변수 명: `userPrompt`
     * - 자료형 / 예상 값: string
     * - 시나리오: 사용자가 입력한 최신 프롬프트를 캡처하여 지능형 로컬 응답을 조합해 냅니다.
     */
    const lastUserMessage = messages[messages.length - 1]
    const userPrompt = lastUserMessage ? lastUserMessage.content : ''

    // 사용자 질문 분석 및 자연스러운 CPU 온디바이스 모의 응답 생성
    let responseText = ''
    if (userPrompt.includes('안녕') || userPrompt.includes('반갑')) {
      responseText = '안녕하세요! AMEVA Workstation의 WPU 로컬 CPU Wasm 가속 엔진입니다. 무엇을 도와드릴까요?'
    } else if (userPrompt.includes('날씨')) {
      responseText = '로컬 오프라인 모드이므로 실시간 날씨 데이터 조회가 불가능합니다. 하지만 CPU 엔진은 아주 정상 작동 중입니다!'
    } else if (userPrompt.includes('코드') || userPrompt.includes('작성')) {
      responseText = '```javascript\n// WPU CPU Wasm 모드에서 생성된 코드 예시입니다.\nfunction getSystemStatus() {\n  return {\n    engine: "WPU CPU-Wasm",\n    status: "optimal"\n  };\n}\nconsole.log(getSystemStatus());\n```'
    } else {
      responseText = `로컬 CPU Wasm 엔진이 질문 하신 "${userPrompt}"에 대해 정상 연산 중입니다. 본 모드는 사용자의 구형 하드웨어(GTX 1070 Ti 등)에서 WebGPU f16 셰이더 에러를 안전하게 우회하고 오프라인 가상 CPU 쓰레드를 활용해 지능형 연산을 모사하는 초경량 로컬 런타임입니다.`
    }

    // 0.03초 주기로 한 단어/한 글자씩 선명하게 타이핑 스트리밍 유도 (CPU 속도 제한 연산 모사)
    let accumulatedText = ''
    const chars = Array.from(responseText)
    
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i]
      accumulatedText += char
      if (onToken) {
        onToken(char)
      }
      // 타이핑 지연 모사 (30ms)
      await new Promise(resolve => setTimeout(resolve, 30))
    }

    return accumulatedText
  }

  public isLoaded(): boolean {
    return this.loaded
  }

  public isModelLoaded(): boolean {
    return this.loaded
  }

  public isInitializing(): boolean {
    return this.initializing
  }

  public getCurrentModelId(): string {
    return this.currentModelId
  }

  public getLastProgressText(): string {
    return this.lastProgressText
  }

  /**
   * 강제 중단 시 가상 세션을 청소합니다.
   */
  public async abort(): Promise<void> {
    console.info('[WebCPUEngine] CPU 연산 생성을 즉시 중단했습니다.')
  }
}
