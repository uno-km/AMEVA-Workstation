/**
 * @file orchestrator/ToolRegistry.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/ToolRegistry.ts
 * @role 에이전트 도구 등록 및 실행 중앙 레지스트리 (도구함)
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - AgentOrchestrator.ts: ReAct 루프 내 Tool Call 감지 시 executeTool()을 호출하여 실행.
 * - useAIAgentMode.ts: 오케스트레이터 세션 생성 전 도구 등록(registerDefaultTools) 수행.
 *
 * [책임 범위 - RESPONSIBILITY]
 * - 에이전트가 사용할 수 있는 도구(Tool)를 이름 기반 Map에 등록하고 실행한다.
 * - MCP(Model Context Protocol) 도구와 WASM C-Kernel 호스트 명령을 모두 지원한다.
 * - 기존 agentTools.ts의 AgentEngine 도구 등록 방식과 동일한 인터페이스를 제공한다.
 *
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: executeTool()은 절대 예외를 침묵시키지 말고 ToolCallResult.error로 반환할 것.
 * - MUST NOT: ToolRegistry 내부에서 ReAct 루프 로직을 구현하지 말 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

/*
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - ToolDefinition: 도구 명세 인터페이스 (name, description, parameters, execute).
 * - ToolCallResult: 도구 실행 결과 구조체.
 */
import type { ToolDefinition, ToolCallResult } from './types'
import { DiffUtils } from './task-runtime/artifact/utils/DiffUtils'
import { ArtifactTransactionManager } from './task-runtime/artifact/ArtifactTransactionManager'

/*
 * [MCP CLIENT IMPORT]
 * - MCPClientManager: MCP 서버에 등록된 외부 도구를 원격 호출하는 클라이언트 매니저.
 */
import { MCPClientManager } from '../../../utils/mcpClient'

/*
 * [IPC EXECUTE TERMINAL IMPORT]
 * - executeTerminal: Electron IPC를 통해 호스트(Windows) 쉘 명령을 실행하는 함수.
 *   window.electronAPI.executeTerminal 채널을 사용하며 stdout/stderr/newCwd를 반환한다.
 */
import { executeTerminal } from '../../ipc/electronApiAdapter'

// [Item 7] Path traversal 방어 관련 임포트
import { PathSanitizer, PathSanitizationError } from './task-runtime/policy/PathSanitizer';

/*
 * [IPC ADAPTER IMPORT]
 * - ipc: llmAddLog 로그 기록 전용 어댑터 (executeTerminal은 직접 임포트).
 */
import * as ipc from '../../ipc/electronApiAdapter'

import {
  RunCommandTool,
  WriteFileTool,
  ReadFileTool,
  ApplyPatchTool,
  AppendFileTool,
  ListDirTool,
  ExecutePythonTool,
  ExecuteNodeTool
} from './tools/builtins';

/* ============================================================
 * 내장 도구 상수 (Built-in Tool Constants)
 * ============================================================ */

/**
 * BUILTIN_TOOL_NAMES
 * ToolRegistry가 기본 제공하는 내장 도구 명칭 상수.
 * 마법 문자열 방지를 위해 상수로 관리한다.
 */
export const BUILTIN_TOOL_NAMES = {
  RUN_COMMAND: 'run_command',
  READ_FILE: 'read_file',
  WRITE_FILE: 'write_file',
  APPLY_PATCH: 'apply_patch',
  LIST_DIR: 'list_dir',
  APPEND_FILE: 'append_file',
  EXECUTE_PYTHON: 'execute_python',
  EXECUTE_NODE: 'execute_node'
} as const;

/* ============================================================
 * ToolRegistry 클래스
 * ============================================================ */

/**
 * ToolRegistry
 * 에이전트가 사용할 도구를 등록하고 이름 기반으로 실행하는 중앙 레지스트리.
 *
 * 사용 예시:
 * ```ts
 * const registry = new ToolRegistry()
 * await registry.registerDefaultTools()
 * const result = await registry.executeTool('run_command', { cmd: 'dir' })
 * ```
 */
export class ToolRegistry {
  /*
   * [PRIVATE STATE - Tool Map]
   * - tools: 도구 명칭(string) → ToolDefinition 매핑 저장소.
   * - 예상 값: Map에 0~N개의 ToolDefinition이 등록된 상태.
   */
  private readonly tools: Map<string, ToolDefinition> = new Map()

  public fileAdapter?: import('./task-runtime/artifact/IFileSystemAdapter').IFileSystemAdapter;
  public artifactManager?: any;

  constructor(
    fileAdapter?: import('./task-runtime/artifact/IFileSystemAdapter').IFileSystemAdapter,
    artifactManager?: any
  ) {
    this.fileAdapter = fileAdapter;
    this.artifactManager = artifactManager;
  }

  /**
   * 도구를 레지스트리에 등록한다.
   * 동일한 name이 이미 존재하면 덮어씌운다(Override).
   *
   * @param tool - 등록할 도구 명세 객체
   */
  public register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool)
    ipc.llmAddLog({ text: `[ToolRegistry] 도구 등록: ${tool.name}`, prefix: 'Orchestrator' })
  }

  /**
   * 등록된 도구를 제거한다.
   *
   * @param name - 제거할 도구 명칭
   */
  public unregister(name: string): void {
    this.tools.delete(name)
  }

  /**
   * 등록된 모든 도구의 명세 배열을 반환한다.
   * LLM 시스템 프롬프트 빌드 시 도구 목록을 주입할 때 사용한다.
   */
  public getAllDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  /**
   * 도구 명칭으로 도구 명세를 조회한다.
   */
  public getDefinition(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  /**
   * 도구를 이름으로 조회하여 실행한다.
   *
   * @param name - 실행할 도구 명칭 (ThoughtParser가 파싱한 name 필드)
   * @param args - 도구에 전달할 인자 객체
   * @returns ToolCallResult 객체 (성공/실패 정보 포함)
   */
  public async executeTool(
    name: string,
    args: Record<string, unknown>,
    context?: { missionId?: string; taskId?: string; attemptId?: string }
  ): Promise<ToolCallResult> {
    const tool = this.tools.get(name)

    /*
     * [GUARD: Tool Not Found]
     * - 등록되지 않은 도구 명칭이 전달된 경우 에러 결과를 반환한다.
     * - 등록 현황 디버그를 위해 현재 등록된 도구 목록을 로그에 남긴다.
     */
    if (!tool) {
      const registeredNames = Array.from(this.tools.keys()).join(', ')
      const errorMsg = `알 수 없는 도구: '${name}'. 등록된 도구: [${registeredNames}]`
      console.error(`[ToolRegistry] ${errorMsg}`)
      return { success: false, error: errorMsg, toolName: name, toolArgs: args }
    }

    if (name === BUILTIN_TOOL_NAMES.WRITE_FILE && (context as any)?.retryScope && ['SECTION', 'FIELD', 'TEST'].includes((context as any).retryScope)) {
      return {
        success: false,
        error: `UNAUTHORIZED_TOOL_USE: 'write_file' is forbidden during partial repair scope (${(context as any).retryScope}). You must use 'apply_patch' tool instead.`,
        toolName: name,
        toolArgs: args
      };
    }

    ipc.llmAddLog({ text: `[ToolRegistry] 도구 실행 시작: ${name}`, prefix: 'Orchestrator' })

    try {
      const result = await tool.execute(args, context)
      ipc.llmAddLog({
        text: `[ToolRegistry] 도구 실행 완료: ${name} → ${result.success ? '성공' : '실패'}`,
        prefix: 'Orchestrator'
      })
      return result
    } catch (err: unknown) {
      /*
       * [ERROR HANDLING]
       * - 도구 실행 중 예외가 발생하면 침묵시키지 않고 ToolCallResult.error로 반환한다.
       */
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[ToolRegistry] 도구 실행 중 예외 발생 (${name}):`, msg)
      return {
        success: false,
        error: `${name} 실행 중 오류: ${msg}`,
        toolName: name,
        toolArgs: args
      }
    }
  }

  /**
   * AMEVA OS 기본 내장 도구를 등록한다.
   * Electron IPC를 통해 호스트(Windows) 명령을 실행하는 도구들을 포함한다.
   *
   * 등록 도구 목록:
   * - run_command: 호스트 OS에서 쉘 명령어를 실행하고 출력을 반환한다.
   * - read_file: 지정된 파일의 내용을 읽어 반환한다.
   * - write_file: 지정된 경로에 내용을 파일로 저장한다.
   * - list_dir: 지정된 디렉토리의 파일 목록을 반환한다.
   */
  public async registerDefaultTools(): Promise<void> {
    const builtinTools = [
      new RunCommandTool(),
      new ReadFileTool(this.fileAdapter),
      new WriteFileTool(this.fileAdapter),
      new AppendFileTool(this.fileAdapter),
      new ApplyPatchTool(this.fileAdapter, this.artifactManager),
      new ListDirTool(),
      new ExecutePythonTool(),
      new ExecuteNodeTool()
    ];

    for (const tool of builtinTools) {
      this.register(tool);
    }

    /*
     * [MCP 도구 동적 주입]
     * - MCPClientManager에 등록된 외부 MCP 서버 도구를 동적으로 가져와 등록한다.
     */
    try {
      const mcpTools = await MCPClientManager.fetchAllTools()
      for (const tool of mcpTools) {
        this.register({
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema as ToolDefinition['parameters'],
          execute: async (args) => {
            const res = await MCPClientManager.callTool(tool.serverId, tool.name, args)
            return {
              success: res.success,
              result: typeof res.result === 'string' ? res.result : JSON.stringify(res.result),
              error: res.error,
              toolName: tool.name,
              toolArgs: args
            }
          }
        })
      }
      if (mcpTools.length > 0) {
        ipc.llmAddLog({
          text: `[ToolRegistry] MCP 도구 ${mcpTools.length}개 동적 등록 완료.`,
          prefix: 'Orchestrator'
        })
      }
    } catch (mcpErr) {
      console.warn('[ToolRegistry] MCP 도구 동적 주입 실패 (MCP 서버 미연결 가능성):', mcpErr)
    }
  }

  /**
   * 등록된 모든 도구의 명세를 LLM 시스템 프롬프트에 삽입 가능한 텍스트 형식으로 직렬화한다.
   *
   * 출력 포맷:
   * ```
   * [도구 목록]
   * - run_command: 호스트 OS에서 명령어를 실행합니다. 인자: { cmd: string, cwd?: string }
   * - read_file: 파일 내용을 읽습니다. 인자: { path: string }
   * ```
   */
  public serializeForPrompt(): string {
    const lines = ['[사용 가능한 도구 목록]']
    for (const tool of this.tools.values()) {
      const requiredArgs = tool.parameters.required ?? []
      const argDesc = Object.entries(tool.parameters.properties)
        .map(([k, v]) => `${k}${requiredArgs.includes(k) ? '' : '?'}: ${v.type}`)
        .join(', ')
      lines.push(`- ${tool.name}: ${tool.description} | 인자: { ${argDesc} }`)
    }
    return lines.join('\n')
  }
}
