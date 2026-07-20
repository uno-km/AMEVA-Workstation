import { ModelRouter } from '../../routing/router/ModelRouter';
import { RoutingConfigManager } from '../../routing/domain/RoutingConfigManager';
import { TaskProfiler } from '../../routing/profiler/TaskProfiler';
import { ModelAdapterProvider } from '../../routing/adapter/ModelAdapterProvider';
import { ModelCallGatewayAdapter } from '../../routing/gateway/ModelCallGatewayAdapter';
import { ExecutionTraceManager } from '../../trace/ExecutionTraceManager';
import { CodeErrorPromptBuilder } from '../../completion/builder/CodeErrorPromptBuilder';
import { ErrorHeuristicAnalyzer } from './ErrorHeuristicAnalyzer';
import { CodeErrorAnalysisRequest, CodeErrorAnalysisResponse } from './CodeErrorAnalysisTypes';

export class CodeErrorAnalysisService {
  constructor(private traceManager?: ExecutionTraceManager) {}

  public async analyzeError(req: CodeErrorAnalysisRequest): Promise<CodeErrorAnalysisResponse> {
    const config = RoutingConfigManager.getInstance().getConfig();

    // 1. Analyst Layer: Rule-based Heuristic Analysis
    const codeContent = req.fullSourceAvailable ? req.codeSnippet : req.codeSnippet;
    const heuristicResult = ErrorHeuristicAnalyzer.analyze(req.rawErrorLog, codeContent, req.language);

    if (heuristicResult.matched && heuristicResult.suggestedFix) {
      return {
        success: true,
        category: heuristicResult.category,
        subtype: heuristicResult.subtype,
        rootCause: heuristicResult.rootCause,
        explanation: `Rule Match [${heuristicResult.ruleId}]: Found a known heuristic for this error.`,
        suggestedFix: heuristicResult.suggestedFix,
        confidence: heuristicResult.confidence,
        analyzerUsed: 'RULE',
        snippetUsed: heuristicResult.extractedSnippet,
        redactionsApplied: [],
        nextActionHint: 'SUGGEST_FIX'
      };
    }

    // 2. Fallback: Prepare LLM Inference Layer
    const snippetToAnalyze = heuristicResult.extractedSnippet || req.codeSnippet;

    const dummyTask = {
      id: req.requestId,
      definition: {
        goal: 'Analyze code execution error and suggest fix',
        description: req.rawErrorLog,
        expectedOutputs: []
      }
    };

    const profile = TaskProfiler.profileTask('error_analysis_mission', dummyTask as any, 'CODE_ERROR_ANALYSIS');
    const decision = await ModelRouter.route(profile, config);
    if (decision.status !== 'SUCCESS') {
      throw new Error(`Failed to route Code Error Analysis: ${decision.status}`);
    }

    const rawAdapter = ModelAdapterProvider.getInstance().getAdapter(decision.selectedModelId, decision.selectedRole);
    if (!rawAdapter) {
      throw new Error(`Adapter not found for ${decision.selectedModelId}`);
    }

    const gateway = new ModelCallGatewayAdapter(
      rawAdapter,
      decision.selectedModelId,
      this.traceManager || ({} as any),
      'error_analysis_mission',
      req.requestId,
      req.requestId // Using requestId for attemptId
    );

    const prompt = CodeErrorPromptBuilder.build(
      req.filePath || 'Unknown',
      snippetToAnalyze,
      req.rawErrorLog,
      heuristicResult.extractedLineNumber
    );

    const response = await gateway.generate(prompt);

    return {
      success: true,
      category: 'LLM_ANALYSIS',
      subtype: 'Dynamic',
      rootCause: 'Extracted via LLM',
      explanation: response.content || '',
      suggestedFix: response.content || '',
      confidence: 0.8, // LLM confidence baseline
      analyzerUsed: 'LLM_FALLBACK',
      snippetUsed: snippetToAnalyze,
      redactionsApplied: [],
      nextActionHint: 'SUGGEST_FIX'
    };
  }
}
