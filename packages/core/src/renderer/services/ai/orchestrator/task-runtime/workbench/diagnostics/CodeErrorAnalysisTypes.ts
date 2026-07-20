export interface CodeErrorAnalysisRequest {
  requestId: string;
  language: string;
  executionContextType: 'typescript' | 'python' | 'node' | 'react' | 'sql' | 'unknown';
  rawErrorLog: string;
  fullSourceAvailable: boolean;
  codeSnippet: string;
  errorLineNumber: number | null;
  surroundingStartLine: number | null;
  surroundingEndLine: number | null;
  filePath?: string;
  fileExtension?: string;
  metadata?: any;
}

export interface ErrorHeuristicAnalysisResult {
  matched: boolean;
  category: string;
  subtype: string;
  confidence: number;
  rootCause: string;
  extractedLineNumber: number | null;
  extractedSnippet: string | null;
  analyzerUsed: 'RULE' | 'LLM_FALLBACK';
  ruleId?: string;
  suggestedFix?: string; // Quick fix from rule engine
}

export interface CodeErrorAnalysisResponse {
  success: boolean;
  category: string;
  subtype: string;
  rootCause: string;
  explanation: string;
  suggestedFix: string;
  confidence: number;
  analyzerUsed: 'RULE' | 'LLM_FALLBACK';
  snippetUsed: string | null;
  redactionsApplied: string[];
  nextActionHint: 'ASK_IMPLEMENTER_REWORK' | 'SHOW_USER_GUIDE' | 'SUGGEST_FIX' | 'ESCALATE';
}
