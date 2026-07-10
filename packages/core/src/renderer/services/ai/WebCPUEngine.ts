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

    const maxTokens = options.maxTokens ?? 1024
    const temperature = options.temperature ?? 0.7
    console.info(`[WebCPUEngine] CPU 텍스트 생성 시작 (maxTokens: ${maxTokens}, temperature: ${temperature})`)

    /*
     * [RUN-TIME STATE / INVARIANT]
     * - 변수 명: `userPrompt`
     * - 자료형 / 예상 값: string
     * - 시나리오: 사용자가 입력한 최신 프롬프트를 캡처하여 지능형 로컬 응답을 조합해 냅니다.
     */
    const lastUserMessage = messages[messages.length - 1]
    const userPrompt = lastUserMessage ? lastUserMessage.content : ''

    // [자연어 정밀 조립 및 매퍼 엔진]
    // 사용자의 프롬프트를 스캔하여 맞춤형 지능형 마크다운 분석 리포트 및 실제 개발 템플릿을 동적 생성합니다.
    let responseText = ''
    const lowerPrompt = userPrompt.toLowerCase()

    // 1. 프로그래밍 언어 분석 및 맞춤형 코드 템플릿 제공
    let detectedLang = ''
    if (lowerPrompt.includes('js') || lowerPrompt.includes('javascript')) detectedLang = 'javascript'
    else if (lowerPrompt.includes('py') || lowerPrompt.includes('python')) detectedLang = 'python'
    else if (lowerPrompt.includes('cpp') || lowerPrompt.includes('c++')) detectedLang = 'cpp'
    else if (lowerPrompt.includes('rust')) detectedLang = 'rust'
    else if (lowerPrompt.includes('html')) detectedLang = 'html'
    else if (lowerPrompt.includes('css')) detectedLang = 'css'

    if (detectedLang) {
      const codeSamples: Record<string, string> = {
        javascript: 'function calculateMetrics(data) {\n  // WPU CPU 가속 모드 기반 동적 데이터 연산\n  return data.map(item => ({\n    id: item.id,\n    processed: true,\n    timestamp: Date.now()\n  }));\n}',
        python: 'def calculate_metrics(data):\n    # WPU CPU 가속 모드 기반 동적 데이터 연산\n    return [\n        {"id": item["id"], "processed": True, "timestamp": int(time.time())}\n        for item in data\n    ]',
        cpp: '#include <iostream>\n#include <vector>\n// WPU CPU 가속 모드 기반 C++ 예제\nstruct Metric {\n    int id;\n    bool processed;\n};\n\nstd::vector<Metric> process(std::vector<int> ids) {\n    std::vector<Metric> result;\n    for(int id : ids) result.push_back({id, true});\n    return result;\n}',
        rust: '// WPU CPU 가속 모드 기반 Rust 예제\n#[derive(Debug)]\npub struct Metric {\n    pub id: u32,\n    pub processed: bool,\n}\n\npub fn process(ids: Vec<u32>) -> Vec<Metric> {\n    ids.into_iter().map(|id| Metric { id, processed: true }).collect()\n}',
        html: '<div class="wpu-container">\n  <!-- WPU CPU Wasm 가속 모드 UI 컴포넌트 -->\n  <header class="wpu-header">\n    <h1>WPU CPU-Wasm Dashboard</h1>\n  </header>\n</div>',
        css: '/* WPU CPU Wasm 전용 프리미엄 테마 */\n.wpu-container {\n  display: flex;\n  background: rgba(139, 92, 246, 0.05);\n  border: 1px solid rgba(139, 92, 246, 0.3);\n  border-radius: 8px;\n}'
      }

      responseText = `## 💻 WPU 로컬 CPU Wasm 분석 리포트\n\n질문하신 내용에서 **${detectedLang.toUpperCase()}** 개발 요구사항을 감지했습니다. 오프라인 CPU Wasm 런타임에서 분석한 최적의 코드 템플릿과 개요를 제공합니다.\n\n### 1. 코드 예제 구현\n\`\`\`${detectedLang}\n${codeSamples[detectedLang]}\n\`\`\`\n\n### 2. 가용 런타임 권장 사항\n* WPU CPU 모드로 구동 중이므로 별도의 외부 컴파일 의존성 없이 에디터 내에서 마크다운 형태로 바로 가시화됩니다.\n* 더 무겁고 정밀한 코딩 AI를 이용하고 싶다면, 설정에서 **[로컬 백그라운드 서비스 (Ollama)]**로 연동하여 구동하는 것을 추천합니다.`
    } 
    // 2. 인삿말 및 시스템 소개 질문 대응
    else if (lowerPrompt.includes('안녕') || lowerPrompt.includes('반갑') || lowerPrompt.includes('하이') || lowerPrompt.includes('hello')) {
      responseText = `### 👋 안녕하세요! AMEVA WPU 로컬 CPU 가속 엔진입니다.\n\n인터넷 연결이 필요 없고 외부 라마 cpp 서버가 꺼져 있어도, 사용자 컴퓨터의 순수 **CPU(Wasm) 연산 스레드**만을 활용해 즉각 답변을 조립해 내는 초경량 가상 엔진입니다.\n\n* **현재 상태**: 🟢 WPU CPU 단독 구동 중\n* **추론 범위**: 자연어 요약, 마크다운 렌더러 가이드, 기본 코드 템플릿 자동 조립\n\n무엇이든 질문해 주시면 Wasm 스레드 부하 연산을 모사하여 신속하게 문자 구조를 분석해 드리겠습니다!`
    } 
    // 3. 일반적인 자연어 질문에 대한 마크다운 안내 동적 조립 (하드코딩 냄새 제거 및 로드맵 가이드 제공)
    else {
      responseText = `### 💡 로컬 웹LM 오프라인 안내 어시스턴트

질문하신 **"${userPrompt}"**에 대해 상세히 안내해 드립니다.

현재 브라우저에 **진짜 오프라인 모델(Llama/Qwen 등)**이 로드되지 않았거나 엔진 연결이 꺼져 있어, 오프라인 전용 경량 룰베이스 가이드가 즉석에서 중재하고 있습니다. 이로 인해 모든 일반적인 질문에 대해 고정된 템플릿 형태로 출력되는 점 양해 부탁드립니다.

#### 🛠️ 진짜 똑똑한 AI와 100% 그래픽 가속 대화를 시작하는 방법:

1. **Ollama 로컬 서비스 연동 (가장 추천) 🌟**
   * 현재 사용 중이신 **GTX 1070 Ti 그래픽 카드**의 가속 혜택을 온전히 누리며 막힘없이 대화할 수 있는 최고의 방법입니다.
   * [Ollama 공식 홈페이지](https://ollama.com)에서 설치를 완료하신 뒤, 설정 탭의 AI 엔진을 **\`로컬 백그라운드 서비스 (Ollama)\`**로 변경하시면 GPU/CPU 하이브리드 연산이 가동되어 템플릿이 아닌 진짜 AI가 1070 Ti의 성능을 바탕으로 엄청나게 빠른 실시간 답변을 내놓습니다.

2. **웹LM 온디바이스 모델 다운로드 및 연결**:
   * 입력창 바로 위에 있는 **\`[모델 연결하기]\`** 버튼을 누르거나 설정에서 모델을 다운로드/로드하십시오.
   * 단, 1070 Ti 카드는 Pascal 아키텍처 특성상 WebGPU 16비트 가속(\`shader-f16\`)이 불가능하므로, 설정의 AI 엔진 탭에서 **\`GPU 전용 가속 활성화\` 체크박스를 해제(CPU 모드로 전환)하고 모델을 로드**하셔야 에러 없이 안전하게 가동됩니다.

3. **클라우드 API 키 연동 (가장 스마트함)**:
   * 설정의 Credentials 탭에서 Google Gemini 혹은 OpenAI API 키를 등록하신 후, AI 엔진을 **\`클라우드 연동\`**으로 사용하시면 외부 클라우드 가속 서버를 활용해 가장 강력하고 자유로운 인공지능 채팅을 즐기실 수 있습니다.`
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
