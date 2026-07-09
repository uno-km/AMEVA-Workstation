/**
 * @file WebLLMEngine.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/WebLLMEngine.ts
 * @role WebGPU 기반 온디바이스 로컬 AI 추론 엔진 싱글톤 서비스
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/hooks/ai/useAIGenerator.ts): AI 채팅 패널에서 WGU(WebGPU) 모드 선택 시 스트리밍 토큰 생성 요청 처리.
 * - 소비처 B (src/renderer/hooks/ai/useAIBlockProcessor.ts): 문서 에디터 블록 생성/수정/요약 시 WebGPU 모드 추론 처리.
 * - 소비처 C (src/renderer/hooks/ai/useAIHealthCheck.ts): WebGPU 장치 가용 여부 및 초기화 완료 상태(`isLoaded`) 조회.
 * - 소비처 D (src/renderer/components/settings/SettingsTabAIEngine.tsx): WebGPU 호환 모델 가중치 초기 다운로드 진행률, 장치 진단 및 isModelLoaded() 상태 조회.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - `@mlc-ai/web-llm` 라이브러리를 활용하여 브라우저 내부 및 WebGPU 가속 하드웨어와 직접 연동한다.
 * - Llama.cpp(`llama-server`)와의 의존성을 100% 분리하여 독립적으로 브라우저 캐시 및 VRAM을 관리한다.
 * - DirectX 12 / Vulkan 백엔드를 통한 그래픽 가속 상태 및 최대 버퍼 크기를 사전에 진단한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그 및 콜백으로 전파할 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

/*
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - CreateMLCEngine: 런타임에 실제로 호출되는 팩토리 함수이므로 일반 import 사용.
 * - MLCEngineInterface / InitProgressReport / ChatCompletionMessageParam: 타입 전용 심볼.
 *   verbatimModuleSyntax 컴파일러 옵션 활성 시 타입 심볼은 반드시 `import type`으로
 *   분리해야 하며, 그렇지 않으면 ESM emit 단계에서 컴파일 오류가 발생한다.
 */
import { CreateMLCEngine } from '@mlc-ai/web-llm'
import type { MLCEngineInterface, InitProgressReport, ChatCompletionMessageParam } from '@mlc-ai/web-llm'

/*
 * [WEBGPU TYPE AUGMENTATION]
 * - 표준 TypeScript DOM 라이브러리(`lib.dom.d.ts`)에 WebGPU API(`navigator.gpu`,
 *   `GPUAdapter`, `GPUSupportedLimits` 등)가 아직 포함되지 않은 버전에서
 *   `navigator.gpu`에 접근할 때 타입 에러가 발생한다.
 * - 아래 선언은 글로벌 `Navigator` 인터페이스를 확장하여 WebGPU 관련 프로퍼티의
 *   타입 정보를 최소한으로 보강한다. 런타임 동작에는 어떠한 영향도 주지 않는다.
 * - 향후 TypeScript가 WebGPU 타입을 공식 지원하면 이 블록을 안전하게 제거할 수 있다.
 */
declare global {
  interface GPUSupportedLimits {
    /** 스토리지 버퍼 바인딩 최대 크기 (바이트 단위). DirectX12/Vulkan 사양에 따라 결정됨. */
    maxStorageBufferBindingSize?: number
  }

  interface GPUAdapter {
    /** 이 어댑터가 지원하는 하드웨어 제한 사양 집합. */
    readonly limits: GPUSupportedLimits
  }

  interface GPU {
    /** 가용한 GPU 어댑터를 비동기로 요청한다. VRAM 없거나 드라이버 미지원 시 null 반환. */
    requestAdapter(): Promise<GPUAdapter | null>
  }

  interface Navigator {
    /** WebGPU 진입점. 미지원 브라우저/OS에서는 undefined일 수 있다. */
    readonly gpu: GPU | undefined
  }
}

/**
 * WebLLM 추론 생성 옵션 규격 인터페이스
 */
export interface WebLLMGenerateOptions {
  /** 생성 최대 토큰 수 */
  maxTokens?: number
  /** 생성 온도 (창의성) */
  temperature?: number
  /** 시스템 프롬프트 문구 */
  systemPrompt?: string
}

/**
 * WebGPU 장치 사양 진단 결과 인터페이스
 */
export interface WebGPUDiagnosticResult {
  /** WebGPU 지원 여부 */
  supported: boolean
  /** 진단 메시지 또는 실패 원인 */
  message: string
  /** 최대 버퍼 바인딩 크기 (바이트 단위, 지원 시) */
  maxStorageBufferBindingSize?: number
}

/**
 * WebGPU 기반 온디바이스 LLM 엔진을 제어하는 싱글톤 클래스
 */
export class WebLLMEngine {
  /** 싱글톤 내부 인스턴스 참조 보관용 static 프로퍼티 */
  private static instance: WebLLMEngine | null = null

  /** 활성화된 MLCEngine 인터페이스 인스턴스 */
  private engine: MLCEngineInterface | null = null

  /** 현재 로드된 모델 식별자 (예: Qwen2.5-1.5B-Instruct-q4f16_1-MLC) */
  private currentModelId: string = ''

  /** 모델 다운로드 및 초기화 완료 여부 플래그 */
  private loaded: boolean = false

  /** 모델 초기화 진행 중 여부 락 플래그 */
  private initializing: boolean = false

  /** 최근 로드 진행률 메시지 캐시 */
  private lastProgressText: string = ''

  /**
   * 외부 생성자 호출을 차단하여 싱글톤 원칙을 강제하는 private 생성자
   */
  private constructor() {}

  /**
   * WebLLMEngine의 유일한 싱글톤 인스턴스를 반환한다.
   * 
   * [RUN-TIME STATE / INVARIANT]
   * - 변수 명: `WebLLMEngine.instance`
   * - 자료형 / 예상 값: WebLLMEngine 인스턴스 또는 null.
   * - 시나리오: 애플리케이션 수명 주기 내 단 하나의 인스턴스만 보존하여 VRAM 및 Wasm 엔진 중복 로딩을 방지한다.
   */
  public static getInstance(): WebLLMEngine {
    /*
     * [ALGORITHM BRANCH / DECISION]
     * - 조건 식: `!WebLLMEngine.instance`
     * - 만족 시: 인스턴스가 아직 없으므로 최초 1회 생성하여 static 변수에 할당한다.
     * - 불만족 시: 기존 할당된 인스턴스를 그대로 반환한다.
     * - 예시 코드: `if (!WebLLMEngine.instance) { ... }`
     */
    if (!WebLLMEngine.instance) {
      WebLLMEngine.instance = new WebLLMEngine()
    }
    return WebLLMEngine.instance
  }

  /**
   * 현재 브라우저 및 호스트 PC가 WebGPU(DirectX 12 / Vulkan) 가속을 지원하는지 진단한다.
   */
  public async checkWebGPUSupport(): Promise<WebGPUDiagnosticResult> {
    /*
     * [ALGORITHM BRANCH / DECISION]
     * - 조건 식: `typeof navigator === 'undefined' || !navigator.gpu`
     * - 만족 시: WebGPU API가 브라우저/OS 레벨에서 비활성화되었거나 미지원 상태이므로 실패를 반환한다.
     * - 불만족 시: GPU 어댑터 및 버퍼 바인딩 크기 사양 검사로 진입한다.
     */
    if (typeof navigator === 'undefined' || !navigator.gpu) {
      return {
        supported: false,
        message: '현재 환경(브라우저/OS)에서 navigator.gpu API를 지원하지 않습니다.'
      }
    }

    try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `adapter`
       * - 자료형 / 예상 값: GPUAdapter 인스턴스 또는 null.
       * - 시나리오: DirectX 12 또는 Vulkan을 사용하는 실제 디스플레이 어댑터 핸들을 획득한다.
       * - 예시 코드: `const adapter = await navigator.gpu.requestAdapter()`
       */
      const adapter = await navigator.gpu.requestAdapter()

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!adapter`
       * - 만족 시: WebGPU API는 존재하나 하드웨어 어댑터 획득에 실패한 경우이므로 에러 메시지를 반환한다.
       * - 불만족 시: 어댑터 제한 사양을 파악하여 지원 판정을 내린다.
       */
      if (!adapter) {
        return {
          supported: false,
          message: 'WebGPU 어댑터를 획득할 수 없습니다. 그래픽 드라이버 상태를 확인해주세요.'
        }
      }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `limits`
       * - 자료형 / 예상 값: GPUSupportedLimits 객체.
       * - 시나리오: 어댑터가 허용하는 최대 버퍼 바인딩 크기 및 그래픽 제한 사항을 확인한다.
       * - 예시 코드: `const limits = adapter.limits`
       */
      const limits = adapter.limits
      const maxBuffer = limits.maxStorageBufferBindingSize || 0

      return {
        supported: true,
        message: 'DirectX 12/Vulkan 기반 WebGPU 가속이 정상 작동 중입니다.',
        maxStorageBufferBindingSize: maxBuffer
      }
    } catch (err: unknown) {
      /*
       * [ERROR HANDLING - EXCEPTION LOGGING]
       * - WebGPU 어댑터 요청 중 예기치 못한 하드웨어/드라이버 예외 발생 시 에러를 기록하고 전파한다.
       */
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('[WebLLMEngine] WebGPU 사양 진단 중 오류 발생:', errorMessage)
      return {
        supported: false,
        message: `WebGPU 진단 오류: ${errorMessage}`
      }
    }
  }

  /**
   * 지정된 WebLLM 모델 식별자로 WebGPU 엔진을 초기화하고 가중치를 브라우저 스토리지가 로드한다.
   * 
   * @param modelId 로드할 모델 식별자 (예: Qwen2.5-1.5B-Instruct-q4f16_1-MLC)
   * @param onProgress 모델 다운로드 및 GPU 셰이더 컴파일 진행률 콜백
   */
  public async initModel(
    modelId: string,
    onProgress?: (progress: InitProgressReport) => void
  ): Promise<boolean> {
    /*
     * [ALGORITHM BRANCH / DECISION]
     * - 조건 식: `this.loaded && this.currentModelId === modelId && this.engine`
     * - 만족 시: 동일한 모델이 이미 로드 및 활성화된 상태이므로 중복 다운로드를 건너뛴다.
     * - 불만족 시: 신규 로딩 절차로 진입한다.
     */
    if (this.loaded && this.currentModelId === modelId && this.engine) {
      return true
    }

    /*
     * [ALGORITHM BRANCH / DECISION]
     * - 조건 식: `this.initializing`
     * - 만족 시: 다른 스레드나 컴포넌트에서 초기화가 이미 진행 중이므로 동시 로딩을 차단한다.
     * - 불만족 시: 초기화 락을 획득하고 로딩을 시작한다.
     */
    if (this.initializing) {
      console.warn('[WebLLMEngine] 이미 WebGPU 모델 초기화가 진행 중입니다. 완료될 때까지 대기합니다.')
      return false
    }

    this.initializing = true
    this.loaded = false

    try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `diag`
       * - 자료형 / 예상 값: WebGPUDiagnosticResult 객체.
       * - 시나리오: 기동 직전 하드웨어 백엔드가 가용 상태인지 재확인한다.
       */
      const diag = await this.checkWebGPUSupport()
      if (!diag.supported) {
        throw new Error(diag.message)
      }

      console.info(`[WebLLMEngine] 모델 초기화 시작: ${modelId} (WebGPU 백엔드 가동)`)

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `engineInstance`
       * - 자료형 / 예상 값: MLCEngineInterface 인스턴스.
       * - 시나리오: @mlc-ai/web-llm 라이브러리를 통해 Wasm 셰이더를 초기화하고 캐시에서 모델을 로드한다.
       */
      const engineInstance = await CreateMLCEngine(modelId, {
        initProgressCallback: (progress: InitProgressReport) => {
          this.lastProgressText = progress.text
          if (onProgress) {
            onProgress(progress)
          }
        }
      })

      this.engine = engineInstance
      this.currentModelId = modelId
      this.loaded = true
      this.initializing = false
      console.info(`[WebLLMEngine] 모델 로딩 및 GPU 가속 준비 완료: ${modelId}`)
      return true
    } catch (err: unknown) {
      /*
       * [ERROR HANDLING - EXCEPTION LOGGING]
       * - 초기화 실패 시 인스턴스를 초기화하고 예외를 명확히 기록한다.
       */
      this.engine = null
      this.loaded = false
      this.initializing = false
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.error('[WebLLMEngine] 모델 초기화 실패:', errorMsg)
      throw new Error(`WebGPU 모델 초기화 실패: ${errorMsg}`)
    }
  }

  /**
   * 대화 메시지 목록을 받아 WebGPU 가속 기반으로 스트리밍 추론을 수행한다.
   * 
   * @param messages 대화 컨텍스트 메시지 배열
   * @param options 생성 파라미터 (temperature, maxTokens 등)
   * @param onToken 각 토큰이 생성될 때마다 호출되는 실시간 콜백
   * @returns 최종 완료된 전체 텍스트 문자열
   */
  public async generateStream(
    messages: ChatCompletionMessageParam[],
    options: WebLLMGenerateOptions = {},
    onToken?: (tokenText: string) => void
  ): Promise<string> {
    /*
     * [ALGORITHM BRANCH / DECISION]
     * - 조건 식: `!this.engine || !this.loaded`
     * - 만족 시: 모델이 준비되지 않은 상태에서 호출되었으므로 예외를 발생시킨다.
     * - 불만족 시: 스트리밍 파이프라인 연산을 시작한다.
     */
    if (!this.engine || !this.loaded) {
      throw new Error('WebGPU 모델이 준비되지 않았습니다. 설정이나 상태바에서 모델을 로드해주세요.')
    }

    try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `formattedMessages`
       * - 자료형 / 예상 값: ChatCompletionMessageParam[] 배열.
       * - 시나리오: 시스템 프롬프트가 존재할 경우 첫 번째 노드로 삽입하여 메시지 목록을 구성한다.
       * - 예시 코드: `const formattedMessages = [ { role: 'system', content: ... }, ...messages ]`
       */
      const formattedMessages: ChatCompletionMessageParam[] = []

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `options.systemPrompt && options.systemPrompt.trim() !== ''`
       * - 만족 시: 시스템 지시문을 첫 항목으로 추가한다.
       * - 불만족 시: 전달받은 기존 메시지 배열만 구성한다.
       */
      if (options.systemPrompt && options.systemPrompt.trim() !== '') {
        formattedMessages.push({
          role: 'system',
          content: options.systemPrompt
        })
      }

      formattedMessages.push(...messages)

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `asyncChunkGenerator`
       * - 자료형 / 예상 값: AsyncGenerator<ChatCompletionChunk, void, unknown>.
       * - 시나리오: MLCEngine의 스트리밍 API를 호출하여 청크 단위로 토큰을 수신한다.
       */
      const asyncChunkGenerator = await this.engine.chat.completions.create({
        messages: formattedMessages,
        stream: true,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1024
      })

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `accumulatedText`
       * - 자료형 / 예상 값: string.
       * - 시나리오: 스트리밍 도중 수신된 청크들을 하나로 합산하여 최종 결과를 구축한다.
       */
      let accumulatedText = ''

      /*
       * [LOOP CONTROL / GENERATOR CONSUMPTION]
       * - 조건 식: `for await (const chunk of asyncChunkGenerator)`
       * - 시나리오: 각 스트림 청크에서 delta.content를 추출하여 콜백으로 전달 및 누적한다.
       */
      for await (const chunk of asyncChunkGenerator) {
        const delta = chunk.choices[0]?.delta?.content || ''
        if (delta) {
          accumulatedText += delta
          if (onToken) {
            onToken(delta)
          }
        }
      }

      return accumulatedText
    } catch (err: unknown) {
      /*
       * [ERROR HANDLING - EXCEPTION LOGGING]
       * - 추론 중 예외(GPU VRAM 부족, 셰이더 크래시 등) 발생 시 에러를 기록하고 외부로 전파한다.
       */
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.error('[WebLLMEngine] 스트리밍 생성 중 오류 발생:', errorMsg)
      throw new Error(`WebGPU 추론 오류: ${errorMsg}`)
    }
  }

  /**
   * 진행 중인 생성 작업을 강제 중단하고 필요 시 VRAM 버퍼를 정리한다.
   */
  public async abort(): Promise<void> {
    /*
     * [ALGORITHM BRANCH / DECISION]
     * - 조건 식: `this.engine`
     * - 만족 시: 엔진의 interrupt 또는 unload 인터페이스가 있다면 호출하여 안전하게 중지한다.
     * - 불만족 시: 엔진이 없으므로 조용히 리턴한다.
     */
    if (this.engine && typeof this.engine.interruptGenerate === 'function') {
      try {
        await this.engine.interruptGenerate()
        console.info('[WebLLMEngine] 현재 진행 중인 WebGPU 연산을 중단했습니다.')
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error('[WebLLMEngine] 중단 요청 중 예외 발생:', errorMsg)
      }
    }
  }

  /**
   * 모델 로드 완료 여부를 반환한다.
   * 
   * [소비처 - CONSUMERS]
   * - 내부 메서드 및 generateStream 진입 전 guard 체크에서 사용.
   */
  public isLoaded(): boolean {
    return this.loaded
  }

  /**
   * 모델 로드 완료 여부를 반환한다. (isLoaded의 공개 별칭 메서드)
   * 
   * [소비처 - CONSUMERS]
   * - 소비처 A (src/renderer/components/settings/SettingsTabAIEngine.tsx): UI 상태 배지 표시용.
   * 
   * [계약 - CONTRACT]
   * - 이 메서드는 isLoaded()와 완전히 동일한 값을 반환하며, 별도 상태를 관리하지 않는다.
   */
  public isModelLoaded(): boolean {
    return this.loaded
  }

  /**
   * 모델 초기화 진행 중 여부를 반환한다.
   */
  public isInitializing(): boolean {
    return this.initializing
  }

  /**
   * 현재 로드된 모델 ID를 반환한다.
   */
  public getCurrentModelId(): string {
    return this.currentModelId
  }

  /**
   * 가장 최근에 갱신된 로딩 진행 메시지를 반환한다.
   */
  public getLastProgressText(): string {
    return this.lastProgressText
  }
}
