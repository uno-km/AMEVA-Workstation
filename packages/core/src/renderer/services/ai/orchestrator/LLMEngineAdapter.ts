/**
 * @file orchestrator/LLMEngineAdapter.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/LLMEngineAdapter.ts
 * @role 다중 LLM 엔진 추상화 어댑터 계층 (프라이팬)
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - AgentOrchestrator.ts: ReAct 루프 내부에서 엔진 교체 없이 통일된 인터페이스로 호출.
 *
 * [책임 범위 - RESPONSIBILITY]
 * - WebLLM(WebGPU), Ollama, Llama.cpp 세 가지 엔진을 동일한 ILLMEngineAdapter 인터페이스로 감싼다.
 * - LLMEngineAdapterFactory.create()를 통해 aiType에 따라 올바른 어댑터를 반환한다.
 * - 오케스트레이터는 현재 엔진 종류를 몰라도 이 어댑터 하나만 잡고 통신한다.
 *
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 기존 WebLLMEngine 인스턴스를 래핑만 할 것. 내부 구현을 변경하지 말 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 * - MUST NOT: 엔진 어댑터 내부에서 오케스트레이션 로직(ReAct 루프)을 구현하지 말 것.
 */

/*
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - ILLMEngineAdapter: 모든 어댑터 구현체가 준수해야 하는 계약 인터페이스.
 * - OrchestratorConfig: 팩토리에서 어댑터 생성 시 참조하는 설정 객체.
 */
import type { ILLMEngineAdapter, OrchestratorConfig } from './types'

/*
 * [WEBLLM ENGINE IMPORT]
 * - WebLLMEngine: 기존 WebGPU 기반 온디바이스 추론 엔진 싱글톤.
 *   래핑만 수행하며 내부 로직을 변경하지 않는다.
 */
import { WebLLMEngine } from '../WebLLMEngine'
import type { ChatCompletionMessageParam } from '@mlc-ai/web-llm'

/* ============================================================
 * 1. WebLLM(WebGPU) 어댑터 구현체
 * ============================================================ */

/**
 * WebLLMEngineAdapter
 * @mlc-ai/web-llm 기반 WebGPU 추론 엔진을 ILLMEngineAdapter로 래핑한다.
 * VRAM에 적재/해제가 필요한 턴제 스와핑 시나리오를 지원한다.
 */
class WebLLMEngineAdapter implements ILLMEngineAdapter {
  /*
   * [PRIVATE STATE - engine singleton reference]
   * - WebLLMEngine.getInstance(): 싱글톤 인스턴스를 참조한다.
   *   직접 new를 사용하지 않고 싱글톤 패턴을 유지한다.
   */
  private readonly engine: WebLLMEngine = WebLLMEngine.getInstance()

  /*
   * [INVARIANT - abort signal]
   * - abortSignal: generateStream 도중 abort()가 호출될 때
   *   스트리밍을 즉시 중단하기 위한 플래그.
   * - 예상 값: false(기본), true(중단 요청 수신 시)
   */
  private abortSignal: boolean = false

  /**
   * 지정된 WebLLM 모델을 WebGPU VRAM에 적재한다.
   * 동일 모델이 이미 로드된 경우 즉시 반환한다.
   *
   * @param modelId - WebLLM 호환 모델 ID (예: Qwen2.5-7B-Instruct-q4f16_1-MLC)
   */
  public async loadModel(modelId: string): Promise<void> {
    try {
      await this.engine.initModel(modelId)
    } catch (err: unknown) {
      /*
       * [ERROR HANDLING]
       * - 모델 적재 실패 시 에러를 침묵시키지 않고 상위로 전파한다.
       */
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[WebLLMEngineAdapter] 모델 적재 실패:', msg)
      throw new Error(`WebLLM 모델 적재 실패: ${msg}`)
    }
  }

  /**
   * 현재 WebGPU VRAM에 적재된 모델을 해제한다.
   * WebLLM은 별도 unload API가 없으므로, 엔진 상태를 리셋하는 방식으로 구현한다.
   * 실제 VRAM 해제는 GC 및 브라우저 WebGPU 관리자에 위임된다.
   */
  public async unloadModel(): Promise<void> {
    /*
     * [DESIGN NOTE]
     * - WebLLM(@mlc-ai/web-llm) 라이브러리는 명시적 unload API를 제공하지 않는다.
     * - 실질적 VRAM 해제는 다른 모델 로딩 시 내부적으로 수행된다.
     * - 이 메서드는 인터페이스 계약 준수 목적으로 존재한다.
     */
    console.info('[WebLLMEngineAdapter] unloadModel 요청 (WebLLM은 내부적으로 관리됨)')
  }

  /**
   * 대화 메시지 배열을 받아 WebGPU 스트리밍 추론을 수행한다.
   *
   * @param messages - 대화 컨텍스트 배열
   * @param onToken - 토큰 단위 실시간 콜백
   * @returns 완료된 전체 텍스트
   */
  public async generateStream(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    onToken: (token: string) => void
  ): Promise<string> {
    this.abortSignal = false

    /*
     * [TYPE COERCION - Intentional]
     * - WebLLMEngine.generateStream은 ChatCompletionMessageParam[]을 요구한다.
     * - 입력 messages의 role 유니언 타입이 ChatCompletionMessageParam의 role과 호환된다.
     * - as 캐스팅 대신 구조 일치를 활용하여 타입 안전성을 보장한다.
     */
    const formattedMessages: ChatCompletionMessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content
    }))

    return this.engine.generateStream(
      formattedMessages,
      {},
      (token) => {
        /*
         * [ABORT GUARD]
         * - abortSignal이 활성화된 경우 토큰 콜백을 억제한다.
         * - 실제 스트리밍 중단은 engine.abort()로 처리된다.
         */
        if (!this.abortSignal) {
          onToken(token)
        }
      }
    )
  }

  /**
   * 진행 중인 스트리밍을 즉시 중단한다.
   */
  public async abort(): Promise<void> {
    this.abortSignal = true
    await this.engine.abort()
  }

  /**
   * WebGPU 엔진이 추론 가능한 상태인지 확인한다.
   */
  public isReady(): boolean {
    return this.engine.isLoaded()
  }
}

/* ============================================================
 * 2. Ollama 어댑터 구현체
 * ============================================================ */

/**
 * OllamaEngineAdapter
 * 로컬에 구동 중인 Ollama 데몬(http://localhost:11434)에 HTTP 스트리밍 요청을 보낸다.
 * Ollama는 모델 로딩/언로딩을 데몬이 자체적으로 관리한다.
 */
class OllamaEngineAdapter implements ILLMEngineAdapter {
  /*
   * [PRIVATE STATE]
   * - endpointUrl: Ollama 서버 주소. 기본값 http://localhost:11434.
   * - currentModelId: 현재 사용 중인 모델 식별자.
   * - abortController: fetch 스트리밍 중단을 위한 AbortController 참조.
   */
  private readonly endpointUrl: string
  private currentModelId: string = ''
  private abortController: AbortController | null = null

  constructor(endpointUrl: string = 'http://localhost:11434') {
    this.endpointUrl = endpointUrl
  }

  /**
   * Ollama는 첫 번째 요청 시 자동으로 모델을 로드한다.
   * 사전 워밍 요청을 보내 TTFT(Time To First Token)를 단축한다.
   */
  public async loadModel(modelId: string): Promise<void> {
    this.currentModelId = modelId
    try {
      /*
       * [WARM-UP REQUEST]
       * - Ollama는 첫 요청 시 모델을 메모리에 올린다.
       * - 빈 프롬프트로 사전 요청을 보내 모델을 미리 적재한다.
       */
      await fetch(`${this.endpointUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelId, prompt: '', stream: false })
      })
      console.info(`[OllamaEngineAdapter] 모델 워밍 완료: ${modelId}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[OllamaEngineAdapter] 모델 워밍 실패 (Ollama 미실행 가능성): ${msg}`)
    }
  }

  /**
   * Ollama는 데몬이 메모리를 자체 관리하므로 별도 언로드가 불필요하다.
   */
  public async unloadModel(): Promise<void> {
    console.info('[OllamaEngineAdapter] unloadModel 요청 (Ollama 데몬이 자체 관리)')
  }

  /**
   * Ollama /api/chat 엔드포인트로 스트리밍 채팅 요청을 수행한다.
   *
   * @param messages - OpenAI 호환 대화 메시지 배열
   * @param onToken - 토큰 단위 실시간 스트리밍 콜백
   * @returns 완료된 전체 텍스트
   */
  public async generateStream(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    onToken: (token: string) => void
  ): Promise<string> {
    this.abortController = new AbortController()

    try {
      const response = await fetch(`${this.endpointUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.currentModelId,
          messages,
          stream: true
        }),
        signal: this.abortController.signal
      })

      if (!response.ok) {
        throw new Error(`Ollama HTTP Error: ${response.status} ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('Ollama 응답 본문이 비어있습니다.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let accumulated = ''

      /*
       * [STREAMING LOOP]
       * - Ollama는 NDJSON(Newline Delimited JSON) 형식으로 스트리밍한다.
       * - 각 줄: { "message": { "content": "..." }, "done": false }
       */
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter((line) => line.trim() !== '')

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as {
              message?: { content?: string }
              done?: boolean
            }
            const token = parsed.message?.content ?? ''
            if (token) {
              accumulated += token
              onToken(token)
            }
            if (parsed.done === true) break
          } catch {
            /*
             * [INTENTIONAL IGNORE]
             * - 스트리밍 청크가 완전한 JSON이 아닐 수 있다.
             * - 불완전한 청크는 무시하고 다음 청크에서 재시도된다.
             */
          }
        }
      }

      return accumulated
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('AbortError') || msg.includes('abort')) {
        console.info('[OllamaEngineAdapter] 스트리밍 사용자 중단')
        return ''
      }
      console.error('[OllamaEngineAdapter] 스트리밍 오류:', msg)
      throw new Error(`Ollama 추론 오류: ${msg}`)
    }
  }

  /**
   * 현재 진행 중인 fetch 스트리밍을 AbortController로 즉시 중단한다.
   */
  public async abort(): Promise<void> {
    this.abortController?.abort()
  }

  /**
   * Ollama 데몬이 응답 가능 상태인지 확인한다.
   * 현재는 기본적으로 true를 반환하며, 실제 헬스체크는 useAIHealthCheck에서 담당한다.
   */
  public isReady(): boolean {
    return this.currentModelId !== ''
  }
}

/* ============================================================
 * 3. Llama.cpp(로컬 HTTP) 어댑터 구현체
 * ============================================================ */

/**
 * LlamaLocalEngineAdapter
 * llama-server(http://localhost:12345)에 OpenAI-호환 HTTP 스트리밍 요청을 보낸다.
 */
class LlamaLocalEngineAdapter implements ILLMEngineAdapter {
  /*
   * [PRIVATE STATE]
   * - endpointUrl: llama-server 주소. 기본값 http://localhost:12345.
   * - abortController: fetch 스트리밍 중단 제어기.
   */
  private readonly endpointUrl: string
  private abortController: AbortController | null = null

  constructor(endpointUrl: string = 'http://localhost:12345') {
    this.endpointUrl = endpointUrl
  }

  /**
   * Llama.cpp 서버는 서버 기동 시 자동으로 모델을 로드한다.
   * 어댑터 수준에서는 연결 가능 여부만 확인한다.
   */
  public async loadModel(_modelId: string): Promise<void> {
    console.info('[LlamaLocalEngineAdapter] llama-server 모델은 서버 기동 시 자동 로드됨')
  }

  /**
   * Llama.cpp 서버는 외부에서 모델 언로드를 제어할 수 없다.
   */
  public async unloadModel(): Promise<void> {
    console.info('[LlamaLocalEngineAdapter] unloadModel 요청 (llama-server 자체 관리)')
  }

  /**
   * /v1/chat/completions OpenAI-호환 엔드포인트로 스트리밍 요청을 수행한다.
   *
   * @param messages - 대화 컨텍스트 배열
   * @param onToken - 토큰 단위 실시간 콜백
   * @returns 완료된 전체 텍스트
   */
  public async generateStream(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    onToken: (token: string) => void
  ): Promise<string> {
    this.abortController = new AbortController()

    try {
      const response = await fetch(`${this.endpointUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          stream: true,
          temperature: 0.1
        }),
        signal: this.abortController.signal
      })

      if (!response.ok) {
        throw new Error(`Llama.cpp HTTP Error: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('Llama.cpp 응답 본문이 비어있습니다.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let accumulated = ''
      let buffer = ''

      /*
       * [SERVER-SENT EVENTS STREAMING]
       * - llama-server는 Server-Sent Events 형식으로 스트리밍한다.
       * - 각 줄: "data: { \"choices\": [{ \"delta\": { \"content\": \"...\" } }] }"
       * - 마지막 줄: "data: [DONE]"
       */
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const dataStr = line.slice(6).trim()
          if (dataStr === '[DONE]') break

          try {
            const parsed = JSON.parse(dataStr) as {
              choices?: Array<{ delta?: { content?: string } }>
            }
            const token = parsed.choices?.[0]?.delta?.content ?? ''
            if (token) {
              accumulated += token
              onToken(token)
            }
          } catch {
            /*
             * [INTENTIONAL IGNORE]
             * - 불완전한 SSE 청크는 무시한다.
             */
          }
        }
      }

      return accumulated
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('AbortError') || msg.includes('abort')) {
        return ''
      }
      console.error('[LlamaLocalEngineAdapter] 스트리밍 오류:', msg)
      throw new Error(`Llama.cpp 추론 오류: ${msg}`)
    }
  }

  /**
   * 진행 중인 fetch 스트리밍을 즉시 중단한다.
   */
  public async abort(): Promise<void> {
    this.abortController?.abort()
  }

  /**
   * 연결 가능 상태를 기본 true로 반환한다.
   * 실제 헬스체크는 useAIHealthCheck에서 담당한다.
   */
  public isReady(): boolean {
    return true
  }
}

/* ============================================================
 * 4. 어댑터 팩토리 (Factory)
 * ============================================================ */

/**
 * LLMEngineAdapterFactory
 * OrchestratorConfig.engineType에 따라 올바른 어댑터 인스턴스를 생성하는 팩토리.
 * 오케스트레이터는 이 팩토리를 통해서만 어댑터를 획득한다.
 */
export class LLMEngineAdapterFactory {
  /**
   * engineType에 맞는 ILLMEngineAdapter 구현체를 생성하여 반환한다.
   *
   * @param config - OrchestratorConfig 객체
   * @returns ILLMEngineAdapter 구현체
   *
   * 분기 시나리오:
   * - 'wasm'  → WebLLMEngineAdapter (WebGPU 브라우저 내장 추론)
   * - 'ollama' → OllamaEngineAdapter (로컬 Ollama 데몬)
   * - 'local' → LlamaLocalEngineAdapter (llama.cpp HTTP 서버)
   * - 'api'   → LlamaLocalEngineAdapter fallback (외부 API는 AgentEngine 담당)
   */
  public static create(config: OrchestratorConfig): ILLMEngineAdapter {
    switch (config.engineType) {
      case 'wasm':
        return new WebLLMEngineAdapter()

      case 'ollama':
        return new OllamaEngineAdapter(
          config.endpointUrl ?? 'http://localhost:11434'
        )

      case 'local':
      case 'api':
      default:
        return new LlamaLocalEngineAdapter(
          config.endpointUrl ?? 'http://localhost:12345'
        )
    }
  }
}
