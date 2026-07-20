/**
 * @file orchestrator/task-runtime/planning/goal/TaskOutputClassifier.ts
 * @system AMEVA OS Desktop Workstation
 * @role 사용자 요청의 TaskOutputMode를 분류하는 휴리스틱 + LLM 복합 분류기
 *
 * [사용자 요구사항 #6 구현]
 * - NO_PERSISTED_OUTPUT      : 순수 분석/설명/질의응답
 * - FILE_OUTPUT_REQUIRED     : 실제 파일 생성/수정이 필요한 작업
 * - ARTIFACT_OUTPUT_REQUIRED : 계획서, 리뷰리포트, verification report 등 구조화 artifact
 * - EITHER_FILE_OR_ARTIFACT  : 둘 중 하나 허용
 *
 * [분류 전략]
 * 1단계: 휴리스틱 키워드 분석 → 신뢰도 점수(0.0~1.0) 계산
 * 2단계: LLM 판정 (신뢰도 0.45~0.80 범위일 때 보완)
 * 3단계: 최종 신뢰도 < 0.60 (50:50 경계) → needsUserConfirmation=true
 *
 * [사고로그 출력]
 * 분류 과정의 모든 판단 근거를 reasons[] 배열에 기록하여
 * ExecutionTraceManager를 통해 UI에 표시.
 */

import type { TaskOutputMode } from '../../domain/types';
import type { ILLMEngineAdapter } from '../../../types';

/**
 * 분류 결과 타입
 */
export interface ClassificationResult {
  /** 최종 선택된 OutputMode */
  mode: TaskOutputMode;
  /** 신뢰도 0.0~1.0 */
  confidence: number;
  /** 분류 근거 목록 (사고로그용) */
  reasons: string[];
  /** 사용자에게 질문이 필요한지 여부 */
  needsUserConfirmation: boolean;
  /** 1단계 휴리스틱 점수 맵 */
  heuristicScores: Record<TaskOutputMode, number>;
  /** 2단계 LLM 판정 결과 (있는 경우) */
  llmVerdict?: { mode: TaskOutputMode; confidence: number; reason: string };
  /** 분류 소요 시간 ms */
  classificationTimeMs: number;
}

/**
 * LLM 판정 응답 내부 타입
 */
interface LLMClassificationResponse {
  mode: TaskOutputMode;
  confidence: number;
  reason: string;
}

/**
 * 모드별 한국어 라벨 (사용자 질문 UI용)
 */
export const OUTPUT_MODE_LABELS: Record<TaskOutputMode, string> = {
  NO_PERSISTED_OUTPUT: '① 순수 분석/설명/질의응답 (파일 없음)',
  FILE_OUTPUT_REQUIRED: '② 파일 생성/수정 필요 (코드, 문서 등)',
  ARTIFACT_OUTPUT_REQUIRED: '③ 구조화 산출물 필요 (계획서, 리포트 등)',
  EITHER_FILE_OR_ARTIFACT: '④ 파일 또는 산출물 중 하나 (유연하게)'
};

/**
 * 휴리스틱 키워드 규칙
 * [keywords: 매칭 대상 키워드들, weight: 1개 매칭 시 가중치, mode: 해당 모드]
 */
const HEURISTIC_RULES: Array<{ keywords: string[]; weight: number; mode: TaskOutputMode }> = [
  // FILE_OUTPUT_REQUIRED 강력 신호
  {
    keywords: ['파일 생성', '파일 만들', '코드 작성', '코드 생성', '코드 만들', '구현해', '작성해줘', '만들어줘', '생성해줘', 'create file', 'write file', 'generate code', 'implement'],
    weight: 0.85, mode: 'FILE_OUTPUT_REQUIRED'
  },
  {
    keywords: ['.ts', '.js', '.py', '.md', '.json', '.txt', '.html', '.css', '.java', '.go', '.rs', '.cpp', '.cs'],
    weight: 0.75, mode: 'FILE_OUTPUT_REQUIRED'
  },
  {
    keywords: ['저장해', '저장해줘', '파일로', '파일에', 'save to', 'write to', '코드로'],
    weight: 0.70, mode: 'FILE_OUTPUT_REQUIRED'
  },
  {
    keywords: ['수정해', '수정해줘', '고쳐줘', '변경해', '업데이트해', 'modify', 'edit file', 'update file', 'fix the code'],
    weight: 0.65, mode: 'FILE_OUTPUT_REQUIRED'
  },
  {
    keywords: ['리팩토링', '리팩터', 'refactor', '최적화해', 'optimize'],
    weight: 0.60, mode: 'FILE_OUTPUT_REQUIRED'
  },

  // ARTIFACT_OUTPUT_REQUIRED 강력 신호
  {
    keywords: ['보고서', '리포트', '계획서', '설계서', '제안서', '기획서', '문서화', '아키텍처 문서', 'report', 'plan document', 'proposal', 'architecture doc'],
    weight: 0.80, mode: 'ARTIFACT_OUTPUT_REQUIRED'
  },
  {
    keywords: ['정리해서', '정리해줘', '요약해서', '목차', '챕터', '섹션별', '항목별', '표로 정리', '리스트로'],
    weight: 0.65, mode: 'ARTIFACT_OUTPUT_REQUIRED'
  },
  {
    keywords: ['분석 보고서', '결과 보고서', '조사 보고서', '검토 보고서', 'analysis report', 'review report'],
    weight: 0.75, mode: 'ARTIFACT_OUTPUT_REQUIRED'
  },

  // NO_PERSISTED_OUTPUT 강력 신호
  {
    keywords: ['설명해', '설명해줘', '알려줘', '무엇인지', '어떻게 되는지', '왜', '뭔가요', '뭐야', '뭐예요', 'explain', 'what is', 'how does', 'why is', 'tell me'],
    weight: 0.80, mode: 'NO_PERSISTED_OUTPUT'
  },
  {
    keywords: ['분석해줘', '진단해줘', '검토해줘', '평가해줘', '확인해줘', 'analyze this', 'review this', 'check this'],
    weight: 0.65, mode: 'NO_PERSISTED_OUTPUT'
  },
  {
    keywords: ['질문', '답해줘', '답변해줘', '궁금', '모르겠', 'answer me', 'respond', 'question'],
    weight: 0.72, mode: 'NO_PERSISTED_OUTPUT'
  },
  {
    keywords: ['차이점', '비교해줘', '장단점', '비교', '어떤 게 나아', 'compare', 'difference between', 'pros and cons'],
    weight: 0.68, mode: 'NO_PERSISTED_OUTPUT'
  },

  // EITHER_FILE_OR_ARTIFACT 중립 신호
  {
    keywords: ['또는', '혹은', '아니면', '둘 다', '원하는 대로', 'or', 'either', 'whichever', '편한 대로'],
    weight: 0.55, mode: 'EITHER_FILE_OR_ARTIFACT'
  },
];

/**
 * TaskOutputClassifier
 *
 * 사용자의 원본 요청(rawRequest)을 분석하여
 * 적합한 TaskOutputMode를 결정하는 복합 분류기.
 *
 * 사용 예시:
 * ```ts
 * const classifier = new TaskOutputClassifier(adapter);
 * const result = await classifier.classify(userRequest);
 * if (result.needsUserConfirmation) {
 *   // 사용자에게 1/2/3/4 선택 요청
 * } else {
 *   // result.mode 사용
 * }
 * ```
 */
export class TaskOutputClassifier {
  private adapter: ILLMEngineAdapter | null;

  constructor(adapter?: ILLMEngineAdapter) {
    this.adapter = adapter ?? null;
  }

  /**
   * 메인 분류 엔트리포인트.
   * 휴리스틱 → LLM(선택적) → 결과 반환.
   * 신뢰도 임계값 미달 시 needsUserConfirmation=true 반환.
   *
   * @param rawRequest - 원본 사용자 요청 문자열
   * @returns ClassificationResult
   */
  public async classify(rawRequest: string): Promise<ClassificationResult> {
    const startedAt = Date.now();
    const reasons: string[] = [];

    // 1단계: 휴리스틱 분석
    const heuristicScores = this.computeHeuristicScores(rawRequest);
    const heuristicTop = this.getTopMode(heuristicScores);
    const heuristicConfidence = heuristicScores[heuristicTop];

    reasons.push(`[휴리스틱 분석] 최상위 모드: ${heuristicTop} (신뢰도: ${(heuristicConfidence * 100).toFixed(0)}%)`);
    reasons.push(`[휴리스틱 점수] ${Object.entries(heuristicScores).map(([k, v]) => `${k}:${(v * 100).toFixed(0)}%`).join(', ')}`);

    // 고신뢰도: LLM 없이 바로 결정
    if (heuristicConfidence >= 0.80) {
      reasons.push(`[결정 근거] 휴리스틱 신뢰도 ≥ 80% → LLM 스킵, 즉시 결정`);
      return {
        mode: heuristicTop,
        confidence: heuristicConfidence,
        reasons,
        needsUserConfirmation: false,
        heuristicScores,
        classificationTimeMs: Date.now() - startedAt
      };
    }

    // 2단계: LLM 보완 판정 (어댑터가 있고 중간 신뢰도일 때)
    let llmVerdict: LLMClassificationResponse | undefined;
    if (this.adapter && this.adapter.isReady() && heuristicConfidence >= 0.40) {
      try {
        const llmResult = await this.classifyWithLLM(rawRequest, heuristicScores);
        if (llmResult) {
          llmVerdict = llmResult;
          reasons.push(`[LLM 판정] 모드: ${llmVerdict.mode} (신뢰도: ${(llmVerdict.confidence * 100).toFixed(0)}%) — ${llmVerdict.reason}`);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        reasons.push(`[LLM 판정 실패] ${msg} → 휴리스틱 결과만 사용`);
      }
    } else if (!this.adapter || !this.adapter.isReady()) {
      reasons.push(`[LLM 스킵] 어댑터 미연결 → 휴리스틱만 사용`);
    }

    // 3단계: 앙상블 최종 결정
    let finalMode = heuristicTop;
    let finalConfidence = heuristicConfidence;

    if (llmVerdict) {
      if (llmVerdict.mode === heuristicTop) {
        // 동일 모드: 신뢰도 부스트 (가중 앙상블)
        finalConfidence = Math.min(1.0, heuristicConfidence * 0.40 + llmVerdict.confidence * 0.60);
        reasons.push(`[앙상블 일치] 신뢰도 부스트 → ${(finalConfidence * 100).toFixed(0)}%`);
      } else if (llmVerdict.confidence > heuristicConfidence) {
        // LLM이 더 확실: LLM 채택 + 불일치 페널티
        finalMode = llmVerdict.mode;
        finalConfidence = llmVerdict.confidence * 0.78;
        reasons.push(`[앙상블 불일치] LLM 우세 → ${finalMode} 채택 (페널티 후 ${(finalConfidence * 100).toFixed(0)}%)`);
      } else {
        // 휴리스틱 유지 + 불일치 페널티
        finalConfidence = heuristicConfidence * 0.82;
        reasons.push(`[앙상블 불일치] 휴리스틱 유지 (페널티 후 ${(finalConfidence * 100).toFixed(0)}%)`);
      }
    }

    // 4단계: 50:50 임계값 체크
    const needsUserConfirmation = finalConfidence < 0.60;
    if (needsUserConfirmation) {
      reasons.push(`[결정] 신뢰도 ${(finalConfidence * 100).toFixed(0)}% < 60% ← 50:50 경계 → 사용자 확인 필요`);
    } else {
      reasons.push(`[결정 완료] 최종 모드: ${finalMode}, 신뢰도: ${(finalConfidence * 100).toFixed(0)}%`);
    }

    return {
      mode: finalMode,
      confidence: finalConfidence,
      reasons,
      needsUserConfirmation,
      heuristicScores,
      llmVerdict: llmVerdict ? { mode: llmVerdict.mode, confidence: llmVerdict.confidence, reason: llmVerdict.reason } : undefined,
      classificationTimeMs: Date.now() - startedAt
    };
  }

  /**
   * 모든 모드에 대한 휴리스틱 점수를 계산.
   * 키워드 매칭 가중치 합산 후 softmax-style 정규화.
   */
  private computeHeuristicScores(rawRequest: string): Record<TaskOutputMode, number> {
    const text = rawRequest.toLowerCase();

    // 초기 기준점: NO_PERSISTED_OUTPUT을 약간 우세하게 설정 (가장 흔한 유형)
    const rawScores: Record<TaskOutputMode, number> = {
      NO_PERSISTED_OUTPUT: 0.18,
      FILE_OUTPUT_REQUIRED: 0.10,
      ARTIFACT_OUTPUT_REQUIRED: 0.10,
      EITHER_FILE_OR_ARTIFACT: 0.04
    };

    for (const rule of HEURISTIC_RULES) {
      const matched = rule.keywords.filter(kw => text.includes(kw.toLowerCase()));
      if (matched.length > 0) {
        // 여러 키워드 매칭 시 log scale로 증폭
        const matchBonus = 1.0 + Math.log2(matched.length) * 0.25;
        rawScores[rule.mode] = Math.min(
          2.0,
          rawScores[rule.mode] + rule.weight * matchBonus
        );
      }
    }

    // 정규화 (합이 1이 되도록)
    const total = Object.values(rawScores).reduce((a, b) => a + b, 0);
    return {
      NO_PERSISTED_OUTPUT: rawScores.NO_PERSISTED_OUTPUT / total,
      FILE_OUTPUT_REQUIRED: rawScores.FILE_OUTPUT_REQUIRED / total,
      ARTIFACT_OUTPUT_REQUIRED: rawScores.ARTIFACT_OUTPUT_REQUIRED / total,
      EITHER_FILE_OR_ARTIFACT: rawScores.EITHER_FILE_OR_ARTIFACT / total
    };
  }

  /**
   * 점수 맵에서 최고 점수 모드 반환.
   */
  private getTopMode(scores: Record<TaskOutputMode, number>): TaskOutputMode {
    let topMode: TaskOutputMode = 'NO_PERSISTED_OUTPUT';
    let topScore = -1;
    for (const [mode, score] of Object.entries(scores) as [TaskOutputMode, number][]) {
      if (score > topScore) {
        topScore = score;
        topMode = mode;
      }
    }
    return topMode;
  }

  /**
   * LLM에게 OutputMode 판정 요청.
   * 타임아웃: 8초. 파싱 실패 시 null 반환.
   */
  private async classifyWithLLM(
    rawRequest: string,
    heuristicScores: Record<TaskOutputMode, number>
  ): Promise<LLMClassificationResponse | null> {
    if (!this.adapter) return null;

    const systemPrompt = `You are a task output classification expert. Given a user request, determine the output mode.
Respond ONLY with valid JSON: {"mode": "MODE", "confidence": 0.0-1.0, "reason": "brief reason"}
Available modes (choose exactly one):
- "NO_PERSISTED_OUTPUT": Pure analysis/explanation/Q&A - no file or document creation needed
- "FILE_OUTPUT_REQUIRED": Must create or modify actual code/config/document files on disk
- "ARTIFACT_OUTPUT_REQUIRED": Must create structured reports, architectural plans, specification docs
- "EITHER_FILE_OR_ARTIFACT": Either file or structured artifact is acceptable
Be conservative. If unsure, prefer lower persistence modes.`;

    const scores = Object.entries(heuristicScores)
      .map(([k, v]) => `${k}:${(v * 100).toFixed(0)}%`)
      .join(', ');

    const userPrompt = `User Request: "${rawRequest.slice(0, 600)}"
Heuristic hint scores: ${scores}
Classify this request's output mode:`;

    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('LLM classification timeout (8000ms)')), 8000)
    );

    const generatePromise = this.adapter.generateStream(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      () => { /* streaming noop */ }
    );

    const raw = await Promise.race([generatePromise, timeoutPromise]);

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      const mode = parsed['mode'] as TaskOutputMode;
      const confidence = typeof parsed['confidence'] === 'number'
        ? Math.max(0, Math.min(1, parsed['confidence']))
        : 0.5;
      const reason = typeof parsed['reason'] === 'string' ? parsed['reason'] : '';

      const validModes: TaskOutputMode[] = [
        'NO_PERSISTED_OUTPUT',
        'FILE_OUTPUT_REQUIRED',
        'ARTIFACT_OUTPUT_REQUIRED',
        'EITHER_FILE_OR_ARTIFACT'
      ];
      if (!validModes.includes(mode)) return null;

      return { mode, confidence, reason };
    } catch {
      return null;
    }
  }
}
