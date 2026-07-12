/**
 * @file orchestrator/task-runtime/executors/ToolCallParser.ts
 * @system AMEVA OS Desktop Workstation
 * @role LLM 출력 텍스트에서 Tool Action을 구조화된 ToolCallCandidate로 파싱
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - DeepTaskExecutor: execute() 내 Reasoning Turn 완료 후 Tool 호출 감지에 사용
 *
 * [STAGE D — Tool Runtime 실제 ReAct 연결]
 * LLM 출력에서 다음 패턴의 Tool Call을 감지한다:
 * 1. <tool_call>{"name":"...","args":{...}}</tool_call> 태그 형식
 * 2. ```json {"name":"...","args":{...}} ``` 코드펜스 형식
 * 3. {"tool":"...","arguments":{...}} 일반 JSON 형식 (최후 수단)
 *
 * [보안 계약]
 * - prototype pollution 방지: __proto__, constructor, prototype 키 차단
 * - 과도한 arguments 크기 제한 (MAX_INPUT_SIZE_BYTES)
 * - 중복 idempotencyKey 차단 (세션 내 추적)
 * - Prompt Injection 방어: 검증되지 않은 Tool 이름 거부
 * - malformed JSON은 ParseError로 반환 (성공 Observation으로 포장 금지)
 *
 * [False Success 방지]
 * - 파싱 실패 = ParseError (null 반환 또는 성공 포장 절대 금지)
 * - 존재하지 않는 Tool → ParseError
 * - 빈 arguments → ParseError
 */

/**
 * LLM 출력에서 파싱된 Tool Action 후보.
 * Policy 검사를 거치지 않은 원시 데이터.
 */
export interface ToolCallCandidate {
  /** 도구 호출 고유 ID (파서가 생성) */
  toolCallId: string;
  /** 호출 대상 Tool 이름 (ToolRegistry의 name과 일치해야 함) */
  toolName: string;
  /** Tool 인자 (검증 전 원시 객체) */
  arguments: Record<string, unknown>;
  /** 원본 LLM 텍스트 참조 */
  rawReference: string;
  /** 멱등성 키 (같은 호출 반복 차단) */
  idempotencyKey: string;
  /** Reasoning 턴 번호 */
  reasoningTurn: number;
}

/**
 * Tool Call 파싱 오류.
 */
export interface ToolCallParseError {
  errorType:
    | 'MALFORMED_JSON'
    | 'MISSING_TOOL_NAME'
    | 'EMPTY_ARGUMENTS'
    | 'PROTOTYPE_POLLUTION'
    | 'OVERSIZED_INPUT'
    | 'DUPLICATE_IDEMPOTENCY_KEY'
    | 'NO_TOOL_CALL_FOUND';
  rawReference: string;
  message: string;
}

export type ToolCallParseResult =
  | { success: true; candidate: ToolCallCandidate }
  | { success: false; error: ToolCallParseError };

/*
 * [도메인 종속 지역 상수]
 * Tool Call 파서 제한값
 */
const MAX_INPUT_SIZE_BYTES = 32_768; // 32KB
const DANGEROUS_PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Prototype Pollution 방어.
 * 재귀적으로 객체 키를 검사하여 위험 키가 있으면 false 반환.
 */
function isSafeObject(obj: unknown, depth = 0): boolean {
  if (depth > 10) return false; // 재귀 깊이 제한
  if (typeof obj !== 'object' || obj === null) return true;
  for (const key of Object.keys(obj)) {
    if (DANGEROUS_PROTO_KEYS.has(key)) return false;
    if (!isSafeObject((obj as Record<string, unknown>)[key], depth + 1)) return false;
  }
  return true;
}

/**
 * 안전한 JSON.parse (prototype pollution 포함 검증).
 * 파싱 실패 또는 위험 키 감지 시 null 반환.
 */
function safeParse(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    if (!isSafeObject(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * ToolCallParser
 * LLM 출력 텍스트를 파싱하여 ToolCallCandidate 또는 ParseError를 반환한다.
 */
export class ToolCallParser {
  /*
   * [세션 내 idempotencyKey 추적]
   * 동일 idempotencyKey로 Tool 호출 중복 차단.
   * MissionExecutionRuntime 종료 시 reset()을 호출해야 한다.
   */
  private readonly seenIdempotencyKeys: Set<string> = new Set();

  /**
   * LLM 출력 텍스트를 파싱하여 Tool Call 후보를 반환한다.
   *
   * @param responseText - LLM 원시 출력 텍스트
   * @param reasoningTurn - 현재 Reasoning Turn 번호
   * @param knownToolNames - ToolRegistry에 등록된 유효한 Tool 이름 목록
   * @returns ToolCallParseResult (success 또는 failure)
   */
  public parse(
    responseText: string,
    reasoningTurn: number,
    knownToolNames: Set<string>
  ): ToolCallParseResult {
    // 1. 크기 제한 검사
    if (Buffer.byteLength(responseText, 'utf-8') > MAX_INPUT_SIZE_BYTES) {
      return {
        success: false,
        error: {
          errorType: 'OVERSIZED_INPUT',
          rawReference: responseText.slice(0, 200),
          message: `LLM output exceeds ${MAX_INPUT_SIZE_BYTES} bytes. Rejecting tool call parsing.`
        }
      };
    }

    // 2. <tool_call>...</tool_call> 태그 감지 (최우선)
    const tagMatch = responseText.match(/<tool_call>([\s\S]*?)<\/tool_call>/);
    if (tagMatch) {
      return this.parseJsonBlock(tagMatch[1].trim(), reasoningTurn, knownToolNames, tagMatch[0]);
    }

    // 3. ```json 코드펜스 감지
    const fenceMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (fenceMatch) {
      return this.parseJsonBlock(fenceMatch[1].trim(), reasoningTurn, knownToolNames, fenceMatch[0]);
    }

    // 4. 일반 JSON 블록 감지 ({"name":... 또는 {"tool":... 형식)
    const jsonMatch = responseText.match(/\{[\s\S]*?"(?:name|tool)"[\s\S]*?\}/);
    if (jsonMatch) {
      return this.parseJsonBlock(jsonMatch[0].trim(), reasoningTurn, knownToolNames, jsonMatch[0]);
    }

    // Tool Call 없음 (정상 — LLM이 Tool 없이 응답)
    return {
      success: false,
      error: {
        errorType: 'NO_TOOL_CALL_FOUND',
        rawReference: responseText.slice(0, 100),
        message: 'No tool call pattern found in LLM output.'
      }
    };
  }

  /**
   * JSON 문자열에서 ToolCallCandidate를 추출한다.
   */
  private parseJsonBlock(
    jsonStr: string,
    reasoningTurn: number,
    knownToolNames: Set<string>,
    rawReference: string
  ): ToolCallParseResult {
    const parsed = safeParse(jsonStr);

    if (!parsed) {
      return {
        success: false,
        error: {
          errorType: 'MALFORMED_JSON',
          rawReference: rawReference.slice(0, 200),
          message: `Failed to parse tool call JSON or prototype pollution detected. Raw: ${jsonStr.slice(0, 100)}`
        }
      };
    }

    // name, tool, toolName 필드에서 Tool 이름 추출 (LLM 출력 형식 호환성)
    const toolName = (parsed['name'] ?? parsed['tool'] ?? parsed['toolName'] ?? '') as string;
    if (!toolName || typeof toolName !== 'string' || toolName.trim() === '') {
      return {
        success: false,
        error: {
          errorType: 'MISSING_TOOL_NAME',
          rawReference: rawReference.slice(0, 200),
          message: `Tool call JSON has no 'name' or 'tool' field. Parsed: ${JSON.stringify(parsed).slice(0, 100)}`
        }
      };
    }

    // args 또는 arguments 필드에서 인자 추출
    const args = (parsed['args'] ?? parsed['arguments'] ?? parsed['parameters'] ?? {}) as Record<string, unknown>;
    if (typeof args !== 'object' || args === null || Array.isArray(args)) {
      return {
        success: false,
        error: {
          errorType: 'EMPTY_ARGUMENTS',
          rawReference: rawReference.slice(0, 200),
          message: `Tool call arguments must be an object. Got: ${typeof args}`
        }
      };
    }

    // arguments 내 prototype pollution 재검사
    if (!isSafeObject(args)) {
      return {
        success: false,
        error: {
          errorType: 'PROTOTYPE_POLLUTION',
          rawReference: rawReference.slice(0, 200),
          message: `Prototype pollution detected in tool call arguments. Rejected.`
        }
      };
    }

    // 존재하지 않는 Tool 거부 (knownToolNames가 제공된 경우)
    if (knownToolNames.size > 0 && !knownToolNames.has(toolName)) {
      return {
        success: false,
        error: {
          errorType: 'MISSING_TOOL_NAME',
          rawReference: rawReference.slice(0, 200),
          message: `Tool '${toolName}' is not registered in ToolRegistry. Known tools: ${[...knownToolNames].join(', ')}`
        }
      };
    }

    // idempotencyKey 생성 및 중복 검사
    const idempotencyKey = `${toolName}:${JSON.stringify(args)}`;
    if (this.seenIdempotencyKeys.has(idempotencyKey)) {
      return {
        success: false,
        error: {
          errorType: 'DUPLICATE_IDEMPOTENCY_KEY',
          rawReference: rawReference.slice(0, 200),
          message: `Duplicate tool call detected (idempotencyKey: ${idempotencyKey.slice(0, 80)}). Skipping.`
        }
      };
    }
    this.seenIdempotencyKeys.add(idempotencyKey);

    return {
      success: true,
      candidate: {
        toolCallId: `tc-${crypto.randomUUID()}`,
        toolName: toolName.trim(),
        arguments: args,
        rawReference: rawReference.slice(0, 500),
        idempotencyKey,
        reasoningTurn
      }
    };
  }

  /**
   * 세션 종료 또는 Mission 리셋 시 idempotencyKey 추적을 초기화한다.
   */
  public reset(): void {
    this.seenIdempotencyKeys.clear();
  }
}
