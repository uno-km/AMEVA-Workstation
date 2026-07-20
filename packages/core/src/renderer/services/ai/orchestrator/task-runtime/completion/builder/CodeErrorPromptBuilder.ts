export class CodeErrorPromptBuilder {
  /**
   * Builds a specialized prompt for code error analysis using only the relevant snippet.
   * @param filePath The path of the file that was executed.
   * @param codeSnippet The localized snippet of the code surrounding the error.
   * @param errorLog The stderr or error message produced during execution.
   * @param errorLineNumber The extracted line number where the error occurred, if available.
   */
  public static build(filePath: string, codeSnippet: string, errorLog: string, errorLineNumber: number | null): string {
    const lineInfo = errorLineNumber ? `(Error identified around line: ${errorLineNumber})` : '';

    return `
You are an expert diagnostic AI tasked with analyzing a code execution error.
Please review the relevant code snippet and the error log to determine the root cause of the error.
Provide a clear explanation and suggest a fix.

# File Path
${filePath} ${lineInfo}

# Code Snippet Context
\`\`\`
${codeSnippet}
\`\`\`

# Execution Error Log
\`\`\`
${errorLog}
\`\`\`

# Instructions
1. Analyze the error log and identify the exact line or logic causing the problem in the provided source code snippet.
2. Explain the root cause of the error concisely.
3. Provide the corrected code. If the fix is small, you can provide a diff or the specific corrected block. If the fix requires modifying multiple parts, explain exactly what needs to change.
`;
  }
}
