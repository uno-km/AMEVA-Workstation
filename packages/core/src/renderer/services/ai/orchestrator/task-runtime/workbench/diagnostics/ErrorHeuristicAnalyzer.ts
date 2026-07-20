import type { ErrorHeuristicAnalysisResult } from './CodeErrorAnalysisTypes';

export class ErrorHeuristicAnalyzer {
  private static readonly MAX_SNIPPET_RADIUS = 12; // ±12 lines

  /**
   * Main entry point to analyze error heuristically.
   * Extracts snippets and tries to match predefined rules.
   */
  public static analyze(errorLog: string, code: string, lang: string): ErrorHeuristicAnalysisResult {
    let errorLineNumber: number | null = null;
    let snippet: string | null = null;

    if (lang === 'python') {
      errorLineNumber = this.extractPythonLineNumber(errorLog);
    } else if (lang === 'typescript' || lang === 'javascript' || lang === 'node') {
      errorLineNumber = this.extractTsLineNumber(errorLog);
    } else if (lang === 'react') {
      errorLineNumber = this.extractTsLineNumber(errorLog); // Similar stack trace
    } else {
      // Basic fallback
      errorLineNumber = this.extractGenericLineNumber(errorLog);
    }

    if (errorLineNumber !== null) {
      snippet = this.extractSnippet(code, errorLineNumber, this.MAX_SNIPPET_RADIUS);
    }

    const ruleMatch = this.matchRules(errorLog, snippet, lang);

    return {
      matched: ruleMatch !== null,
      category: ruleMatch?.category || 'UNKNOWN',
      subtype: ruleMatch?.subtype || 'UNKNOWN',
      confidence: ruleMatch ? 1.0 : 0.0,
      rootCause: ruleMatch?.rootCause || 'No heuristic matched',
      extractedLineNumber: errorLineNumber,
      extractedSnippet: snippet,
      analyzerUsed: ruleMatch !== null ? 'RULE' : 'LLM_FALLBACK',
      ruleId: ruleMatch?.ruleId,
      suggestedFix: ruleMatch?.suggestedFix
    };
  }

  private static extractPythonLineNumber(errorLog: string): number | null {
    // Looks for: File "...", line 12, in <module>
    // Grab the last one in the traceback (most specific)
    const regex = /line (\d+)/g;
    let match;
    let lastLine = null;
    while ((match = regex.exec(errorLog)) !== null) {
      lastLine = parseInt(match[1], 10);
    }
    return lastLine;
  }

  private static extractTsLineNumber(errorLog: string): number | null {
    // Looks for: at Object.<anonymous> (/path/to/file.ts:15:23)
    // Or TS error: file.ts(15,23): error TS1005: ...
    let regex = /:(\d+):\d+/g;
    let match;
    let firstLine = null;
    
    // First try standard node stack trace or TS compiler output
    match = regex.exec(errorLog);
    if (match) {
      firstLine = parseInt(match[1], 10);
      return firstLine;
    }

    // Try file.ts(15,23) format
    regex = /\((\d+),\d+\)/g;
    match = regex.exec(errorLog);
    if (match) {
      firstLine = parseInt(match[1], 10);
      return firstLine;
    }

    return null;
  }

  private static extractGenericLineNumber(errorLog: string): number | null {
    const match = errorLog.match(/line (\d+)|:(\d+)/i);
    if (match) {
      return parseInt(match[1] || match[2], 10);
    }
    return null;
  }

  private static extractSnippet(code: string, errorLineNumber: number, radius: number): string {
    const lines = code.split('\n');
    const zeroIndexedLine = errorLineNumber - 1;
    
    if (zeroIndexedLine < 0 || zeroIndexedLine >= lines.length) {
      return code.slice(0, 1000); // fallback snippet
    }

    const start = Math.max(0, zeroIndexedLine - radius);
    const end = Math.min(lines.length - 1, zeroIndexedLine + radius);

    const snippetLines = [];
    for (let i = start; i <= end; i++) {
      const prefix = (i === zeroIndexedLine) ? '>> ' : '   ';
      snippetLines.push(`${prefix}${i + 1}: ${lines[i]}`);
    }

    return snippetLines.join('\n');
  }

  private static matchRules(errorLog: string, _snippet: string | null, _lang: string): any | null {
    // 1. TS1005 (Syntax error)
    if (errorLog.includes('TS1005')) {
      return {
        ruleId: 'TS1005_SYNTAX',
        category: 'Syntax',
        subtype: 'MissingToken',
        rootCause: 'Missing expected token (e.g. bracket, parenthesis, semicolon)',
        suggestedFix: 'Check the error line for missing closing brackets or semicolons.'
      };
    }

    // 2. TS2304 / TS2552 (Cannot find name)
    if (errorLog.includes('TS2304') || errorLog.includes('TS2552')) {
      return {
        ruleId: 'TS2304_MISSING_NAME',
        category: 'Reference',
        subtype: 'UndeclaredVariable',
        rootCause: 'Variable or function is not defined in the current scope',
        suggestedFix: 'Ensure the variable is declared, or import it from the correct module.'
      };
    }

    // 3. Python ModuleNotFoundError
    if (errorLog.includes('ModuleNotFoundError')) {
      return {
        ruleId: 'PY_MODULE_NOT_FOUND',
        category: 'Import',
        subtype: 'MissingDependency',
        rootCause: 'The required Python module is not installed or the path is incorrect.',
        suggestedFix: 'Install the missing module using pip (e.g., pip install <module_name>).'
      };
    }

    // 4. Python IndentationError
    if (errorLog.includes('IndentationError')) {
      return {
        ruleId: 'PY_INDENT_ERROR',
        category: 'Syntax',
        subtype: 'Indentation',
        rootCause: 'Inconsistent or incorrect indentation (mixing tabs/spaces or wrong indent level).',
        suggestedFix: 'Fix the indentation on the highlighted line to match the surrounding block.'
      };
    }

    // 5. SyntaxError: Unexpected end of input
    if (errorLog.includes('SyntaxError: Unexpected end of input') || errorLog.includes('SyntaxError: unexpected EOF')) {
      return {
        ruleId: 'UNEXPECTED_EOF',
        category: 'Syntax',
        subtype: 'IncompleteCode',
        rootCause: 'The code ends abruptly, likely missing closing brackets or quotes.',
        suggestedFix: 'Add the missing closing brace `}` or parenthesis `)` at the end of the block.'
      };
    }

    return null;
  }
}
