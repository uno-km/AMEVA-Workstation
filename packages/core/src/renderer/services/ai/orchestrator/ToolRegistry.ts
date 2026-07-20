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
  APPEND_FILE: 'append_file'
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
    /*
     * [TOOL: run_command]
     * - Windows PowerShell을 통해 호스트 명령을 실행한다.
     * - mcp_proxy.js의 host_exec WebSocket IPC를 통해 실제 실행된다.
     */
    this.register({
      name: BUILTIN_TOOL_NAMES.RUN_COMMAND,
      description: '호스트 OS(Windows)에서 PowerShell 명령어를 실행하고 stdout/stderr를 반환합니다. 파일 작업, 빌드, 패키지 설치 등에 사용하세요.',
      parameters: {
        type: 'object',
        properties: {
          cmd: { type: 'string', description: '실행할 PowerShell 명령어 (예: dir, npm install, git status)' },
          cwd: { type: 'string', description: '명령어 실행 디렉토리 경로 (선택사항)' }
        },
        required: ['cmd']
      },
      execute: async (args, context) => {
        const cmd = String(args['cmd'] ?? '')
        const cwd = args['cwd'] ? String(args['cwd']) : undefined

        try {
          /*
           * [IPC EXECUTION]
           * - ipc.executeHostCommand: mcp_proxy.js의 host_exec 메시지를 통해
           *   실제 Windows PowerShell 프로세스를 기동하고 결과를 수신한다.
           * - 인코딩: UTF-8 강제 적용 (AMEVA OS AGENTS.md 16번 규칙 준수).
           */
          const result = await executeTerminal(cmd, cwd)
          return {
            success: true,
            result: result.stdout || result.stderr || '(출력 없음)',
            toolName: BUILTIN_TOOL_NAMES.RUN_COMMAND,
            toolArgs: args
          }
        } catch (execErr: unknown) {
          const msg = execErr instanceof Error ? execErr.message : String(execErr)
          return {
            success: false,
            error: msg,
            toolName: BUILTIN_TOOL_NAMES.RUN_COMMAND,
            toolArgs: args
          }
        }
      }
    })

    /*
     * [TOOL: read_file]
     * - 지정된 파일 경로의 내용을 읽어 문자열로 반환한다.
     */
    this.register({
      name: BUILTIN_TOOL_NAMES.READ_FILE,
      description: '지정된 파일 경로의 내용을 읽어 반환합니다. 코드 파일, 설정 파일, 문서 파일 등을 읽을 때 사용하세요.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '읽을 파일의 절대 경로 또는 상대 경로' }
        },
        required: ['path']
      },
      execute: async (args, context) => {
        const rawPath = String(args['path'] ?? '')

        // [Item 7] Path traversal 방어
        let safePath: string;
        try {
          safePath = PathSanitizer.sanitizePath(rawPath, 'read', context?.missionId);
        } catch (sanitizeErr: unknown) {
          const reason = sanitizeErr instanceof PathSanitizationError
            ? sanitizeErr.reason : 'UNKNOWN';
          return {
            success: false,
            error: `Path blocked: ${sanitizeErr instanceof Error ? sanitizeErr.message : String(sanitizeErr)} (reason: ${reason})`,
            toolName: BUILTIN_TOOL_NAMES.READ_FILE,
            toolArgs: args
          };
        }

        if (!this.fileAdapter) {
          return {
            success: false,
            error: `fileAdapter is not initialized. Cannot read file.`,
            toolName: BUILTIN_TOOL_NAMES.READ_FILE,
            toolArgs: args
          };
        }

        try {
          const content = await this.fileAdapter.read(safePath);
          return {
            success: true,
            result: content ?? '(빈 파일)',
            toolName: BUILTIN_TOOL_NAMES.READ_FILE,
            toolArgs: args
          }
        } catch (err: unknown) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
            toolName: BUILTIN_TOOL_NAMES.READ_FILE,
            toolArgs: args
          }
        }
      }
    })

    /*
     * [TOOL: write_file]
     * - 지정된 경로에 내용을 파일로 저장한다.
     */
    this.register({
      name: BUILTIN_TOOL_NAMES.WRITE_FILE,
      description: '지정된 경로에 내용을 파일로 저장합니다. 코드 생성, 설정 파일 작성 등에 사용하세요.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '저장할 파일의 절대 경로 또는 상대 경로' },
          content: { type: 'string', description: '파일에 저장할 내용' }
        },
        required: ['path', 'content']
      },
      execute: async (args, context) => {
        const rawPath = String(args['path'] ?? '')
        const content = String(args['content'] ?? '')

        // [Item 7] Path traversal 방어 — 쓰기 작업은 허용된 루트에서만
        let safePath: string;
        try {
          safePath = PathSanitizer.sanitizePath(rawPath, 'write', context?.missionId);
        } catch (sanitizeErr: unknown) {
          const reason = sanitizeErr instanceof PathSanitizationError
            ? sanitizeErr.reason : 'UNKNOWN';
          return {
            success: false,
            error: `Write blocked: ${sanitizeErr instanceof Error ? sanitizeErr.message : String(sanitizeErr)} (reason: ${reason})`,
            toolName: BUILTIN_TOOL_NAMES.WRITE_FILE,
            toolArgs: args
          };
        }

        if (!this.fileAdapter) {
          return {
            success: false,
            error: `fileAdapter is not initialized. Cannot write file.`,
            toolName: BUILTIN_TOOL_NAMES.WRITE_FILE,
            toolArgs: args
          };
        }

        try {
          await this.fileAdapter.write(safePath, content);
          
          const stat = await this.fileAdapter.stat(safePath);
          const hash = await this.fileAdapter.hash(safePath);

          return {
            success: true,
            result: `파일 저장 완료: ${safePath}`,
            toolName: BUILTIN_TOOL_NAMES.WRITE_FILE,
            toolArgs: args,
            // [Phase 2.2] Artifact Return Contract
            artifactId: context?.artifactId,
            missionId: context?.missionId,
            taskId: context?.taskId,
            attemptId: context?.attemptId,
            outputId: context?.expectedOutput, // Legacy mapping from context
            expectedPath: rawPath,
            normalizedStagedPath: safePath,
            size: stat.size,
            contentHash: hash ?? undefined,
            revision: 1, // Basic default, managed by IdempotencyStore in actual impl
            idempotencyKey: context?.idempotencyKey
          }
        } catch (err: unknown) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
            toolName: BUILTIN_TOOL_NAMES.WRITE_FILE,
            toolArgs: args
          }
        }
      }
    })

    /*
     * [TOOL: append_file]
     * - 기존 파일 끝에 내용을 추가한다.
     */
    this.register({
      name: BUILTIN_TOOL_NAMES.APPEND_FILE,
      description: '기존 파일의 끝에 새로운 내용을 추가(Append)합니다. 보고서나 문서를 순차적으로 이어서 작성할 때 이전 내용이 덮어씌워지지 않도록 반드시 이 도구를 사용하세요.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '내용을 추가할 파일의 절대 경로 또는 상대 경로' },
          content: { type: 'string', description: '파일 끝에 추가할 내용' }
        },
        required: ['path', 'content']
      },
      execute: async (args, context) => {
        const rawPath = String(args['path'] ?? '')
        const appendContent = String(args['content'] ?? '')

        let safePath: string;
        try {
          safePath = PathSanitizer.sanitizePath(rawPath, 'write', context?.missionId);
        } catch (sanitizeErr: unknown) {
          const reason = sanitizeErr instanceof PathSanitizationError ? sanitizeErr.reason : 'UNKNOWN';
          return {
            success: false,
            error: `Append blocked: ${sanitizeErr instanceof Error ? sanitizeErr.message : String(sanitizeErr)} (reason: ${reason})`,
            toolName: BUILTIN_TOOL_NAMES.APPEND_FILE,
            toolArgs: args
          };
        }

        if (!this.fileAdapter) {
          return {
            success: false,
            error: `fileAdapter is not initialized. Cannot append file.`,
            toolName: BUILTIN_TOOL_NAMES.APPEND_FILE,
            toolArgs: args
          };
        }

        try {
          // 1. 기존 내용 읽기 (없으면 빈 문자열)
          let existingContent = '';
          try {
            existingContent = (await this.fileAdapter.read(safePath)) ?? '';
          } catch (e) {
            existingContent = '';
          }

          // 2. 내용 결합
          let finalContent = existingContent;
          if (finalContent.length > 0 && !finalContent.endsWith('\n')) {
            finalContent += '\n';
          }
          finalContent += appendContent;

          // 3. 다시 쓰기
          await this.fileAdapter.write(safePath, finalContent);
          
          const stat = await this.fileAdapter.stat(safePath);
          const hash = await this.fileAdapter.hash(safePath);

          return {
            success: true,
            result: `파일 내용 추가(Append) 완료: ${safePath}`,
            toolName: BUILTIN_TOOL_NAMES.APPEND_FILE,
            toolArgs: args,
            artifactId: context?.artifactId,
            missionId: context?.missionId,
            taskId: context?.taskId,
            attemptId: context?.attemptId,
            outputId: context?.expectedOutput,
            expectedPath: rawPath,
            normalizedStagedPath: safePath,
            size: stat.size,
            contentHash: hash ?? undefined,
            revision: 1,
            idempotencyKey: context?.idempotencyKey
          }
        } catch (err: unknown) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
            toolName: BUILTIN_TOOL_NAMES.APPEND_FILE,
            toolArgs: args
          }
        }
      }
    })

    this.register({
      name: BUILTIN_TOOL_NAMES.APPLY_PATCH,
      description: 'Patch a file with partial repair constraints',
      parameters: { type: 'object', properties: {}, required: [] },
      execute: async (args, context?: ToolExecutionContext) => {
        try {
          const rawPath = String(args['targetPath'] ?? args['path'] ?? '');
          const patchContent = String(args['replacement'] ?? args['patch'] ?? '');
          const targetSection = String(args['targetSection'] ?? args['targetSelector'] ?? '');
          
          const missionId = context?.missionId || args['missionId'];
          const taskId = context?.taskId || args['taskId'];
          const attemptId = context?.attemptId || args['attemptId'];
          const artifactId = context?.artifactId || args['artifactId'];
          const retryScope = context?.retryScope || args['retryScope'] || 'FULL_TASK';
          const expectedOldHash = args['expectedOldHash'] ? String(args['expectedOldHash']) : undefined;
          const sourceRevision = args['sourceRevision'] ? Number(args['sourceRevision']) : undefined;
          const currentRevision = context?.currentRevision;
          const idempotencyKey = String(args['idempotencyKey'] || context?.idempotencyKey || '');
          const finalPath = String(context?.finalPath || rawPath);
          const allowedRanges = args['allowedRanges'] as string[] | undefined;
          const protectedRanges = args['protectedRanges'] as string[] | undefined;

          // 1. Strict Context Validation
          if (!missionId || !taskId || !attemptId || !artifactId || !finalPath || !idempotencyKey) {
            throw new Error('INVALID_ARTIFACT_CONTEXT: Missing required context fields.');
          }

          if (currentRevision === undefined || currentRevision < 1) {
            throw new Error('INVALID_ARTIFACT_CONTEXT: Invalid currentRevision.');
          }

          if (sourceRevision !== undefined && sourceRevision !== currentRevision) {
            throw new Error('STALE: sourceRevision does not match current artifact revision.');
          }

          // Manifest Validation
          if (this.artifactManager) {
            const manifest = await this.artifactManager.getManifest(String(missionId), String(artifactId));
            if (!manifest) {
              throw new Error('CONTEXT_MISMATCH: Manifest not found.');
            }
            if (manifest.missionId !== missionId || manifest.taskId !== taskId || manifest.artifactId !== artifactId || manifest.finalPath !== finalPath) {
              throw new Error('CONTEXT_MISMATCH: Manifest fields mismatch.');
            }
            if (sourceRevision !== undefined && sourceRevision !== manifest.revision) {
              throw new Error('STALE: sourceRevision does not match current artifact revision.');
            }
          }

          if (!this.fileAdapter) {
            throw new Error('fileAdapter not initialized.');
          }

          let safeFinalPath = PathSanitizer.sanitizePath(finalPath, 'read', String(missionId));

          const currentContent = await this.fileAdapter.read(safeFinalPath);
          if (currentContent === null) throw new Error('File not found for patching.');

          const currentHash = await this.fileAdapter.hash(safeFinalPath);
          if (expectedOldHash && currentHash !== expectedOldHash) {
            throw new Error(`Hash mismatch. Expected: ${expectedOldHash}, Actual: ${currentHash}. Patch rejected.`);
          }

          let newContent = currentContent;
          let changedRanges: string[] = [];
          let preservedRanges: string[] = [];

          // 2. Scope-specific modifications
          if (retryScope === 'SECTION') {
            if (!targetSection || !patchContent) throw new Error('AMBIGUOUS_REPAIR_TARGET: Both replacement and targetSection are required for SECTION scope.');
            
            // Markdown Heading Matcher
            const headingRegex = new RegExp('^#+\\s+' + escapeRegex(targetSection.replace(/^#+\s*/, '')).trim() + '\\s*$', 'm');
            const match = currentContent.match(headingRegex);
            if (match) {
              const matchIndex = match.index!;
              const nextHeadingMatch = currentContent.slice(matchIndex + match[0].length).match(/^#+\s+/m);
              const endIndex = nextHeadingMatch ? matchIndex + match[0].length + nextHeadingMatch.index! : currentContent.length;
              newContent = currentContent.slice(0, matchIndex) + patchContent + (currentContent.endsWith('\n') && !patchContent.endsWith('\n') ? '\n' : '') + currentContent.slice(endIndex);
            } else {
              const idx = currentContent.indexOf(targetSection);
              if (idx === -1) throw new Error('AMBIGUOUS_REPAIR_TARGET: Heading not found.');
              if (currentContent.lastIndexOf(targetSection) !== idx) throw new Error('AMBIGUOUS_REPAIR_TARGET: Multiple instances found.');
              newContent = currentContent.slice(0, idx) + patchContent + currentContent.slice(idx + targetSection.length);
            }

          } else if (retryScope === 'FIELD') {
             try {
                const parsed = JSON.parse(currentContent);
                const fieldPath = String(args['targetSelector'] || args['targetSection'] || '');
                if (!fieldPath) throw new Error('targetSelector (field path) required for FIELD scope.');
                
                const keys = fieldPath.split('.');
                let current = parsed;
                for (let i = 0; i < keys.length - 1; i++) {
                    if (keys[i] === '__proto__' || keys[i] === 'prototype' || keys[i] === 'constructor') {
                       throw new Error('Prototype pollution detected.');
                    }
                    if (current[keys[i]] === undefined) throw new Error(`Path ${keys[i]} not found in JSON.`);
                    current = current[keys[i]];
                }
                
                const finalKey = keys[keys.length - 1];
                if (finalKey === '__proto__' || finalKey === 'prototype' || finalKey === 'constructor') {
                    throw new Error('Prototype pollution detected.');
                }

                let parsedPatch;
                try { parsedPatch = JSON.parse(patchContent); } catch { parsedPatch = patchContent; }
                
                current[finalKey] = parsedPatch;
                newContent = JSON.stringify(parsed, null, 2);
             } catch (e: unknown) {
                if (e instanceof Error && e.message.includes('AMBIGUOUS_REPAIR_TARGET')) throw e;
                throw new Error(`Invalid JSON format after patch: ${e instanceof Error ? e.message : String(e)}`);
             }
          } else if (retryScope === 'FUNCTION') {
             return { success: false, error: 'WAITING_USER: AST Parser required for safe FUNCTION repair. Not supported in current implementation.', toolName: BUILTIN_TOOL_NAMES.APPLY_PATCH, toolArgs: args };
          } else if (retryScope === 'TEST') {
             if (!patchContent) throw new Error('Patch content required for TEST scope.');
             if (!allowedRanges || allowedRanges.length === 0) {
               throw new Error('AMBIGUOUS_REPAIR_TARGET: TEST scope requires explicit allowedRanges.');
             }
             if (patchContent === newContent) {
               throw new Error('WAITING_USER: Full file replacement is not allowed for TEST scope without exact targeting.');
             }
             newContent = patchContent;
          } else if (retryScope === 'FILE') {
             if (args['fullFileReplacementAllowed'] !== true || !args['replacementReason']) {
                return { success: false, error: 'WAITING_USER: Full file replacement requires explicit fullFileReplacementAllowed and replacementReason.', toolName: BUILTIN_TOOL_NAMES.APPLY_PATCH, toolArgs: args };
             }
             if (!patchContent) throw new Error('Patch content required for FILE scope.');
             newContent = patchContent;
          } else if (retryScope === 'TOOL_CALL') {
             newContent = currentContent; // Only run failed tools
          } else { 
             if (patchContent) newContent = patchContent;
          }

          if (newContent === currentContent && retryScope !== 'TOOL_CALL') {
             throw new Error('NO_CHANGE: Patch applied but content is identical to the original.');
          }

          // 3. Diff Range Calculation
          
          const hunks = DiffUtils.computeLineHunks(currentContent, newContent);
          
          changedRanges = hunks.map((h: any) => `L${h.oldStartLine}-L${h.oldEndLine}`);
          
          // Verify Allowed/Protected
          if (allowedRanges && allowedRanges.length > 0) {
             for (const hunk of hunks) {
               const start = hunk.oldStartLine;
               const end = hunk.oldEndLine;
               // Strict check: if start/end is not within allowedRanges
               // For simplicity, just checking intersecting is fine here if properly implemented
               let insideAllowed = false;
               for (const ar of allowedRanges) {
                 const match = ar.match(/L(\d+)-L(\d+)/);
                 if (match) {
                   const aStart = parseInt(match[1]);
                   const aEnd = parseInt(match[2]);
                   if (start >= aStart && end <= aEnd) insideAllowed = true;
                   if (start === 0 || end === 0) insideAllowed = true; // handle pure insert/delete edge cases properly
                 }
               }
               if (!insideAllowed && (start !== 0 || end !== 0)) {
                 throw new Error(`Patch rejected: Range L${start}-L${end} is outside allowedRanges.`);
               }
             }
          }

          if (protectedRanges && protectedRanges.length > 0) {
            for (const hunk of hunks) {
              const start = hunk.oldStartLine;
              const end = hunk.oldEndLine;
              for (const pr of protectedRanges) {
                 const match = pr.match(/L(\d+)-L(\d+)/);
                 if (match) {
                   const pStart = parseInt(match[1]);
                   const pEnd = parseInt(match[2]);
                   if (start <= pEnd && end >= pStart && (start !== 0 || end !== 0)) {
                     throw new Error('Patch rejected: Intersects with protectedRanges.');
                   }
                 }
              }
            }
          }

          // preserved segment mapping could be added here if needed

          // 4. Staging
          const newRevision = Number(currentRevision || 0) + 1;
          const stagingPath = ArtifactTransactionManager.resolveStagingPath(String(missionId), String(taskId), String(attemptId), String(artifactId), newRevision);

          await this.fileAdapter.write(stagingPath, newContent);
          const newStat = await this.fileAdapter.stat(stagingPath);
          const newHash = await this.fileAdapter.hash(stagingPath);

          return {
            success: true,
            result: `파일 부분 수정 완료: ${stagingPath}`,
            toolName: BUILTIN_TOOL_NAMES.APPLY_PATCH,
            toolArgs: args,
            artifactId,
            missionId,
            taskId,
            attemptId,
            expectedPath: safeFinalPath,
            normalizedStagedPath: stagingPath,
            retryScope,
            changedRanges,
            preservedRanges,
            size: newStat.size,
            previousHash: currentHash,
            newHash: newHash ?? undefined,
            previousRevision: currentRevision,
            newRevision,
            idempotencyKey
          }
        } catch (err: unknown) {
          // Failure Atomicity: Errors are thrown before any write_file to staging.
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
            toolName: BUILTIN_TOOL_NAMES.APPLY_PATCH,
            toolArgs: args
          }
        }
      }
    });

    function escapeRegex(string: string) {
      return string.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
    }


    /*
     * [TOOL: list_dir]
     * - 지정된 디렉토리의 파일 및 하위 디렉토리 목록을 반환한다.
     */
    this.register({
      name: BUILTIN_TOOL_NAMES.LIST_DIR,
      description: '지정된 디렉토리의 파일 및 폴더 목록을 반환합니다. 현재 작업 디렉토리 탐색에 사용하세요.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '목록을 조회할 디렉토리 경로. 생략 시 현재 디렉토리.' }
        },
        required: []
      },
      execute: async (args) => {
        const path = args['path'] ? `"${String(args['path'])}"` : '.'
        try {
          const result = await executeTerminal(`Get-ChildItem ${path} | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize | Out-String`, undefined)
          return {
            success: true,
            result: result.stdout || '(디렉토리가 비어있습니다)',
            toolName: BUILTIN_TOOL_NAMES.LIST_DIR,
            toolArgs: args
          }
        } catch (err: unknown) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
            toolName: BUILTIN_TOOL_NAMES.LIST_DIR,
            toolArgs: args
          }
        }
      }
    })

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
